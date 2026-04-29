/**
 * 重度障害者支援加算 — 実データ収集 hook (Phase A + B + C)
 *
 * ## Phase A の範囲（既存 SP フィールドのみ）
 *
 * ✅ Users_Master (FULL)
 *   - DisabilitySupportLevel → 候補判定
 *   - BehaviorScore → 候補判定
 *   - UserID, FullName → finding 紐付け
 *
 * ✅ Staff_Master
 *   - JobTitle → 生活支援員カウント
 *   - HasBasicTraining → 基礎研修修了カウント
 *   - HasPracticalTraining → 作成者資格チェック
 *   - IsActive → フィルタ
 *
 * ## Phase B の範囲（支援計画シートの再評価日）
 *
 * ✅ SupportPlanningSheet_Master (listCurrentByUser)
 *   - ReviewedAt → 最終再評価日
 *   - UserCode → 利用者紐付け
 *   → lastReassessmentMap（userId → 最終再評価日）を構築
 *
 * ## Phase C の範囲（週次観察・配置資格チェック）
 *
 * ✅ WeeklyObservation (listByUser)
 *   - observationDate → 利用者ごとの直近観察有無を判定
 *   → usersWithoutWeeklyObservation
 *
 * ✅ QualificationAssignment (getAll)
 *   - primary 配置の職員資格チェック
 *   → usersWithoutAssignmentQualification
 *
 * @see severeAddonFindings.ts — SevereAddonBulkInput 型定義
 * @see planningSheetReassessment.ts — 再評価ドメインロジック
 * @see weeklyObservationChecker.ts — 週次観察判定
 * @see assignmentQualificationChecker.ts — 配置資格判定
 */

import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/auth/useAuth';
import { isDevMode } from '@/lib/env';
import { AuthRequiredError } from '@/lib/errors';

import type { IUserMaster } from '@/sharepoint/fields';
import type { Staff } from '@/types';
import type { SevereAddonBulkInput, SevereAddonCheckInput } from '@/domain/regulatory/severeAddonFindings';
import type { PlanningSheetListItem } from '@/domain/isp/schema';
import type { PlanningSheetRepository } from '@/domain/isp/port';
import type {
  WeeklyObservationRepository,
  QualificationAssignmentRepository,
} from '@/domain/regulatory/staffQualificationRepository';
import {
  buildLastReassessmentMap,
  buildPlanningSheetIdsByUser,
} from '@/domain/regulatory/reassessmentMapBuilder';
import {
  findUsersWithoutRecentObservation,
  type ObservationRecordMinimal,
} from '@/domain/regulatory/weeklyObservationChecker';
import {
  findUsersWithUnqualifiedAssignment,
  type AssignmentMinimal,
} from '@/domain/regulatory/assignmentQualificationChecker';

// Re-export for backward compatibility (テストからの直接 import)
export { buildLastReassessmentMap };

// ---------------------------------------------------------------------------
// Staff → 加算関連集計
// ---------------------------------------------------------------------------

/** 生活支援員を判定する職種名パターン */
const LIFE_SUPPORT_TITLES = ['生活支援員', '支援員'] as const;

function isLifeSupportStaff(staff: Staff): boolean {
  if (!staff.active) return false;
  const title = staff.jobTitle ?? '';
  return LIFE_SUPPORT_TITLES.some(t => title.includes(t));
}

interface StaffAddonMetrics {
  /** 生活支援員の実人数 */
  totalLifeSupportStaff: number;
  /** 基礎研修修了者数 */
  basicTrainingCompletedCount: number;
  /** 実践研修修了者がいない場合 → 作成者要件不備の対象 */
  hasPracticalTrainedStaff: boolean;
}

function computeStaffMetrics(staffList: Staff[]): StaffAddonMetrics {
  const activeStaff = staffList.filter(s => s.active);
  const lifeSupportStaff = activeStaff.filter(isLifeSupportStaff);

  let basicCount = 0;
  let hasPractical = false;

  for (const s of activeStaff) {
    const certs = s.certifications ?? [];
    if (certs.some(c => c.includes('基礎研修'))) {
      basicCount++;
    }
    if (certs.some(c => c.includes('実践研修'))) {
      hasPractical = true;
    }
  }

  return {
    totalLifeSupportStaff: lifeSupportStaff.length,
    basicTrainingCompletedCount: basicCount,
    hasPracticalTrainedStaff: hasPractical,
  };
}

// ---------------------------------------------------------------------------
// Users → 加算候補利用者
// ---------------------------------------------------------------------------

function toAddonCheckInput(
  user: IUserMaster,
  planningSheetIds: string[],
): SevereAddonCheckInput {
  return {
    userId: user.UserID ?? `user-${user.Id}`,
    userName: user.FullName ?? undefined,
    supportLevel: user.DisabilitySupportLevel ?? null,
    behaviorScore: user.BehaviorScore ?? null,
    planningSheetIds,
  };
}

// NOTE: buildLastReassessmentMap, buildPlanningSheetIdsByUser は
// @/domain/regulatory/reassessmentMapBuilder からインポート（上記参照）

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface SevereAddonRealDataResult {
  /** buildSevereAddonFindings への入力 */
  input: SevereAddonBulkInput | null;
  /** データ読み込み中 */
  isLoading: boolean;
  /** エラー */
  error: Error | null;
  /** データソースの説明（UI 表示用） */
  dataSourceLabel: string;
}

/**
 * 加算判定の実データを収集して `SevereAddonBulkInput` を構築する
 *
 * @param users - useUsers(full) から取得した利用者データ
 * @param staff - useStaff() から取得した職員データ
 * @param isLoading - データ読み込み中かどうか
 * @param error - データ取得エラー
 * @param planningSheetRepo - PlanningSheetRepository（Phase B: 再評価日取得用）
 * @param weeklyObsRepo - WeeklyObservationRepository（Phase C: 週次観察取得用）
 * @param assignmentRepo - QualificationAssignmentRepository（Phase C: 配置資格取得用）
 */
export function useSevereAddonRealData(
  users: IUserMaster[],
  staff: Staff[],
  isLoading: boolean,
  error: Error | null,
  planningSheetRepo?: PlanningSheetRepository | null,
  weeklyObsRepo?: WeeklyObservationRepository | null,
  assignmentRepo?: QualificationAssignmentRepository | null,
  authReadyOverride?: boolean,
): SevereAddonRealDataResult {
  const { isAuthReady } = useAuth();
  const authReady = authReadyOverride ?? isAuthReady;
  const authSkipLoggedRef = useRef(false);

  const isAuthRequiredError = useCallback((err: unknown): boolean => {
    if (err instanceof AuthRequiredError) return true;
    if (!(err instanceof Error)) return false;
    const code = (err as { code?: string }).code;
    return (
      err.name === 'AuthRequiredError' ||
      err.message === 'AUTH_REQUIRED' ||
      code === 'AUTH_REQUIRED'
    );
  }, []);

  const logAuthSkipOnce = useCallback(() => {
    if (authSkipLoggedRef.current) return;
    authSkipLoggedRef.current = true;
    if (isDevMode()) {
      console.info('[auth] skip real data fetch: account not ready');
    }
  }, []);

  // ── Phase B: 支援計画シートの再評価日を非同期に取得 ──
  const [sheetsByUser, setSheetsByUser] = useState<Map<string, PlanningSheetListItem[]>>(new Map());
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsError, setSheetsError] = useState<Error | null>(null);

  // 候補利用者の userId リスト（stable reference）
  const activeUserIds = useMemo(() => {
    if (isLoading || error || users.length === 0) return [];
    return users
      .filter(u => u.IsActive !== false)
      .map(u => u.UserID ?? `user-${u.Id}`);
  }, [users, isLoading, error]);
  const activeUserIdsKey = useMemo(() => activeUserIds.join('|'), [activeUserIds]);
  const planningFetchStateRef = useRef<{ inFlightKey: string | null; completedKey: string | null }>({
    inFlightKey: null,
    completedKey: null,
  });

  const fetchPlanningSheets = useCallback(async () => {
    if (!authReady) {
      logAuthSkipOnce();
      setSheetsByUser(new Map());
      planningFetchStateRef.current = { inFlightKey: null, completedKey: null };
      return;
    }
    if (!planningSheetRepo || activeUserIds.length === 0) {
      setSheetsByUser(new Map());
      planningFetchStateRef.current = { inFlightKey: null, completedKey: null };
      return;
    }
    const requestKey = activeUserIdsKey;
    if (
      planningFetchStateRef.current.inFlightKey === requestKey ||
      planningFetchStateRef.current.completedKey === requestKey
    ) {
      return;
    }
    planningFetchStateRef.current.inFlightKey = requestKey;

    setSheetsLoading(true);
    setSheetsError(null);

    try {
      const results = new Map<string, PlanningSheetListItem[]>();

      // 全候補利用者の現行 PlanningSheet を取得
      // NOTE: 大規模事業所ではバッチ取得に最適化可能だが、
      //   生活介護の事業所規模（〜50名程度）なら個別取得で十分。
      const promises = activeUserIds.map(async (userId) => {
        try {
          const sheets = await planningSheetRepo.listCurrentByUser(userId);
          results.set(userId, sheets);
        } catch (err) {
          if (isAuthRequiredError(err)) {
            logAuthSkipOnce();
            results.set(userId, []);
            return;
          }
          console.warn(`[useSevereAddonRealData] Failed to fetch sheets for ${userId}:`, err);
          results.set(userId, []);
        }
      });

      await Promise.all(promises);
      setSheetsByUser(results);
      planningFetchStateRef.current.completedKey = requestKey;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (isAuthRequiredError(e)) {
        logAuthSkipOnce();
        planningFetchStateRef.current.completedKey = null;
        return;
      }
      setSheetsError(e);
      console.warn('[useSevereAddonRealData] PlanningSheet fetch failed:', e.message);
      planningFetchStateRef.current.completedKey = null;
    } finally {
      if (planningFetchStateRef.current.inFlightKey === requestKey) {
        planningFetchStateRef.current.inFlightKey = null;
      }
      setSheetsLoading(false);
    }
  }, [planningSheetRepo, activeUserIds, activeUserIdsKey, authReady, isAuthRequiredError, logAuthSkipOnce]);

  useEffect(() => {
    fetchPlanningSheets();
  }, [fetchPlanningSheets]);

  // ── Phase C: 週次観察データを非同期に取得 ──
  const [allObservations, setAllObservations] = useState<ObservationRecordMinimal[]>([]);
  const [obsLoading, setObsLoading] = useState(false);
  const [obsError, setObsError] = useState<Error | null>(null);

  const fetchObservations = useCallback(async () => {
    if (!authReady) {
      logAuthSkipOnce();
      setAllObservations([]);
      return;
    }
    if (!weeklyObsRepo || activeUserIds.length === 0) {
      setAllObservations([]);
      return;
    }

    setObsLoading(true);
    setObsError(null);

    try {
      const results: ObservationRecordMinimal[] = [];

      const promises = activeUserIds.map(async (userId) => {
        try {
          const records = await weeklyObsRepo.listByUser(userId);
          for (const r of records) {
            results.push({ userId: r.userId, observationDate: r.observationDate });
          }
        } catch (err) {
          if (isAuthRequiredError(err)) {
            logAuthSkipOnce();
            return;
          }
          console.warn(`[useSevereAddonRealData] Failed to fetch observations for ${userId}:`, err);
        }
      });

      await Promise.all(promises);
      setAllObservations(results);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (isAuthRequiredError(e)) {
        logAuthSkipOnce();
        return;
      }
      setObsError(e);
      console.warn('[useSevereAddonRealData] Observation fetch failed:', e.message);
    } finally {
      setObsLoading(false);
    }
  }, [weeklyObsRepo, activeUserIds, authReady, isAuthRequiredError, logAuthSkipOnce]);

  useEffect(() => {
    fetchObservations();
  }, [fetchObservations]);

  // ── Phase C: 配置データを非同期に取得 ──
  const [allAssignments, setAllAssignments] = useState<AssignmentMinimal[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<Error | null>(null);

  const fetchAssignments = useCallback(async () => {
    if (!authReady) {
      logAuthSkipOnce();
      setAllAssignments([]);
      return;
    }
    if (!assignmentRepo || activeUserIds.length === 0) {
      setAllAssignments([]);
      return;
    }

    setAssignLoading(true);
    setAssignError(null);

    try {
      const records = await assignmentRepo.getAll();
      setAllAssignments(
        records.map(r => ({
          staffId: r.staffId,
          userId: r.userId,
          assignedFrom: r.assignedFrom,
          assignedTo: r.assignedTo,
          assignmentType: r.assignmentType,
        })),
      );
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      if (isAuthRequiredError(e)) {
        logAuthSkipOnce();
        return;
      }
      setAssignError(e);
      console.warn('[useSevereAddonRealData] Assignment fetch failed:', e.message);
    } finally {
      setAssignLoading(false);
    }
  }, [assignmentRepo, activeUserIds, authReady, isAuthRequiredError, logAuthSkipOnce]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // ── メイン BulkInput 構築 ──
  const combinedLoading = isLoading || (authReady && (sheetsLoading || obsLoading || assignLoading));
  const combinedError = error || sheetsError || obsError || assignError;

  const input = useMemo<SevereAddonBulkInput | null>(() => {
    if (combinedLoading || combinedError) return null;
    if (users.length === 0 && staff.length === 0) return null;

    const today = new Date().toISOString().slice(0, 10);
    const staffMetrics = computeStaffMetrics(staff);

    // Phase B: 再評価日マップと PlanningSheet ID マップ
    const lastReassessmentMap = buildLastReassessmentMap(sheetsByUser);
    const planningSheetIdsByUser = buildPlanningSheetIdsByUser(sheetsByUser);

    // 利用者を SevereAddonCheckInput に変換
    const addonUsers: SevereAddonCheckInput[] = users
      .filter(u => u.IsActive !== false)
      .map(u => {
        const userId = u.UserID ?? `user-${u.Id}`;
        const sheetIds = planningSheetIdsByUser.get(userId) ?? [];
        return toAddonCheckInput(u, sheetIds);
      });

    // 候補者のユーザーID
    const candidateUserIds = addonUsers.map(u => u.userId);

    // 作成者要件: 実践研修修了者がいなければ全候補者が対象
    const usersWithoutAuthoringQualification: string[] = staffMetrics.hasPracticalTrainedStaff
      ? []
      : candidateUserIds;

    // Phase C: 週次観察不足の利用者を判定
    const usersWithoutWeeklyObservation = weeklyObsRepo
      ? findUsersWithoutRecentObservation(candidateUserIds, allObservations, today)
      : [];

    // Phase C: 配置資格不足の利用者を判定
    // staffCerts: staffId → certifications のマップ
    const staffCerts = new Map<string, string[]>();
    for (const s of staff) {
      const id = s.staffId ?? s.id ?? '';
      if (id) {
        staffCerts.set(id, s.certifications ?? []);
      }
    }

    const usersWithoutAssignmentQualification = assignmentRepo
      ? findUsersWithUnqualifiedAssignment(candidateUserIds, allAssignments, staffCerts, today)
      : [];

    return {
      users: addonUsers,
      totalLifeSupportStaff: staffMetrics.totalLifeSupportStaff,
      basicTrainingCompletedCount: staffMetrics.basicTrainingCompletedCount,
      usersWithoutWeeklyObservation,
      lastReassessmentMap,
      usersWithoutAuthoringQualification,
      usersWithoutAssignmentQualification,
      today,
    };
  }, [users, staff, combinedLoading, combinedError, sheetsByUser, allObservations, allAssignments, weeklyObsRepo, assignmentRepo]);

  return {
    input,
    isLoading: combinedLoading,
    error: combinedError,
    dataSourceLabel: input ? '実データ' : 'デモデータ',
  };
}

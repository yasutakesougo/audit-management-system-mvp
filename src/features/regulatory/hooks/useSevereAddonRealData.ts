/**
 * 重度障害者支援加算 — 実データ収集 hook (Phase A + B)
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
 * 🟡 Phase C（未実装 → 空配列）
 *   - 週次観察: usersWithoutWeeklyObservation → []
 *   - 配置チェック: usersWithoutAssignmentQualification → []
 *
 * @see severeAddonFindings.ts — SevereAddonBulkInput 型定義
 * @see planningSheetReassessment.ts — 再評価ドメインロジック
 */

import { useMemo, useEffect, useState, useCallback } from 'react';

import type { IUserMaster } from '@/sharepoint/fields';
import type { Staff } from '@/types';
import type { SevereAddonBulkInput, SevereAddonCheckInput } from '@/domain/regulatory/severeAddonFindings';
import type { PlanningSheetListItem } from '@/domain/isp/schema';
import type { PlanningSheetRepository } from '@/domain/isp/port';
import {
  buildLastReassessmentMap,
  buildPlanningSheetIdsByUser,
} from '@/domain/regulatory/reassessmentMapBuilder';

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
 */
export function useSevereAddonRealData(
  users: IUserMaster[],
  staff: Staff[],
  isLoading: boolean,
  error: Error | null,
  planningSheetRepo?: PlanningSheetRepository | null,
): SevereAddonRealDataResult {

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

  const fetchPlanningSheets = useCallback(async () => {
    if (!planningSheetRepo || activeUserIds.length === 0) {
      setSheetsByUser(new Map());
      return;
    }

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
          console.warn(`[useSevereAddonRealData] Failed to fetch sheets for ${userId}:`, err);
          results.set(userId, []);
        }
      });

      await Promise.all(promises);
      setSheetsByUser(results);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setSheetsError(e);
      console.warn('[useSevereAddonRealData] PlanningSheet fetch failed:', e.message);
    } finally {
      setSheetsLoading(false);
    }
  }, [planningSheetRepo, activeUserIds]);

  useEffect(() => {
    fetchPlanningSheets();
  }, [fetchPlanningSheets]);

  // ── メイン BulkInput 構築 ──
  const combinedLoading = isLoading || sheetsLoading;
  const combinedError = error || sheetsError;

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

    // 作成者要件: 実践研修修了者がいなければ全候補者が対象
    const usersWithoutAuthoringQualification: string[] = staffMetrics.hasPracticalTrainedStaff
      ? []
      : addonUsers.map(u => u.userId);

    return {
      users: addonUsers,
      totalLifeSupportStaff: staffMetrics.totalLifeSupportStaff,
      basicTrainingCompletedCount: staffMetrics.basicTrainingCompletedCount,
      usersWithoutWeeklyObservation: [],  // Phase C で実装
      lastReassessmentMap,
      usersWithoutAuthoringQualification,
      usersWithoutAssignmentQualification: [],  // Phase C で実装
      today,
    };
  }, [users, staff, combinedLoading, combinedError, sheetsByUser]);

  return {
    input,
    isLoading: combinedLoading,
    error: combinedError,
    dataSourceLabel: input ? '実データ' : 'デモデータ',
  };
}

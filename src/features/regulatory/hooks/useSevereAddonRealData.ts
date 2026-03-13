/**
 * 重度障害者支援加算 — 実データ収集 hook (Phase A)
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
 * 🟡 Phase B/C（未実装 → 空配列/空マップ）
 *   - 週次観察: usersWithoutWeeklyObservation → []
 *   - 再評価日: lastReassessmentMap → empty Map
 *   - 配置チェック: usersWithoutAssignmentQualification → []
 *
 * @see severeAddonFindings.ts — SevereAddonBulkInput 型定義
 */

import { useMemo } from 'react';

import type { IUserMaster } from '@/sharepoint/fields';
import type { Staff } from '@/types';
import type { SevereAddonBulkInput, SevereAddonCheckInput } from '@/domain/regulatory/severeAddonFindings';

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

  // Staff 型は certifications[] しかないが、
  // SP の HasBasicTraining / HasPracticalTraining は SpStaffItem に直接ある。
  // ここでは certifications 内の文字列で判定する（デモ互換）。
  // 実運用では SpStaffItem から直接読む。
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

function toAddonCheckInput(user: IUserMaster): SevereAddonCheckInput {
  return {
    userId: user.UserID ?? `user-${user.Id}`,
    userName: user.FullName ?? undefined,
    supportLevel: user.DisabilitySupportLevel ?? null,
    behaviorScore: user.BehaviorScore ?? null,
    planningSheetIds: [],  // Phase B で SupportPlans から紐付け
  };
}

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
 */
export function useSevereAddonRealData(
  users: IUserMaster[],
  staff: Staff[],
  isLoading: boolean,
  error: Error | null,
): SevereAddonRealDataResult {
  const input = useMemo<SevereAddonBulkInput | null>(() => {
    if (isLoading || error) return null;
    if (users.length === 0 && staff.length === 0) return null;

    const today = new Date().toISOString().slice(0, 10);
    const staffMetrics = computeStaffMetrics(staff);

    // 利用者を SevereAddonCheckInput に変換
    const addonUsers: SevereAddonCheckInput[] = users
      .filter(u => u.IsActive !== false)
      .map(toAddonCheckInput);

    // 作成者要件: 実践研修修了者がいなければ全候補者が対象
    // Phase A では簡易判定（事業所に実践研修修了者が1人もいなければ全員対象）
    const usersWithoutAuthoringQualification: string[] = staffMetrics.hasPracticalTrainedStaff
      ? []
      : addonUsers.map(u => u.userId);

    return {
      users: addonUsers,
      totalLifeSupportStaff: staffMetrics.totalLifeSupportStaff,
      basicTrainingCompletedCount: staffMetrics.basicTrainingCompletedCount,
      usersWithoutWeeklyObservation: [],  // Phase C で実装
      lastReassessmentMap: new Map(),     // Phase B で実装
      usersWithoutAuthoringQualification,
      usersWithoutAssignmentQualification: [],  // Phase C で実装
      today,
    };
  }, [users, staff, isLoading, error]);

  return {
    input,
    isLoading,
    error,
    dataSourceLabel: input ? '実データ' : 'デモデータ',
  };
}

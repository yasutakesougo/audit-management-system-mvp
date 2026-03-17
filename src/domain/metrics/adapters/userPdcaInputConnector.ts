/**
 * @fileoverview buildUserPdcaInputs — 利用者データから UserPdcaInput[] を構築
 * @description
 * 既存の User[] + SuggestionAction[] + planning sheet 情報から
 * useOpsMetrics に渡す UserPdcaInput[] を組み立てる pure function。
 *
 * データフロー:
 *   User[]                  → userId, supportStartDate
 *   SuggestionAction[]      → proposalAcceptedAt (builder で注入)
 *   monitoringCompletions   → reviewCompletedAt (外部渡し)
 *   planUpdateDates         → planUpdatedAt (外部渡し)
 *
 * @see docs/ops/pdca-cycle-record-definition.md § 7 (除外ルール)
 */

import type { UserPdcaInput } from '@/features/ops-dashboard/hooks/useOpsMetrics';

// ─── 入力型 ──────────────────────────────────────────────

/** 利用者の最小情報（User 型のサブセット） */
export interface UserInfo {
  /** SP の Id or userId */
  userId: string;
  /** 利用開始日（= supportStartDate / serviceStartDate） */
  serviceStartDate?: string | null;
  /** アクティブかどうか */
  active?: boolean;
}

/** モニタリング完了情報 */
export interface MonitoringCompletionInfo {
  userId: string;
  /** round → completedAt ISO のマップ */
  completions: Map<number, string>;
}

/** 計画更新情報 */
export interface PlanUpdateInfo {
  userId: string;
  /** round → updatedAt ISO のマップ */
  updates: Map<number, string>;
}

// ─── メインコネクター関数 ────────────────────────────────

/**
 * 利用者データから UserPdcaInput[] を構築する。
 *
 * - active でない利用者はスキップ
 * - serviceStartDate が null の利用者は supportStartDate = null で渡す
 *   (useOpsMetrics 側で除外 + excludedUserCount としてカウント)
 *
 * @param users                  - 利用者一覧
 * @param monitoringCompletions  - モニタリング完了情報（userId → round → date）
 * @param planUpdates            - 計画更新情報（userId → round → date）
 * @param cycleDays              - モニタリング周期（デフォルト 90）
 */
export function buildUserPdcaInputs(
  users: UserInfo[],
  monitoringCompletions: MonitoringCompletionInfo[] = [],
  planUpdates: PlanUpdateInfo[] = [],
  cycleDays = 90,
): UserPdcaInput[] {
  // ルックアップマップ
  const completionsMap = new Map(
    monitoringCompletions.map(mc => [mc.userId, mc.completions]),
  );
  const updatesMap = new Map(
    planUpdates.map(pu => [pu.userId, pu.updates]),
  );

  return users
    .filter(u => u.active !== false) // inactive は除外
    .map(user => ({
      userId: user.userId,
      supportStartDate: user.serviceStartDate ?? null,
      cycleDays,
      monitoringCompletions: completionsMap.get(user.userId),
      planUpdateDates: updatesMap.get(user.userId),
    }));
}

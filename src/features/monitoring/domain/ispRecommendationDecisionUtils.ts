/**
 * @fileoverview ISP 見直し提案に対する判断記録のユーティリティ（pure function）
 * @description
 * Phase 4-C:
 *   IspRecommendation → RecommendationSnapshot の変換、
 *   IspRecommendationDecision の生成、
 *   DecisionSummary の集計を行う。
 *
 * 全関数は pure function。副作用・外部依存なし。
 *
 * 関連:
 *   - ispRecommendationDecisionTypes.ts (型定義)
 *   - ispRecommendationTypes.ts (提案型)
 */

import type { IspRecommendation, IspRecommendationSummary } from './ispRecommendationTypes';
import type {
  DecisionStatus,
  DecisionSummary,
  GoalDecisionHistory,
  IspRecommendationDecision,
  RecommendationSnapshot,
} from './ispRecommendationDecisionTypes';

// ─── スナップショット生成 ────────────────────────────────

/**
 * IspRecommendation から RecommendationSnapshot を切り出す。
 * 判断時点の提案内容をフリーズする。
 */
export function createRecommendationSnapshot(
  recommendation: IspRecommendation,
): RecommendationSnapshot {
  return {
    level: recommendation.level,
    reason: recommendation.reason,
    progressLevel: recommendation.evidence.progressLevel,
    rate: recommendation.evidence.rate,
    trend: recommendation.evidence.trend,
    matchedRecordCount: recommendation.evidence.matchedRecordCount,
    matchedTagCount: recommendation.evidence.matchedTagCount,
  };
}

// ─── 判断レコード生成 ────────────────────────────────────

export interface CreateDecisionInput {
  /** 判断 ID（外部で UUID を生成して渡す） */
  id: string;
  /** 対象目標の IspRecommendation */
  recommendation: IspRecommendation;
  /** 対象利用者 ID */
  userId: string;
  /** 判断ステータス */
  status: DecisionStatus;
  /** 判断者 */
  decidedBy: string;
  /** 判断日時（ISO 8601）。省略時は呼び出し側で設定 */
  decidedAt: string;
  /** 判断メモ（任意） */
  note?: string;
  /** モニタリング期間 */
  monitoringPeriodFrom: string;
  monitoringPeriodTo: string;
}

/**
 * IspRecommendation に対する判断レコードを生成する。
 * snapshot を含むので、後からロジック変更があっても当時の提案を追跡可能。
 */
export function createDecisionRecord(
  input: CreateDecisionInput,
): IspRecommendationDecision {
  return {
    id: input.id,
    goalId: input.recommendation.goalId,
    userId: input.userId,
    status: input.status,
    decidedBy: input.decidedBy,
    decidedAt: input.decidedAt,
    note: input.note ?? '',
    snapshot: createRecommendationSnapshot(input.recommendation),
    monitoringPeriodFrom: input.monitoringPeriodFrom,
    monitoringPeriodTo: input.monitoringPeriodTo,
  };
}

// ─── 判断サマリー集計 ────────────────────────────────────

/**
 * 判断レコード群から DecisionSummary を集計する。
 *
 * - totalGoals: recommendations の目標数（判断がなくても含む）
 * - 各ステータスの件数
 * - 最終更新日時 / 判断者
 *
 * @param recommendations - 現在の提案サマリー（全目標数把握用）
 * @param decisions - 判断レコード群（このモニタリング期間分）
 */
export function buildDecisionSummary(
  recommendations: IspRecommendationSummary,
  decisions: IspRecommendationDecision[],
): DecisionSummary {
  const totalGoals = recommendations.totalGoalCount;

  const byStatus: Record<DecisionStatus, number> = {
    pending: 0,
    accepted: 0,
    dismissed: 0,
    deferred: 0,
  };

  // goalId → 最新の判断をマッピング（同じ目標に複数判断がある場合は最新を採用）
  const latestByGoal = resolveLatestDecisionsByGoal(decisions);

  for (const decision of latestByGoal.values()) {
    byStatus[decision.status]++;
  }

  // 判断がない目標は pending としてカウント
  const decidedGoalCount = latestByGoal.size;
  byStatus.pending += Math.max(0, totalGoals - decidedGoalCount);

  const decidedCount = byStatus.accepted + byStatus.dismissed + byStatus.deferred;

  // 最終更新情報
  let lastDecidedAt: string | null = null;
  let lastDecidedBy: string | null = null;

  if (decisions.length > 0) {
    const sorted = [...decisions].sort(
      (a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime(),
    );
    lastDecidedAt = sorted[0].decidedAt;
    lastDecidedBy = sorted[0].decidedBy;
  }

  return {
    totalGoals,
    decidedCount,
    pendingCount: byStatus.pending,
    byStatus,
    lastDecidedAt,
    lastDecidedBy,
  };
}

// ─── 目標別判断履歴 ──────────────────────────────────────

/**
 * 判断レコード群を goalId でグルーピングし、GoalDecisionHistory[] を生成する。
 *
 * @param decisions - 全判断レコード（複数モニタリング期間分も可）
 * @param goalNames - goalId → 表示名マップ
 * @returns goalId ごとの判断履歴（新しい順）
 */
export function buildGoalDecisionHistories(
  decisions: IspRecommendationDecision[],
  goalNames?: Record<string, string>,
): GoalDecisionHistory[] {
  const byGoal = new Map<string, IspRecommendationDecision[]>();

  for (const d of decisions) {
    const list = byGoal.get(d.goalId) ?? [];
    list.push(d);
    byGoal.set(d.goalId, list);
  }

  const histories: GoalDecisionHistory[] = [];

  for (const [goalId, goalDecisions] of byGoal.entries()) {
    // 新しい順にソート
    const sorted = [...goalDecisions].sort(
      (a, b) => new Date(b.decidedAt).getTime() - new Date(a.decidedAt).getTime(),
    );

    histories.push({
      goalId,
      goalName: goalNames?.[goalId],
      decisions: sorted,
      latestDecision: sorted[0],
    });
  }

  return histories;
}

// ─── 提案と判断のマージ ──────────────────────────────────

/**
 * 現在の提案と既存の判断をマージして、
 * 各目標の「現在の判断ステータス」を返す。
 *
 * @param recommendations - 現在の提案
 * @param decisions - このモニタリング期間の判断レコード
 * @returns goalId → 最新の DecisionStatus マップ
 */
export function resolveCurrentDecisionStatus(
  recommendations: IspRecommendationSummary,
  decisions: IspRecommendationDecision[],
): Map<string, DecisionStatus> {
  const latestByGoal = resolveLatestDecisionsByGoal(decisions);
  const result = new Map<string, DecisionStatus>();

  for (const rec of recommendations.recommendations) {
    const latestDecision = latestByGoal.get(rec.goalId);
    result.set(rec.goalId, latestDecision?.status ?? 'pending');
  }

  return result;
}

// ─── 判断完了率 ──────────────────────────────────────────

/**
 * 判断完了率を計算する。
 * actionable な提案（pending レベルを除く）のうち、
 * accepted / dismissed / deferred のいずれかの判断がされた割合。
 */
export function calculateDecisionCompletionRate(
  summary: DecisionSummary,
): number {
  const actionable = summary.totalGoals - summary.byStatus.pending;
  if (actionable <= 0) return 100; // 全てが pending なら完了とみなす
  return Math.round((summary.decidedCount / actionable) * 100);
}

// ─── ヘルパー ────────────────────────────────────────────

/**
 * goalId ごとに最新の判断を1つ解決する。
 * 同じ goalId に対して複数の判断がある場合は decidedAt が最新のものを採用。
 */
function resolveLatestDecisionsByGoal(
  decisions: IspRecommendationDecision[],
): Map<string, IspRecommendationDecision> {
  const latestByGoal = new Map<string, IspRecommendationDecision>();

  for (const d of decisions) {
    const existing = latestByGoal.get(d.goalId);
    if (!existing || new Date(d.decidedAt).getTime() > new Date(existing.decidedAt).getTime()) {
      latestByGoal.set(d.goalId, d);
    }
  }

  return latestByGoal;
}

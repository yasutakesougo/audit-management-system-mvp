/**
 * Schedule Ops Load Score — 負荷スコアと判断支援の純粋関数
 *
 * Phase 3-A: 「年休とりたいな、予定どうなってる？」を実現する判断支援レイヤー
 *
 * 設計判断:
 *   - すべて pure function（副作用なし、テスト容易）
 *   - DaySummaryEntry をベースに算出（UI に依存しない）
 *   - 重みパラメータは OpsLoadWeights として外部注入可能
 *   - 閾値は OpsLoadThresholds として外部注入可能
 *
 * Covered functions:
 *   - computeLoadScore()          — 日別負荷スコア算出
 *   - classifyLoadLevel()         — スコアからレベル分類
 *   - assessLeaveEligibility()    — 年休可否判定
 *   - suggestBestLeaveDays()      — 週間の休暇推奨日提示
 *   - computeWeeklyLoadScores()   — 週間全日のスコア一括算出
 */

import type { DaySummaryEntry, OpsCapacity } from './scheduleOps';
import { DEFAULT_OPS_CAPACITY } from './scheduleOps';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** 負荷スコアの重みパラメータ */
export type OpsLoadWeights = {
  readonly totalWeight: number;
  readonly respiteWeight: number;
  readonly shortStayWeight: number;
  readonly attentionWeight: number;
  readonly availableSlotWeight: number;
};

/** 負荷スコアの閾値 */
export type OpsLoadThresholds = {
  /** この値以下なら low（余裕あり） */
  readonly lowMax: number;
  /** この値以下なら moderate（やや忙しい）、超えると high */
  readonly moderateMax: number;
  /** この値を超えると critical（超過・危険） */
  readonly criticalMin: number;
};

/** 負荷レベル */
export type LoadLevel = 'low' | 'moderate' | 'high' | 'critical';

/** 年休可否判定結果 */
export type LeaveEligibility = 'available' | 'caution' | 'unavailable';

/** 日別負荷スコア算出結果 */
export type DayLoadScore = {
  readonly dateIso: string;
  readonly score: number;
  readonly level: LoadLevel;
  readonly leaveEligibility: LeaveEligibility;
};

/** 年休推奨日 */
export type LeaveSuggestion = {
  readonly dateIso: string;
  readonly score: number;
  readonly level: LoadLevel;
  readonly rank: number; // 1 が最もおすすめ
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Defaults
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * デフォルト重み:
 *   total(1) + respite(+2) + shortStay(+3) + attention(+2) - available(-1)
 *
 * 基本的に「レスパイト・ショートステイは手間が大きい」という前提の重み付け。
 * 将来的に管理画面から設定可能にする想定。
 */
export const DEFAULT_LOAD_WEIGHTS: OpsLoadWeights = {
  totalWeight: 1,
  respiteWeight: 2,
  shortStayWeight: 3,
  attentionWeight: 2,
  availableSlotWeight: 1,
};

/**
 * デフォルト閾値:
 *   - low: 0-10 → 余裕あり（休暇OK）
 *   - moderate: 11-20 → やや忙しい（要注意）
 *   - high: 21-30 → 忙しい（休暇は避ける）
 *   - critical: 31+ → 超過・危険
 *
 * デフォルト定員（normal:20, respite:3, shortStay:2 = max 25名）での想定。
 */
export const DEFAULT_LOAD_THRESHOLDS: OpsLoadThresholds = {
  lowMax: 10,
  moderateMax: 20,
  criticalMin: 30,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 日別負荷スコアを算出する。
 *
 * スコア算出式:
 *   loadScore = totalCount * totalWeight
 *             + respiteCount * respiteWeight
 *             + shortStayCount * shortStayWeight
 *             + attentionCount * attentionWeight
 *             - availableSlots * availableSlotWeight
 *
 * スコアは 0 以上に切り上げ（マイナスにはしない）。
 *
 * @param day - 日別集計データ
 * @param weights - 重みパラメータ
 * @returns 負荷スコア（0以上の整数）
 */
export function computeLoadScore(
  day: DaySummaryEntry,
  weights: OpsLoadWeights = DEFAULT_LOAD_WEIGHTS,
): number {
  const raw =
    day.totalCount * weights.totalWeight +
    day.respiteCount * weights.respiteWeight +
    day.shortStayCount * weights.shortStayWeight +
    day.attentionCount * weights.attentionWeight -
    day.availableSlots * weights.availableSlotWeight;
  return Math.max(0, Math.round(raw));
}

/**
 * 負荷スコアをレベルに分類する。
 *
 * @param score - 負荷スコア
 * @param thresholds - 閾値設定
 * @returns LoadLevel
 */
export function classifyLoadLevel(
  score: number,
  thresholds: OpsLoadThresholds = DEFAULT_LOAD_THRESHOLDS,
): LoadLevel {
  if (score <= thresholds.lowMax) return 'low';
  if (score <= thresholds.moderateMax) return 'moderate';
  if (score >= thresholds.criticalMin) return 'critical';
  return 'high';
}

/**
 * 年休可否を判定する。
 *
 * - low → available（🟢 休める）
 * - moderate → caution（🟡 微妙）
 * - high / critical → unavailable（🔴 無理）
 *
 * 追加条件: isOverCapacity が true なら強制 unavailable。
 *
 * @param day - 日別集計データ
 * @param score - 負荷スコア
 * @param level - 負荷レベル
 * @returns LeaveEligibility
 */
export function assessLeaveEligibility(
  day: DaySummaryEntry,
  score: number,
  level: LoadLevel,
): LeaveEligibility {
  // 定員超過は問答無用で不可
  if (day.isOverCapacity) return 'unavailable';

  switch (level) {
    case 'low':
      return 'available';
    case 'moderate':
      return 'caution';
    case 'high':
    case 'critical':
      return 'unavailable';
  }
}

/**
 * 週間全日の負荷スコアを一括算出する。
 *
 * @param weekSummary - DaySummaryEntry[] (computeWeeklySummary の結果)
 * @param weights - 重みパラメータ
 * @param thresholds - 閾値設定
 * @returns DayLoadScore[]
 */
export function computeWeeklyLoadScores(
  weekSummary: readonly DaySummaryEntry[],
  weights: OpsLoadWeights = DEFAULT_LOAD_WEIGHTS,
  thresholds: OpsLoadThresholds = DEFAULT_LOAD_THRESHOLDS,
): DayLoadScore[] {
  return weekSummary.map((day) => {
    const score = computeLoadScore(day, weights);
    const level = classifyLoadLevel(score, thresholds);
    const leaveEligibility = assessLeaveEligibility(day, score, level);
    return {
      dateIso: day.dateIso,
      score,
      level,
      leaveEligibility,
    };
  });
}

/**
 * 週間の休暇推奨日を提示する。
 *
 * - スコアが低い順にランク付け
 * - unavailable な日は除外
 * - maxSuggestions で上限を設定
 *
 * @param loadScores - DayLoadScore[] (computeWeeklyLoadScores の結果)
 * @param maxSuggestions - 最大推奨数（デフォルト 3）
 * @returns LeaveSuggestion[]
 */
export function suggestBestLeaveDays(
  loadScores: readonly DayLoadScore[],
  maxSuggestions: number = 3,
): LeaveSuggestion[] {
  return loadScores
    .filter((d) => d.leaveEligibility !== 'unavailable')
    .sort((a, b) => a.score - b.score)
    .slice(0, maxSuggestions)
    .map((d, i) => ({
      dateIso: d.dateIso,
      score: d.score,
      level: d.level,
      rank: i + 1,
    }));
}

/**
 * 年休判定サマリー用のユーティリティ。
 * DaySummaryEntry と OpsCapacity から直接 DayLoadScore を算出する便利関数。
 *
 * @param day - 日別集計データ
 * @param _capacity - 定員設定（将来拡張用、現状はday内のisOverCapacityで判定）
 * @param weights - 重みパラメータ
 * @param thresholds - 閾値設定
 * @returns DayLoadScore
 */
export function computeDayLoadScore(
  day: DaySummaryEntry,
  _capacity: OpsCapacity = DEFAULT_OPS_CAPACITY,
  weights: OpsLoadWeights = DEFAULT_LOAD_WEIGHTS,
  thresholds: OpsLoadThresholds = DEFAULT_LOAD_THRESHOLDS,
): DayLoadScore {
  const score = computeLoadScore(day, weights);
  const level = classifyLoadLevel(score, thresholds);
  const leaveEligibility = assessLeaveEligibility(day, score, level);
  return {
    dateIso: day.dateIso,
    score,
    level,
    leaveEligibility,
  };
}

// contract:allow-interface — Pure domain function types, not API boundary schemas
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
  // 以下、イレギュラー・変動対応負荷のペナルティ (Phase 8-A)
  readonly absencePenalty: number;
  readonly latePenalty: number;
  readonly existingLeavePenalty: number;
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

/** 年休推奨理由ラベル */
export type LeaveReason = {
  readonly key: string;
  readonly label: string;
};

/** 年休推奨日 */
export type LeaveSuggestion = {
  readonly dateIso: string;
  readonly score: number;
  readonly level: LoadLevel;
  readonly rank: number; // 1 が最もおすすめ
  readonly reasons: readonly LeaveReason[];
};

/** 高負荷警告 */
export type HighLoadWarning = {
  readonly dateIso: string;
  readonly score: number;
  readonly level: Extract<LoadLevel, 'high' | 'critical'>;
  readonly reasons: readonly LeaveReason[];
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

  // イレギュラー対応・リソース低下による管理負荷ペナルティ
  absencePenalty: 2,         // 送迎再編・保護者連絡等やや重め
  latePenalty: 1,            // 局所的な対応
  existingLeavePenalty: 1,   // 人員減によるベースラインひっ迫
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
  let raw =
    day.totalCount * weights.totalWeight +
    day.respiteCount * weights.respiteWeight +
    day.shortStayCount * weights.shortStayWeight +
    day.attentionCount * weights.attentionWeight -
    day.availableSlots * weights.availableSlotWeight;

  // 変動対応負荷ペナルティを加算
  raw += day.absenceCount * weights.absencePenalty;
  raw += day.lateCount * weights.latePenalty;
  // existingLeaveCountがオプショナル（未設定）の場合は0として扱う
  raw += (day.existingLeaveCount ?? 0) * weights.existingLeavePenalty;

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
  weekSummary?: readonly DaySummaryEntry[],
): LeaveSuggestion[] {
  // dateIso → DaySummaryEntry lookup for reason computation
  const summaryMap = new Map<string, DaySummaryEntry>();
  if (weekSummary) {
    for (const s of weekSummary) {
      summaryMap.set(s.dateIso, s);
    }
  }

  return loadScores
    .filter((d) => d.leaveEligibility !== 'unavailable')
    .sort((a, b) => a.score - b.score)
    .slice(0, maxSuggestions)
    .map((d, i) => {
      const summary = summaryMap.get(d.dateIso);
      return {
        dateIso: d.dateIso,
        score: d.score,
        level: d.level,
        rank: i + 1,
        reasons: summary ? computeLeaveReasons(summary) : [],
      };
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Leave Reason Computation (Phase 3-C)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 年休推奨理由を算出する。
 * DaySummaryEntry の各フィールドを分析し、最も説得力のある理由を
 * 優先度順に最大2つ返す。
 *
 * 理由の優先度:
 *   1. 利用者が非常に少ない（totalCount <= 5）
 *   2. 空き枠に余裕あり（availableSlots >= 10）
 *   3. 注意対象なし（attentionCount === 0）
 *   4. ショートステイなし（shortStayCount === 0）
 *   5. レスパイトなし（respiteCount === 0）
 *   6. 利用者が少なめ（totalCount <= 10）
 *
 * @param day - 日別集計データ
 * @param maxReasons - 最大理由数（デフォルト 2）
 * @returns LeaveReason[]
 */
export function computeLeaveReasons(
  day: DaySummaryEntry,
  maxReasons: number = 2,
): LeaveReason[] {
  const candidates: LeaveReason[] = [];

  // 優先度順に候補を追加
  if (day.totalCount <= 5) {
    candidates.push({ key: 'very-low-total', label: '利用人数がとても少ない' });
  } else if (day.totalCount <= 10) {
    // 後で追加（優先度低め）
  }

  if (day.availableSlots >= 10) {
    candidates.push({ key: 'high-availability', label: '空き枠に余裕あり' });
  }

  if (day.attentionCount === 0) {
    candidates.push({ key: 'no-attention', label: '注意対象なし' });
  }

  if (day.shortStayCount === 0) {
    candidates.push({ key: 'no-short-stay', label: 'ショートステイなし' });
  }

  if (day.respiteCount === 0) {
    candidates.push({ key: 'no-respite', label: 'レスパイトなし' });
  }

  // 低優先の「少なめ」（very-low が既に入っていなければ）
  if (
    day.totalCount > 5 &&
    day.totalCount <= 10 &&
    !candidates.some((c) => c.key === 'very-low-total')
  ) {
    candidates.push({ key: 'low-total', label: '利用人数が少なめ' });
  }

  return candidates.slice(0, maxReasons);
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// High Load Warnings (Phase 4-A-1)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 高負荷日の警告理由を算出する。
 * 「なぜこの日が危険か」を優先度順に最大2つ返す。
 *
 * 理由の優先度:
 *   1. 定員超過（isOverCapacity）
 *   2. 空き枠なし（availableSlots === 0）
 *   3. 注意対象が多い（attentionCount >= 5）
 *   4. レスパイトが多い（respiteCount >= 3）
 *   5. ショートステイが多い（shortStayCount >= 2）
 *   6. 利用者が非常に多い（totalCount >= 20）
 *
 * @param day - 日別集計データ
 * @param maxReasons - 最大理由数（デフォルト 2）
 * @returns LeaveReason[]
 */
export function computeHighLoadReasons(
  day: DaySummaryEntry,
  maxReasons: number = 2,
): LeaveReason[] {
  const candidates: LeaveReason[] = [];

  if (day.isOverCapacity) {
    candidates.push({ key: 'over-capacity', label: '定員超過' });
  }

  if (day.availableSlots === 0) {
    candidates.push({ key: 'no-slots', label: '空き枠なし' });
  }

  if (day.attentionCount >= 5) {
    candidates.push({ key: 'many-attention', label: `注意対象${day.attentionCount}名` });
  }

  if (day.respiteCount >= 3) {
    candidates.push({ key: 'many-respite', label: `レスパイト${day.respiteCount}名` });
  }

  if (day.shortStayCount >= 2) {
    candidates.push({ key: 'many-short-stay', label: `ショートステイ${day.shortStayCount}名` });
  }

  if (day.totalCount >= 20) {
    candidates.push({ key: 'very-high-total', label: `利用者${day.totalCount}名` });
  }

  return candidates.slice(0, maxReasons);
}

/**
 * 週間の高負荷警告を抽出する。
 * high / critical な日だけをスコア降順で返す。
 *
 * @param loadScores - DayLoadScore[] (computeWeeklyLoadScores の結果)
 * @param weekSummary - DaySummaryEntry[] (理由算出用)
 * @returns HighLoadWarning[]
 */
export function computeHighLoadWarnings(
  loadScores: readonly DayLoadScore[],
  weekSummary?: readonly DaySummaryEntry[],
): HighLoadWarning[] {
  const summaryMap = new Map<string, DaySummaryEntry>();
  if (weekSummary) {
    for (const s of weekSummary) {
      summaryMap.set(s.dateIso, s);
    }
  }

  return loadScores
    .filter((d): d is DayLoadScore & { level: 'high' | 'critical' } =>
      d.level === 'high' || d.level === 'critical'
    )
    .sort((a, b) => b.score - a.score) // 危険度が高い順
    .map((d) => {
      const summary = summaryMap.get(d.dateIso);
      return {
        dateIso: d.dateIso,
        score: d.score,
        level: d.level,
        reasons: summary ? computeHighLoadReasons(summary) : [],
      };
    });
}

/**
 * suggestionDecisionMetrics — 提案判断の横断メトリクス集計（純粋関数）
 *
 * P3-E: append-only の SuggestionDecisionRecord[] から、
 * id ごとの最新判断を基にした統合メトリクスを算出する。
 *
 * 用途:
 *  - SmartTab / ExcellenceTab のヘッダーバッジ
 *  - 将来: ダッシュボード / 管理者向けの提案有効性分析
 *
 * 依存: getLatestDecisionMap（P3-D helper）
 */

import type { SuggestionDecisionRecord, SuggestionDecisionSource } from '../types';
import { getLatestDecisionMap } from './suggestionDecisionHelpers';

// ────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────

/** アクションごとの件数 */
export type ActionCounts = {
  accepted: number;
  dismissed: number;
  noted: number;
  deferred: number;
  promoted: number;
};

/** source 別の内訳 */
export type SourceBreakdown = {
  smart: ActionCounts;
  memo: ActionCounts;
};

/** 提案判断メトリクス（全体） */
export type SuggestionDecisionMetrics = {
  /** 判断済みの一意な提案数（最新判断のみカウント） */
  totalDecided: number;
  /** アクション別件数 */
  counts: ActionCounts;
  /** SmartTab 採用率: accepted / (accepted + dismissed)。分母0なら 0 */
  acceptanceRate: number;
  /** 改善メモ 昇格率: promoted / (noted + deferred + promoted)。分母0なら 0 */
  promotionRate: number;
  /** source 別内訳 */
  sourceBreakdown: SourceBreakdown;
};

// ────────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────────

const EMPTY_COUNTS: ActionCounts = {
  accepted: 0,
  dismissed: 0,
  noted: 0,
  deferred: 0,
  promoted: 0,
};

function emptySourceBreakdown(): SourceBreakdown {
  return {
    smart: { ...EMPTY_COUNTS },
    memo: { ...EMPTY_COUNTS },
  };
}

function isCountableAction(action: string): action is keyof ActionCounts {
  return action in EMPTY_COUNTS;
}

function safeRate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

// ────────────────────────────────────────────
// メイン集計関数
// ────────────────────────────────────────────

/**
 * SuggestionDecisionRecord[] から横断メトリクスを算出する。
 *
 * 1. `getLatestDecisionMap()` で id ごとの最新レコードを抽出
 * 2. 最新レコードのみを基にカウント
 * 3. acceptanceRate / promotionRate を算出
 *
 * O(n) — records の長さに線形。
 */
export function computeSuggestionDecisionMetrics(
  records: SuggestionDecisionRecord[],
): SuggestionDecisionMetrics {
  const latestMap = getLatestDecisionMap(records);
  const counts: ActionCounts = { ...EMPTY_COUNTS };
  const breakdown = emptySourceBreakdown();

  for (const record of latestMap.values()) {
    const { action, source } = record;

    // 全体カウント
    if (isCountableAction(action)) {
      counts[action]++;
    }

    // source 別カウント
    if (source in breakdown && isCountableAction(action)) {
      breakdown[source as SuggestionDecisionSource][action]++;
    }
  }

  const totalDecided = latestMap.size;

  // SmartTab 採用率: accepted / (accepted + dismissed)
  const smartDenominator = counts.accepted + counts.dismissed;
  const acceptanceRate = safeRate(counts.accepted, smartDenominator);

  // 改善メモ 昇格率: promoted / (noted + deferred + promoted)
  const memoDenominator = counts.noted + counts.deferred + counts.promoted;
  const promotionRate = safeRate(counts.promoted, memoDenominator);

  return {
    totalDecided,
    counts,
    acceptanceRate,
    promotionRate,
    sourceBreakdown: breakdown,
  };
}

// ────────────────────────────────────────────
// 表示用ヘルパー
// ────────────────────────────────────────────

/** パーセンテージ表示用フォーマッタ（0-100%, 小数点1桁） */
export function formatRate(rate: number): string {
  if (rate === 0) return '0%';
  return `${(rate * 100).toFixed(1).replace(/\.0$/, '')}%`;
}

/** メトリクスが実質空（何も判断されていない）かを判定 */
export function isMetricsEmpty(metrics: SuggestionDecisionMetrics): boolean {
  return metrics.totalDecided === 0;
}

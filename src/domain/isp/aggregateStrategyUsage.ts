/**
 * aggregateStrategyUsage — 日常記録の referencedStrategies を集計
 *
 * BehaviorObservation[] を受け取り、カテゴリ別 × 戦略テキスト別の
 * 実施回数を返す Pure function。
 *
 * Phase C-3a: 支援計画シートに実施回数を表示するための基盤。
 *
 * @module domain/isp/aggregateStrategyUsage
 */

import type { StrategyCategory } from '@/domain/behavior';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** 個別戦略の集計結果 */
export interface StrategyUsageEntry {
  /** 戦略テキスト（スナップショット） */
  text: string;
  /** カテゴリ */
  category: StrategyCategory;
  /** 実施回数 */
  count: number;
}

/** カテゴリ別の集計サマリー */
export interface StrategyUsageSummary {
  /** 先行事象戦略の実施回数マップ (text → count) */
  antecedent: Map<string, number>;
  /** 教授戦略の実施回数マップ (text → count) */
  teaching: Map<string, number>;
  /** 後続事象戦略の実施回数マップ (text → count) */
  consequence: Map<string, number>;
  /** 総実施回数 */
  totalApplications: number;
  /** 集計対象レコード数 */
  recordsWithStrategies: number;
}

/** 集計オプション */
export interface AggregateOptions {
  /** 期間開始（ISO string）。指定時はこの日時以降のみ集計 */
  fromDate?: string;
  /** 期間終了（ISO string）。指定時はこの日時以前のみ集計 */
  toDate?: string;
}

// ─────────────────────────────────────────────
// 入力の最小型（BehaviorObservation の該当フィールドのみ）
// ─────────────────────────────────────────────

interface RecordWithStrategies {
  recordedAt: string;
  referencedStrategies?: ReadonlyArray<{
    strategyKey: StrategyCategory;
    strategyText: string;
    applied: boolean;
  }>;
}

// ─────────────────────────────────────────────
// Core function
// ─────────────────────────────────────────────

/**
 * 日常記録から applied な戦略を集計する。
 *
 * @param records - BehaviorObservation 配列（referencedStrategies を持つもの）
 * @param options - 期間フィルタ（省略時は全期間）
 * @returns カテゴリ別 × テキスト別の実施回数
 */
export function aggregateStrategyUsage(
  records: readonly RecordWithStrategies[],
  options: AggregateOptions = {},
): StrategyUsageSummary {
  const { fromDate, toDate } = options;
  const fromMs = fromDate ? new Date(fromDate).getTime() : -Infinity;
  const toMs = toDate ? new Date(toDate).getTime() : Infinity;

  const antecedent = new Map<string, number>();
  const teaching = new Map<string, number>();
  const consequence = new Map<string, number>();

  let totalApplications = 0;
  let recordsWithStrategies = 0;

  for (const record of records) {
    const strategies = record.referencedStrategies;
    if (!strategies || strategies.length === 0) continue;

    // 期間フィルタ
    const recordMs = new Date(record.recordedAt).getTime();
    if (recordMs < fromMs || recordMs > toMs) continue;

    const appliedStrategies = strategies.filter((s) => s.applied);
    if (appliedStrategies.length === 0) continue;

    recordsWithStrategies++;

    for (const strategy of appliedStrategies) {
      totalApplications++;

      const target =
        strategy.strategyKey === 'antecedent'
          ? antecedent
          : strategy.strategyKey === 'teaching'
            ? teaching
            : consequence;

      target.set(strategy.strategyText, (target.get(strategy.strategyText) ?? 0) + 1);
    }
  }

  return { antecedent, teaching, consequence, totalApplications, recordsWithStrategies };
}

// ─────────────────────────────────────────────
// Helper: 特定戦略テキストの実施回数を取得
// ─────────────────────────────────────────────

/**
 * StrategyUsageSummary から特定テキストの実施回数を返す。
 * 見つからなければ 0。
 */
export function getUsageCount(
  summary: StrategyUsageSummary,
  category: StrategyCategory,
  text: string,
): number {
  const map =
    category === 'antecedent'
      ? summary.antecedent
      : category === 'teaching'
        ? summary.teaching
        : summary.consequence;
  return map.get(text) ?? 0;
}

/**
 * カテゴリ全体の実施回数合計を返す。
 */
export function getCategoryTotal(
  summary: StrategyUsageSummary,
  category: StrategyCategory,
): number {
  const map =
    category === 'antecedent'
      ? summary.antecedent
      : category === 'teaching'
        ? summary.teaching
        : summary.consequence;
  let total = 0;
  for (const count of map.values()) {
    total += count;
  }
  return total;
}

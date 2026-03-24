/**
 * aggregateStrategyUsage — 日常記録の referencedStrategies を集計
 *
 * ABCRecord[] を受け取り、カテゴリ別 × 戦略テキスト別の
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
// 入力の最小型（ABCRecord の該当フィールドのみ）
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
 * @param records - ABCRecord 配列（referencedStrategies を持つもの）
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

// ─────────────────────────────────────────────
// Phase C-3b: トレンド比較
// ─────────────────────────────────────────────

/** トレンド方向 */
export type StrategyTrend = 'up' | 'down' | 'flat';

/** 戦略別のトレンド項目 */
export interface StrategyUsageTrendItem {
  /** カテゴリ */
  strategyKey: StrategyCategory;
  /** 戦略テキスト（スナップショット） */
  strategyText: string;
  /** 今期間の実施回数 */
  currentCount: number;
  /** 前期間の実施回数 */
  previousCount: number;
  /** 増減数（current - previous） */
  delta: number;
  /** トレンド方向 */
  trend: StrategyTrend;
}

/** トレンド集計の全体結果 */
export interface StrategyUsageTrendResult {
  /** 戦略別のトレンド項目 */
  items: StrategyUsageTrendItem[];
  /** 全体の合計トレンド */
  totals: {
    currentCount: number;
    previousCount: number;
    delta: number;
    trend: StrategyTrend;
  };
}

/**
 * delta から trend 方向を判定する。
 */
function deriveTrend(delta: number): StrategyTrend {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'flat';
}

/**
 * 日常記録を current / previous の2期間に分けて、
 * 戦略テキスト別のトレンドを算出する。
 *
 * - records を日付で2つのウィンドウに分ける
 * - `referencedStrategies?.applied === true` のみカウント
 * - `strategyKey + strategyText` 単位で集計
 * - delta と trend を作る
 *
 * @param records    - 全レコード（2期間分をまとめて渡す）
 * @param currentFrom  - 今期間の開始 ISO string
 * @param currentTo    - 今期間の終了 ISO string
 * @param previousFrom - 前期間の開始 ISO string
 * @param previousTo   - 前期間の終了 ISO string
 */
export function compareStrategyUsage(
  records: readonly RecordWithStrategies[],
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string,
): StrategyUsageTrendResult {
  const currentSummary = aggregateStrategyUsage(records, {
    fromDate: currentFrom,
    toDate: currentTo,
  });
  const previousSummary = aggregateStrategyUsage(records, {
    fromDate: previousFrom,
    toDate: previousTo,
  });

  // ── 全 strategyKey × strategyText を収集 ──
  const categories: StrategyCategory[] = ['antecedent', 'teaching', 'consequence'];
  const seen = new Map<string, { key: StrategyCategory; text: string }>();

  for (const cat of categories) {
    for (const text of currentSummary[cat].keys()) {
      seen.set(`${cat}:${text}`, { key: cat, text });
    }
    for (const text of previousSummary[cat].keys()) {
      const k = `${cat}:${text}`;
      if (!seen.has(k)) {
        seen.set(k, { key: cat, text });
      }
    }
  }

  // ── items を生成 ──
  const items: StrategyUsageTrendItem[] = [];

  for (const { key: strategyKey, text: strategyText } of seen.values()) {
    const curMap = currentSummary[strategyKey];
    const prevMap = previousSummary[strategyKey];
    const currentCount = curMap.get(strategyText) ?? 0;
    const previousCount = prevMap.get(strategyText) ?? 0;
    const delta = currentCount - previousCount;

    items.push({
      strategyKey,
      strategyText,
      currentCount,
      previousCount,
      delta,
      trend: deriveTrend(delta),
    });
  }

  // ── totals ──
  const totalCurrent = currentSummary.totalApplications;
  const totalPrevious = previousSummary.totalApplications;
  const totalDelta = totalCurrent - totalPrevious;

  return {
    items,
    totals: {
      currentCount: totalCurrent,
      previousCount: totalPrevious,
      delta: totalDelta,
      trend: deriveTrend(totalDelta),
    },
  };
}

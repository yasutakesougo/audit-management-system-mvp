/**
 * @fileoverview 行動タグインサイトの集計ロジック（pure function）
 * @description
 * visibleRows の behaviorTags を集計し、Top5 / 平均タグ数 / タグ付与率 を返す。
 * 全行タグなし or 行が空 → null を返す（Insight bar 非表示）。
 *
 * SSOT: 表示ラベルは behaviorTag.ts の getTagLabel() から取得。
 */ // contract:allow-interface

import { BEHAVIOR_TAGS, type BehaviorTagKey } from './behaviorTag';

// ─── 型定義 ──────────────────────────────────────────────

/** 入力の最小型（UserRowData の部分型でテスト軽量化） */
export type BehaviorTagInsightInput = {
  behaviorTags: string[];
};

/** Insight 計算結果 */
export type BehaviorTagInsights = {
  /** 使用頻度 Top タグ（最大5件）。key & label & count 付き */
  topTags: { key: string; label: string; count: number }[];
  /** 1記録あたりの平均タグ数（小数1桁） */
  avgTagsPerRow: number;
  /** タグが1つ以上ある行の割合（0〜100 の整数%） */
  tagUsageRate: number;
  /** 計算対象の行数 */
  totalRows: number;
  /** タグが1つ以上ある行数 */
  taggedRows: number;
};

// ─── 定数 ────────────────────────────────────────────────

const MAX_TOP_TAGS = 5;

// ─── 集計関数 ────────────────────────────────────────────

/**
 * 行動タグの使用状況を集計する。
 * @returns null の場合は Insight bar を非表示にすべき。
 */
export function computeBehaviorTagInsights(
  rows: BehaviorTagInsightInput[],
): BehaviorTagInsights | null {
  if (rows.length === 0) return null;

  // --- タグ付き行数を数える ---
  const taggedRows = rows.filter(r => (r.behaviorTags ?? []).length > 0).length;
  if (taggedRows === 0) return null;

  // --- 全タグをフラットにして頻度を数える ---
  const freq = new Map<string, number>();
  let totalTags = 0;

  for (const row of rows) {
    for (const tag of (row.behaviorTags ?? [])) {
      freq.set(tag, (freq.get(tag) ?? 0) + 1);
      totalTags++;
    }
  }

  // --- Top タグ（最大5件、count 降順） ---
  const sorted = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TOP_TAGS);

  const topTags = sorted.map(([key, count]) => {
    const def = BEHAVIOR_TAGS[key as BehaviorTagKey];
    return {
      key,
      label: def?.label ?? key,
      count,
    };
  });

  // --- 指標計算 ---
  const avgTagsPerRow = Math.round((totalTags / rows.length) * 10) / 10;
  const tagUsageRate = Math.round((taggedRows / rows.length) * 100);

  return {
    topTags,
    avgTagsPerRow,
    tagUsageRate,
    totalRows: rows.length,
    taggedRows,
  };
}

/**
 * @fileoverview 行動タグ × 問題行動 × 活動スロット クロス集計（pure function）
 * @description
 * UserRowData の behaviorTags / problemBehavior / amActivity / pmActivity を
 * 掛け合わせて共起傾向を算出する。
 *
 * Phase 1 スコープ:
 * - A. タグ別の問題行動併発率
 * - B. 活動スロット（AM/PM）別の Top3 タグ
 * - C. 問題行動あり/なし別の平均タグ数
 *
 * 因果推定・予測は行わない（共起分析のみ）。
 */ // contract:allow-interface

import { BEHAVIOR_TAGS, type BehaviorTagKey } from './behaviorTag';

// ─── 型定義 ──────────────────────────────────────────────

/** 入力の最小型（UserRowData の部分型でテスト軽量化） */
export type CrossInsightInput = {
  behaviorTags: string[];
  problemBehavior: {
    selfHarm: boolean;
    otherInjury: boolean;
    loudVoice: boolean;
    pica: boolean;
    other: boolean;
  };
  amActivity: string;
  pmActivity: string;
};

/** A. タグ別問題行動併発率 */
export type TagProblemRate = {
  tagKey: string;
  tagLabel: string;
  total: number;
  withProblem: number;
  rate: number; // 0–100 整数%
};

/** B. スロット別タグ頻度 */
export type SlotTagFrequency = {
  slot: 'am' | 'pm';
  slotLabel: string;
  topTags: { tagKey: string; tagLabel: string; count: number }[];
  totalRows: number;
};

/** C. 問題行動あり/なし別平均タグ数 */
export type AvgTagsByProblem = {
  withProblem: number;    // 小数1桁
  withoutProblem: number; // 小数1桁
};

/** クロス集計の全結果 */
export type BehaviorTagCrossInsights = {
  tagProblemRates: TagProblemRate[];
  slotTagFrequency: SlotTagFrequency[];
  avgTagsByProblem: AvgTagsByProblem;
  totalRows: number;
  taggedRows: number;
};

// ─── ヘルパー ────────────────────────────────────────────

const MAX_SLOT_TOP_TAGS = 3;

/** 問題行動フラグが 1 つでも true なら「あり」 */
export function hasProblemBehavior(
  pb: CrossInsightInput['problemBehavior'],
): boolean {
  return Object.values(pb).some(v => v === true);
}

function getLabel(key: string): string {
  const def = BEHAVIOR_TAGS[key as BehaviorTagKey];
  return def?.label ?? key;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ─── メイン集計 ──────────────────────────────────────────

export function computeBehaviorTagCrossInsights(
  rows: CrossInsightInput[],
): BehaviorTagCrossInsights | null {
  if (rows.length === 0) return null;

  const taggedRows = rows.filter(r => r.behaviorTags.length > 0).length;
  if (taggedRows === 0) return null;

  // ── A. タグ別 問題行動併発率 ──

  const tagTotal = new Map<string, number>();
  const tagWithProblem = new Map<string, number>();

  for (const row of rows) {
    const hasPB = hasProblemBehavior(row.problemBehavior);
    for (const tag of row.behaviorTags) {
      tagTotal.set(tag, (tagTotal.get(tag) ?? 0) + 1);
      if (hasPB) {
        tagWithProblem.set(tag, (tagWithProblem.get(tag) ?? 0) + 1);
      }
    }
  }

  const tagProblemRates: TagProblemRate[] = [...tagTotal.entries()]
    .map(([tagKey, total]) => {
      const withProblem = tagWithProblem.get(tagKey) ?? 0;
      return {
        tagKey,
        tagLabel: getLabel(tagKey),
        total,
        withProblem,
        rate: Math.round((withProblem / total) * 100),
      };
    })
    .sort((a, b) => b.rate - a.rate || b.total - a.total);

  // ── B. 活動スロット別 Top3 タグ ──
  // AM/PM 両方に値があれば両方にカウント

  const slotTagFrequency: SlotTagFrequency[] = (
    [
      { slot: 'am' as const, slotLabel: '午前' },
      { slot: 'pm' as const, slotLabel: '午後' },
    ] as const
  ).map(({ slot, slotLabel }) => {
    const slotRows = rows.filter(r =>
      slot === 'am'
        ? r.amActivity.trim() !== ''
        : r.pmActivity.trim() !== '',
    );

    const freq = new Map<string, number>();
    for (const row of slotRows) {
      for (const tag of row.behaviorTags) {
        freq.set(tag, (freq.get(tag) ?? 0) + 1);
      }
    }

    const topTags = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SLOT_TOP_TAGS)
      .map(([tagKey, count]) => ({
        tagKey,
        tagLabel: getLabel(tagKey),
        count,
      }));

    return { slot, slotLabel, topTags, totalRows: slotRows.length };
  });

  // ── C. 問題行動あり/なし別 平均タグ数 ──

  let pbYesTagSum = 0;
  let pbYesCount = 0;
  let pbNoTagSum = 0;
  let pbNoCount = 0;

  for (const row of rows) {
    if (hasProblemBehavior(row.problemBehavior)) {
      pbYesTagSum += row.behaviorTags.length;
      pbYesCount++;
    } else {
      pbNoTagSum += row.behaviorTags.length;
      pbNoCount++;
    }
  }

  const avgTagsByProblem: AvgTagsByProblem = {
    withProblem: pbYesCount > 0 ? round1(pbYesTagSum / pbYesCount) : 0,
    withoutProblem: pbNoCount > 0 ? round1(pbNoTagSum / pbNoCount) : 0,
  };

  return {
    tagProblemRates,
    slotTagFrequency,
    avgTagsByProblem,
    totalRows: rows.length,
    taggedRows,
  };
}

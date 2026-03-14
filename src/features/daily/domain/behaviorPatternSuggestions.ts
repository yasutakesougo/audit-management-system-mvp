/**
 * @fileoverview ルールベース行動パターン提案エンジン（pure function）
 * @description
 * Issue #7 の BehaviorTagCrossInsights を入力に、ルールベースで示唆文を生成する。
 *
 * 原則:
 * - 「示唆」であり「断定」ではない
 * - 因果の断定はしない（「〜の傾向がみられます」）
 * - 行動指示はしない（「確認してみてください」程度まで）
 * - 福祉用語で表現する
 */ // contract:allow-interface

import { BEHAVIOR_TAGS, type BehaviorTagKey } from './behaviorTag';
import type { BehaviorTagCrossInsights } from './behaviorTagCrossInsights';

// ─── 型定義 ──────────────────────────────────────────────

export type SuggestionSeverity = 'info' | 'notice' | 'highlight';

export type SuggestionCategory =
  | 'co-occurrence'
  | 'slot-bias'
  | 'tag-density'
  | 'positive-signal';

export type PatternSuggestion = {
  /** ルール識別子（テスト・ログ用） */
  ruleId: string;
  /** 示唆のカテゴリ */
  category: SuggestionCategory;
  /** 重要度 */
  severity: SuggestionSeverity;
  /** 表示メッセージ（示唆文） */
  message: string;
  /** 関連タグキー（チップ表示用） */
  relatedTags: string[];
  /** 根拠データ（「なぜこの提案が出たか」を説明） */
  evidence: string;
};

// ─── 定数 ────────────────────────────────────────────────

const MAX_SUGGESTIONS = 3;
const HIGH_RATE_THRESHOLD = 50;
const MIN_TOTAL_FOR_RULE = 2;
const CONFIDENT_TOTAL = 4;
const TAG_DENSITY_GAP_THRESHOLD = 1.0;
const POSITIVE_RATE_CEILING = 30;

/** positive カテゴリのタグキー */
const POSITIVE_TAG_KEYS: ReadonlySet<string> = new Set(
  (Object.entries(BEHAVIOR_TAGS) as [BehaviorTagKey, (typeof BEHAVIOR_TAGS)[BehaviorTagKey]][])
    .filter(([, def]) => def.category === 'positive')
    .map(([key]) => key),
);


// ─── ルール関数 ──────────────────────────────────────────

type RuleFn = (insights: BehaviorTagCrossInsights) => PatternSuggestion[];

/**
 * Rule 1: 高併発率タグ
 * rate >= 50% & total >= 2 のタグに対して示唆を出す。
 * total 2-3 のときは「件数はまだ少ないですが」と前置きする。
 */
const ruleHighCoOccurrence: RuleFn = (insights) => {
  return insights.tagProblemRates
    .filter(t => t.rate >= HIGH_RATE_THRESHOLD && t.total >= MIN_TOTAL_FOR_RULE)
    .map(t => {
      const isConfident = t.total >= CONFIDENT_TOTAL;
      const prefix = isConfident
        ? `「${t.tagLabel}」が記録されている場面の ${t.rate}% で問題行動が見られます。`
        : `件数はまだ少ないですが、「${t.tagLabel}」が記録されている場面の ${t.rate}% で問題行動がみられる傾向です。`;
      const message = `${prefix}環境や状況の確認を検討してみてください`;

      return {
        ruleId: `highCoOccurrence:${t.tagKey}`,
        category: 'co-occurrence' as const,
        severity: 'notice' as const,
        message,
        relatedTags: [t.tagKey],
        evidence: `${t.tagLabel}: ${t.withProblem}/${t.total}件 (${t.rate}%)`,
      };
    });
};

/**
 * Rule 2: 時間帯偏り
 * AM Top1 ≠ PM Top1 のとき（各2行以上）
 */
const ruleSlotBias: RuleFn = (insights) => {
  const am = insights.slotTagFrequency.find(s => s.slot === 'am');
  const pm = insights.slotTagFrequency.find(s => s.slot === 'pm');

  if (!am || !pm) return [];
  if (am.totalRows < 2 || pm.totalRows < 2) return [];
  if (am.topTags.length === 0 || pm.topTags.length === 0) return [];

  const amTop = am.topTags[0];
  const pmTop = pm.topTags[0];

  if (amTop.tagKey === pmTop.tagKey) return [];

  return [{
    ruleId: 'slotBias',
    category: 'slot-bias' as const,
    severity: 'info' as const,
    message: `午前は「${amTop.tagLabel}」、午後は「${pmTop.tagLabel}」の記録が目立ちます。時間帯による行動の変化がみられます`,
    relatedTags: [amTop.tagKey, pmTop.tagKey],
    evidence: `午前Top: ${amTop.tagLabel}(${amTop.count}件/${am.totalRows}行), 午後Top: ${pmTop.tagLabel}(${pmTop.count}件/${pm.totalRows}行)`,
  }];
};

/**
 * Rule 3: タグ密度差
 * 問題行動あり平均 - なし平均 >= 1.0
 */
const ruleTagDensityGap: RuleFn = (insights) => {
  const { withProblem, withoutProblem } = insights.avgTagsByProblem;
  const gap = withProblem - withoutProblem;

  if (gap < TAG_DENSITY_GAP_THRESHOLD) return [];

  return [{
    ruleId: 'tagDensityGap',
    category: 'tag-density' as const,
    severity: 'notice' as const,
    message: `問題行動がある記録は平均 ${withProblem} 個のタグが付いており、ない記録（${withoutProblem} 個）より多い傾向です`,
    relatedTags: [],
    evidence: `問題行動あり: 平均${withProblem}個, なし: 平均${withoutProblem}個 (差: ${Math.round(gap * 10) / 10})`,
  }];
};

/**
 * Rule 4: ポジティブタグ検出
 * positive カテゴリのタグが tagProblemRates に存在し rate < 30%
 */
const rulePositiveSignal: RuleFn = (insights) => {
  return insights.tagProblemRates
    .filter(t => POSITIVE_TAG_KEYS.has(t.tagKey) && t.rate < POSITIVE_RATE_CEILING)
    .map(t => ({
      ruleId: `positiveSignal:${t.tagKey}`,
      category: 'positive-signal' as const,
      severity: 'highlight' as const,
      message: `「${t.tagLabel}」が記録されており、問題行動との併発は少ない傾向です。安定した関わりや工夫が機能している可能性があります`,
      relatedTags: [t.tagKey],
      evidence: `${t.tagLabel}: 併発率${t.rate}% (${t.withProblem}/${t.total}件)`,
    }));
};

// ─── ルール一覧（評価順） ────────────────────────────────

const RULES: RuleFn[] = [
  ruleHighCoOccurrence,
  ruleSlotBias,
  ruleTagDensityGap,
  rulePositiveSignal,
];

// ─── メイン関数 ──────────────────────────────────────────

/**
 * クロス集計結果からルールベースの示唆を生成する。
 * @returns 最大 MAX_SUGGESTIONS 件の示唆。0件なら空配列。
 */
export function generatePatternSuggestions(
  insights: BehaviorTagCrossInsights | null,
): PatternSuggestion[] {
  if (!insights) return [];

  const all: PatternSuggestion[] = [];

  for (const rule of RULES) {
    all.push(...rule(insights));
    if (all.length >= MAX_SUGGESTIONS) break;
  }

  return all.slice(0, MAX_SUGGESTIONS);
}

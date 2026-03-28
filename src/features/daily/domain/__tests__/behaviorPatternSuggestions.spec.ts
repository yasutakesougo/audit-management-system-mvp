import { describe, expect, it } from 'vitest';
import {
  generatePatternSuggestions,
} from '../behavior/behaviorPatternSuggestions';
import type { BehaviorTagCrossInsights } from '../behavior/behaviorTagCrossInsights';

// ─── ヘルパー ────────────────────────────────────────────

/** 最小の BehaviorTagCrossInsights を組み立てるビルダー */
function baseInsights(
  overrides: Partial<BehaviorTagCrossInsights> = {},
): BehaviorTagCrossInsights {
  return {
    tagProblemRates: [],
    slotTagFrequency: [
      { slot: 'am', slotLabel: '午前', topTags: [], totalRows: 0 },
      { slot: 'pm', slotLabel: '午後', topTags: [], totalRows: 0 },
    ],
    avgTagsByProblem: { withProblem: 0, withoutProblem: 0 },
    totalRows: 5,
    taggedRows: 3,
    ...overrides,
  };
}

// ─── テスト ──────────────────────────────────────────────

describe('generatePatternSuggestions', () => {
  // ケース 1
  it('insights が null なら空配列', () => {
    expect(generatePatternSuggestions(null)).toEqual([]);
  });

  // ケース 2
  it('全タグの rate < 50 なら Rule 1 (highCoOccurrence) は不発火', () => {
    const insights = baseInsights({
      tagProblemRates: [
        { tagKey: 'panic', tagLabel: 'パニック', total: 5, withProblem: 2, rate: 40 },
      ],
    });
    const results = generatePatternSuggestions(insights);
    expect(results.find(r => r.ruleId.startsWith('highCoOccurrence'))).toBeUndefined();
  });

  // ケース 3
  it('rate = 50, total = 2 なら Rule 1 発火（件数少ない文言）', () => {
    const insights = baseInsights({
      tagProblemRates: [
        { tagKey: 'panic', tagLabel: 'パニック', total: 2, withProblem: 1, rate: 50 },
      ],
    });
    const results = generatePatternSuggestions(insights);
    const r1 = results.find(r => r.ruleId === 'highCoOccurrence:panic');
    expect(r1).toBeDefined();
    expect(r1!.message).toContain('件数はまだ少ないですが');
    expect(r1!.evidence).toContain('パニック');
  });

  // ケース 4
  it('rate = 50 だが total = 1 なら Rule 1 不発火（データ不足）', () => {
    const insights = baseInsights({
      tagProblemRates: [
        { tagKey: 'panic', tagLabel: 'パニック', total: 1, withProblem: 1, rate: 100 },
      ],
    });
    const results = generatePatternSuggestions(insights);
    expect(results.find(r => r.ruleId.startsWith('highCoOccurrence'))).toBeUndefined();
  });

  // ケース 5
  it('AM/PM の Top1 が異なると Rule 2 (slotBias) 発火', () => {
    const insights = baseInsights({
      slotTagFrequency: [
        {
          slot: 'am', slotLabel: '午前', totalRows: 3,
          topTags: [{ tagKey: 'panic', tagLabel: 'パニック', count: 2 }],
        },
        {
          slot: 'pm', slotLabel: '午後', totalRows: 3,
          topTags: [{ tagKey: 'cooperation', tagLabel: '協力行動', count: 2 }],
        },
      ],
    });
    const results = generatePatternSuggestions(insights);
    const r2 = results.find(r => r.ruleId === 'slotBias');
    expect(r2).toBeDefined();
    expect(r2!.message).toContain('午前');
    expect(r2!.message).toContain('午後');
    expect(r2!.relatedTags).toContain('panic');
    expect(r2!.relatedTags).toContain('cooperation');
  });

  // ケース 6
  it('AM/PM の Top1 が同じなら Rule 2 不発火', () => {
    const insights = baseInsights({
      slotTagFrequency: [
        {
          slot: 'am', slotLabel: '午前', totalRows: 3,
          topTags: [{ tagKey: 'panic', tagLabel: 'パニック', count: 2 }],
        },
        {
          slot: 'pm', slotLabel: '午後', totalRows: 3,
          topTags: [{ tagKey: 'panic', tagLabel: 'パニック', count: 2 }],
        },
      ],
    });
    const results = generatePatternSuggestions(insights);
    expect(results.find(r => r.ruleId === 'slotBias')).toBeUndefined();
  });

  // ケース 7
  it('withProblem - withoutProblem >= 1.0 なら Rule 3 (tagDensityGap) 発火', () => {
    const insights = baseInsights({
      avgTagsByProblem: { withProblem: 2.5, withoutProblem: 0.8 },
    });
    const results = generatePatternSuggestions(insights);
    const r3 = results.find(r => r.ruleId === 'tagDensityGap');
    expect(r3).toBeDefined();
    expect(r3!.message).toContain('2.5');
    expect(r3!.message).toContain('0.8');
  });

  // ケース 8
  it('positive タグあり rate < 30 なら Rule 4 (positiveSignal) 発火', () => {
    const insights = baseInsights({
      tagProblemRates: [
        { tagKey: 'cooperation', tagLabel: '協力行動', total: 5, withProblem: 1, rate: 20 },
      ],
    });
    const results = generatePatternSuggestions(insights);
    const r4 = results.find(r => r.ruleId === 'positiveSignal:cooperation');
    expect(r4).toBeDefined();
    expect(r4!.severity).toBe('highlight');
    expect(r4!.message).toContain('機能している可能性');
  });

  // ケース 9
  it('4件以上ヒットしても最大 3件に切り詰められる', () => {
    const insights = baseInsights({
      tagProblemRates: [
        { tagKey: 'panic', tagLabel: 'パニック', total: 4, withProblem: 3, rate: 75 },
        { tagKey: 'sensory', tagLabel: '感覚過敏', total: 4, withProblem: 3, rate: 75 },
        { tagKey: 'elopement', tagLabel: '離席・離園', total: 4, withProblem: 3, rate: 75 },
        { tagKey: 'verbalRequest', tagLabel: '言語要求', total: 4, withProblem: 3, rate: 75 },
      ],
      avgTagsByProblem: { withProblem: 3.0, withoutProblem: 0.5 },
    });
    const results = generatePatternSuggestions(insights);
    expect(results.length).toBeLessThanOrEqual(3);
  });

  // ケース 10
  it('全ルール不発火なら空配列', () => {
    const insights = baseInsights({
      tagProblemRates: [
        { tagKey: 'panic', tagLabel: 'パニック', total: 5, withProblem: 1, rate: 20 },
      ],
      slotTagFrequency: [
        {
          slot: 'am', slotLabel: '午前', totalRows: 1,
          topTags: [{ tagKey: 'panic', tagLabel: 'パニック', count: 1 }],
        },
        {
          slot: 'pm', slotLabel: '午後', totalRows: 1,
          topTags: [{ tagKey: 'sensory', tagLabel: '感覚過敏', count: 1 }],
        },
      ],
      avgTagsByProblem: { withProblem: 1.0, withoutProblem: 0.5 },
    });
    const results = generatePatternSuggestions(insights);
    expect(results).toEqual([]);
  });

  // ケース 3 補足: total >= 4 でのより強い文言
  it('total >= 4 & rate >= 50 なら確信度の高い文言', () => {
    const insights = baseInsights({
      tagProblemRates: [
        { tagKey: 'panic', tagLabel: 'パニック', total: 6, withProblem: 4, rate: 67 },
      ],
    });
    const results = generatePatternSuggestions(insights);
    const r1 = results.find(r => r.ruleId === 'highCoOccurrence:panic');
    expect(r1).toBeDefined();
    expect(r1!.message).not.toContain('件数はまだ少ないですが');
    expect(r1!.message).toContain('67%');
  });
});

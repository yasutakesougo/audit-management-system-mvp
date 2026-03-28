import { describe, expect, it } from 'vitest';

import { computeBehaviorTagInsights } from '../behavior/behaviorTagInsights';

describe('computeBehaviorTagInsights', () => {
  // ─── null を返すケース ───────────────────────────────

  it('空配列 → null', () => {
    expect(computeBehaviorTagInsights([])).toBeNull();
  });

  it('全行タグなし → null', () => {
    const rows = [
      { behaviorTags: [] },
      { behaviorTags: [] },
      { behaviorTags: [] },
    ];
    expect(computeBehaviorTagInsights(rows)).toBeNull();
  });

  // ─── 基本計算 ──────────────────────────────────────

  it('基本計算: Top, avgTagsPerRow, tagUsageRate が正しい', () => {
    const rows = [
      { behaviorTags: ['cooperation', 'verbalRequest'] },
      { behaviorTags: ['cooperation'] },
      { behaviorTags: [] },
      { behaviorTags: ['selfRegulation'] },
    ];

    const result = computeBehaviorTagInsights(rows);

    expect(result).not.toBeNull();
    // Top: cooperation=2, verbalRequest=1, selfRegulation=1
    expect(result!.topTags[0]).toEqual({ key: 'cooperation', label: '協力行動', count: 2 });
    expect(result!.topTags).toHaveLength(3);

    // avgTagsPerRow = 4 tags / 4 rows = 1.0
    expect(result!.avgTagsPerRow).toBe(1);

    // tagUsageRate = 3/4 = 75%
    expect(result!.tagUsageRate).toBe(75);

    expect(result!.totalRows).toBe(4);
    expect(result!.taggedRows).toBe(3);
  });

  // ─── Top5 上限 ────────────────────────────────────

  it('6種以上のタグでも Top5 に切り詰める', () => {
    const rows = [
      { behaviorTags: ['panic', 'sensory', 'elopement', 'verbalRequest', 'gestureRequest', 'echolalia'] },
      { behaviorTags: ['panic', 'sensory'] },
    ];

    const result = computeBehaviorTagInsights(rows);
    expect(result).not.toBeNull();
    expect(result!.topTags.length).toBeLessThanOrEqual(5);
  });

  // ─── 小数丸め ─────────────────────────────────────

  it('avgTagsPerRow が小数1桁に丸められる', () => {
    // 5 tags / 3 rows = 1.666... → 1.7
    const rows = [
      { behaviorTags: ['cooperation', 'verbalRequest'] },
      { behaviorTags: ['cooperation', 'selfRegulation'] },
      { behaviorTags: ['panic'] },
    ];

    const result = computeBehaviorTagInsights(rows);
    expect(result!.avgTagsPerRow).toBe(1.7);
  });

  // ─── 整数丸め ─────────────────────────────────────

  it('tagUsageRate が整数%に丸められる', () => {
    // 1/3 = 33.333... → 33%
    const rows = [
      { behaviorTags: ['cooperation'] },
      { behaviorTags: [] },
      { behaviorTags: [] },
    ];

    const result = computeBehaviorTagInsights(rows);
    expect(result!.tagUsageRate).toBe(33);
  });

  // ─── 最小ケース ───────────────────────────────────

  it('1行1タグ → 最小の有効結果', () => {
    const rows = [{ behaviorTags: ['newSkill'] }];

    const result = computeBehaviorTagInsights(rows);
    expect(result).not.toBeNull();
    expect(result!.topTags).toEqual([{ key: 'newSkill', label: '新しいスキル', count: 1 }]);
    expect(result!.avgTagsPerRow).toBe(1);
    expect(result!.tagUsageRate).toBe(100);
    expect(result!.totalRows).toBe(1);
    expect(result!.taggedRows).toBe(1);
  });

  // ─── ソート順 ────────────────────────────────────

  it('Top タグは count 降順でソートされる', () => {
    const rows = [
      { behaviorTags: ['eating', 'cooperation', 'cooperation', 'eating', 'eating'] },
      { behaviorTags: ['panic'] },
    ];

    const result = computeBehaviorTagInsights(rows);
    expect(result!.topTags[0].key).toBe('eating');
    expect(result!.topTags[0].count).toBe(3);
    expect(result!.topTags[1].key).toBe('cooperation');
    expect(result!.topTags[1].count).toBe(2);
    expect(result!.topTags[2].key).toBe('panic');
    expect(result!.topTags[2].count).toBe(1);
  });

  // ─── 未知タグ耐性 ───────────────────────────────────

  it('BEHAVIOR_TAGS に未定義のキーでもフォールバックする', () => {
    const rows = [{ behaviorTags: ['unknownTag'] }];

    const result = computeBehaviorTagInsights(rows);
    expect(result).not.toBeNull();
    expect(result!.topTags[0]).toEqual({ key: 'unknownTag', label: 'unknownTag', count: 1 });
  });
});

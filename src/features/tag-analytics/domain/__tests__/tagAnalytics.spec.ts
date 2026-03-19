/**
 * @fileoverview Phase F1: tagAnalytics pure function テスト
 * @description
 * computeTagCounts / computeTagTrend / computeTagTimeSlots /
 * computeUserTopTags / getTopTagsFromCounts の契約テスト
 */
import { describe, it, expect } from 'vitest';
import {
  computeTagCounts,
  computeTagTrend,
  computeTagTimeSlots,
  computeUserTopTags,
  getTopTagsFromCounts,
  type TagAnalyticsInput,
} from '../tagAnalytics';

// ── ヘルパー ──

const mkRecord = (
  overrides: Partial<TagAnalyticsInput> = {},
): TagAnalyticsInput => ({
  recordDate: '2024-01-01',
  behaviorTags: [],
  activities: { am: '', pm: '' },
  ...overrides,
});

// ═══════════════════════════════════════════════════════════
// computeTagCounts
// ═══════════════════════════════════════════════════════════

describe('computeTagCounts', () => {
  it('空配列 → 空オブジェクト', () => {
    expect(computeTagCounts([])).toEqual({});
  });

  it('タグなし記録のみ → 空オブジェクト', () => {
    const records = [mkRecord(), mkRecord({ behaviorTags: [] })];
    expect(computeTagCounts(records)).toEqual({});
  });

  it('単一タグ → カウント1', () => {
    const records = [mkRecord({ behaviorTags: ['panic'] })];
    expect(computeTagCounts(records)).toEqual({ panic: 1 });
  });

  it('複数記録で同じタグ → 合算', () => {
    const records = [
      mkRecord({ behaviorTags: ['panic'] }),
      mkRecord({ behaviorTags: ['panic', 'cooperation'] }),
      mkRecord({ behaviorTags: ['cooperation'] }),
    ];
    expect(computeTagCounts(records)).toEqual({
      panic: 2,
      cooperation: 2,
    });
  });

  it('同一記録に重複タグ → 個別にカウント', () => {
    const records = [mkRecord({ behaviorTags: ['panic', 'panic', 'panic'] })];
    expect(computeTagCounts(records)).toEqual({ panic: 3 });
  });

  it('behaviorTags が undefined → スキップ', () => {
    const records = [mkRecord({ behaviorTags: undefined })];
    expect(computeTagCounts(records)).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════
// computeTagTrend
// ═══════════════════════════════════════════════════════════

describe('computeTagTrend', () => {
  it('両方空 → 空オブジェクト', () => {
    expect(computeTagTrend({}, {})).toEqual({});
  });

  it('同じカウント → flat', () => {
    expect(computeTagTrend({ panic: 3 }, { panic: 3 })).toEqual({
      panic: { diff: 0, direction: 'flat' },
    });
  });

  it('増加 → up', () => {
    expect(computeTagTrend({ panic: 5 }, { panic: 2 })).toEqual({
      panic: { diff: 3, direction: 'up' },
    });
  });

  it('減少 → down', () => {
    expect(computeTagTrend({ panic: 1 }, { panic: 4 })).toEqual({
      panic: { diff: -3, direction: 'down' },
    });
  });

  it('current にのみ存在 → diff = +count', () => {
    expect(computeTagTrend({ newTag: 3 }, {})).toEqual({
      newTag: { diff: 3, direction: 'up' },
    });
  });

  it('previous にのみ存在 → diff = -count', () => {
    expect(computeTagTrend({}, { oldTag: 2 })).toEqual({
      oldTag: { diff: -2, direction: 'down' },
    });
  });

  it('複数タグ混在', () => {
    const result = computeTagTrend(
      { panic: 5, cooperation: 2 },
      { panic: 3, sensory: 1 },
    );
    expect(result).toEqual({
      panic: { diff: 2, direction: 'up' },
      cooperation: { diff: 2, direction: 'up' },
      sensory: { diff: -1, direction: 'down' },
    });
  });
});

// ═══════════════════════════════════════════════════════════
// computeTagTimeSlots
// ═══════════════════════════════════════════════════════════

describe('computeTagTimeSlots', () => {
  it('空配列 → am/pm 両方空', () => {
    const result = computeTagTimeSlots([]);
    expect(result).toEqual({ am: {}, pm: {} });
  });

  it('タグなし → am/pm 両方空', () => {
    const records = [mkRecord({ activities: { am: '散歩', pm: '創作' } })];
    const result = computeTagTimeSlots(records);
    expect(result).toEqual({ am: {}, pm: {} });
  });

  it('午前のみ活動あり → am にカウント', () => {
    const records = [
      mkRecord({
        behaviorTags: ['panic', 'cooperation'],
        activities: { am: '散歩', pm: '' },
      }),
    ];
    const result = computeTagTimeSlots(records);
    expect(result.am).toEqual({ panic: 1, cooperation: 1 });
    expect(result.pm).toEqual({});
  });

  it('午後のみ活動あり → pm にカウント', () => {
    const records = [
      mkRecord({
        behaviorTags: ['sensory'],
        activities: { am: '', pm: '音楽' },
      }),
    ];
    const result = computeTagTimeSlots(records);
    expect(result.am).toEqual({});
    expect(result.pm).toEqual({ sensory: 1 });
  });

  it('両方活動あり → 両方にカウント', () => {
    const records = [
      mkRecord({
        behaviorTags: ['panic'],
        activities: { am: '散歩', pm: '創作' },
      }),
    ];
    const result = computeTagTimeSlots(records);
    expect(result.am).toEqual({ panic: 1 });
    expect(result.pm).toEqual({ panic: 1 });
  });

  it('複数記録の集約', () => {
    const records = [
      mkRecord({
        behaviorTags: ['panic'],
        activities: { am: '散歩', pm: '' },
      }),
      mkRecord({
        behaviorTags: ['panic', 'cooperation'],
        activities: { am: '体操', pm: '創作' },
      }),
    ];
    const result = computeTagTimeSlots(records);
    expect(result.am).toEqual({ panic: 2, cooperation: 1 });
    expect(result.pm).toEqual({ panic: 1, cooperation: 1 });
  });
});

// ═══════════════════════════════════════════════════════════
// computeUserTopTags
// ═══════════════════════════════════════════════════════════

describe('computeUserTopTags', () => {
  it('空配列 → 空配列', () => {
    expect(computeUserTopTags([])).toEqual([]);
  });

  it('userId なし → 結果なし', () => {
    const records = [mkRecord({ behaviorTags: ['panic'] })];
    expect(computeUserTopTags(records)).toEqual([]);
  });

  it('タグなしユーザー → 結果に含まない', () => {
    const records = [mkRecord({ userId: 'u1', behaviorTags: [] })];
    expect(computeUserTopTags(records)).toEqual([]);
  });

  it('単一ユーザー → トップタグ返却', () => {
    const records = [
      mkRecord({ userId: 'u1', behaviorTags: ['panic', 'cooperation'] }),
      mkRecord({ userId: 'u1', behaviorTags: ['panic'] }),
    ];
    const result = computeUserTopTags(records);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('u1');
    expect(result[0].totalTags).toBe(3);
    expect(result[0].topTags[0].key).toBe('panic');
    expect(result[0].topTags[0].count).toBe(2);
  });

  it('複数ユーザー → totalTags 降順', () => {
    const records = [
      mkRecord({ userId: 'u1', behaviorTags: ['panic'] }),
      mkRecord({ userId: 'u2', behaviorTags: ['panic', 'cooperation', 'sensory'] }),
    ];
    const result = computeUserTopTags(records);
    expect(result[0].userId).toBe('u2');
    expect(result[1].userId).toBe('u1');
  });

  it('最大5件に制限', () => {
    const tags = ['panic', 'sensory', 'elopement', 'cooperation', 'selfRegulation', 'newSkill', 'eating'];
    const records = tags.map((t) => mkRecord({ userId: 'u1', behaviorTags: [t] }));
    const result = computeUserTopTags(records);
    expect(result[0].topTags).toHaveLength(5);
  });

  it('ラベルが正しくマッピングされる', () => {
    const records = [mkRecord({ userId: 'u1', behaviorTags: ['cooperation'] })];
    const result = computeUserTopTags(records);
    expect(result[0].topTags[0].label).toBe('協力行動');
  });
});

// ═══════════════════════════════════════════════════════════
// getTopTagsFromCounts
// ═══════════════════════════════════════════════════════════

describe('getTopTagsFromCounts', () => {
  it('空 → 空配列', () => {
    expect(getTopTagsFromCounts({})).toEqual([]);
  });

  it('count 降順でソート', () => {
    const result = getTopTagsFromCounts({ panic: 3, cooperation: 5, sensory: 1 });
    expect(result[0].key).toBe('cooperation');
    expect(result[1].key).toBe('panic');
    expect(result[2].key).toBe('sensory');
  });

  it('同率時は key の辞書順', () => {
    const result = getTopTagsFromCounts({ sensory: 2, cooperation: 2 });
    expect(result[0].key).toBe('cooperation');
    expect(result[1].key).toBe('sensory');
  });

  it('指定 n で制限', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 10; i++) counts[`tag${i}`] = 10 - i;
    const result = getTopTagsFromCounts(counts, 3);
    expect(result).toHaveLength(3);
  });

  it('ラベル・カテゴリが正しい', () => {
    const result = getTopTagsFromCounts({ panic: 1 });
    expect(result[0]).toEqual({
      key: 'panic',
      label: 'パニック',
      category: 'behavior',
      categoryLabel: '行動',
      count: 1,
    });
  });

  it('不明タグ → label は key のまま', () => {
    const result = getTopTagsFromCounts({ unknownTag: 1 });
    expect(result[0].label).toBe('unknownTag');
    expect(result[0].category).toBe('unknown');
    expect(result[0].categoryLabel).toBe('不明');
  });

  it('count = 0 のタグはフィルタされる', () => {
    const result = getTopTagsFromCounts({ panic: 0, cooperation: 1 });
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe('cooperation');
  });
});

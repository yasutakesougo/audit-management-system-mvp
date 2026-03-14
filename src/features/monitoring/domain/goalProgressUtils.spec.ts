/**
 * @fileoverview goalProgressUtils のユニットテスト
 * Phase 3-A: 推論 + 判定ロジックの網羅テスト
 */
import { describe, expect, it } from 'vitest';

import { assessGoalProgress, DOMAIN_CATEGORY_MAP, inferGoalTagLinks } from './goalProgressUtils';
import type { GoalProgressInput, ProgressLevel, ProgressTrend } from './goalProgressTypes';

// ═══════════════════════════════════════════════════════════
// inferGoalTagLinks
// ═══════════════════════════════════════════════════════════

describe('inferGoalTagLinks', () => {
  it('domain 1つ → 対応カテゴリを推論する', () => {
    const result = inferGoalTagLinks([{ id: 'g1', domains: ['cognitive'] }]);
    expect(result).toHaveLength(1);
    expect(result[0].goalId).toBe('g1');
    expect(result[0].inferredCategories).toEqual(['behavior']);
    expect(result[0].source).toBe('domain-inference');
  });

  it('domain 複数 → カテゴリの union を返す', () => {
    const result = inferGoalTagLinks([
      { id: 'g1', domains: ['cognitive', 'language'] },
    ]);
    expect(result[0].inferredCategories).toEqual(
      expect.arrayContaining(['behavior', 'communication']),
    );
    expect(result[0].inferredCategories).toHaveLength(2);
  });

  it('同じカテゴリに重なる domain → 重複除去', () => {
    // health → [dailyLiving, positive], motor → [dailyLiving, positive]
    const result = inferGoalTagLinks([
      { id: 'g1', domains: ['health', 'motor'] },
    ]);
    expect(result[0].inferredCategories).toEqual(
      expect.arrayContaining(['dailyLiving', 'positive']),
    );
    // 重複なし
    expect(result[0].inferredCategories).toHaveLength(2);
  });

  it('social → communication + positive', () => {
    const result = inferGoalTagLinks([{ id: 'g1', domains: ['social'] }]);
    expect(result[0].inferredCategories).toEqual(
      expect.arrayContaining(['communication', 'positive']),
    );
    expect(result[0].inferredCategories).toHaveLength(2);
  });

  it('domains undefined → 空 categories', () => {
    const result = inferGoalTagLinks([{ id: 'g1' }]);
    expect(result[0].inferredCategories).toEqual([]);
    expect(result[0].source).toBe('domain-inference');
  });

  it('domains 空配列 → 空 categories', () => {
    const result = inferGoalTagLinks([{ id: 'g1', domains: [] }]);
    expect(result[0].inferredCategories).toEqual([]);
  });

  it('未知の domain ID → スキップ（エラーにならない）', () => {
    const result = inferGoalTagLinks([
      { id: 'g1', domains: ['unknown-domain'] },
    ]);
    expect(result[0].inferredCategories).toEqual([]);
  });

  it('goals 空配列 → 空配列', () => {
    expect(inferGoalTagLinks([])).toEqual([]);
  });

  it('inferredTags は Phase 3-A では空配列', () => {
    const result = inferGoalTagLinks([{ id: 'g1', domains: ['health'] }]);
    expect(result[0].inferredTags).toEqual([]);
  });

  it('カテゴリはソート済みで安定', () => {
    // social → [communication, positive] をソートで安定
    const r1 = inferGoalTagLinks([{ id: 'g1', domains: ['social'] }]);
    const r2 = inferGoalTagLinks([{ id: 'g1', domains: ['social'] }]);
    expect(r1[0].inferredCategories).toEqual(r2[0].inferredCategories);
    // アルファベット順: communication < positive
    expect(r1[0].inferredCategories[0]).toBe('communication');
    expect(r1[0].inferredCategories[1]).toBe('positive');
  });

  it('全5領域のマッピングが定義されている', () => {
    const domainIds = ['health', 'motor', 'cognitive', 'language', 'social'];
    for (const id of domainIds) {
      expect(DOMAIN_CATEGORY_MAP).toHaveProperty(id);
      expect(DOMAIN_CATEGORY_MAP[id as keyof typeof DOMAIN_CATEGORY_MAP].length).toBeGreaterThan(0);
    }
  });

  it('複数 goal を一括で処理できる', () => {
    const result = inferGoalTagLinks([
      { id: 'g1', domains: ['health'] },
      { id: 'g2', domains: ['cognitive'] },
      { id: 'g3', domains: ['social'] },
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.goalId)).toEqual(['g1', 'g2', 'g3']);
  });
});

// ═══════════════════════════════════════════════════════════
// assessGoalProgress
// ═══════════════════════════════════════════════════════════

describe('assessGoalProgress', () => {
  /** テスト用ヘルパー */
  const mkInput = (
    overrides: Partial<GoalProgressInput> = {},
  ): GoalProgressInput => ({
    goalId: 'g1',
    linkedCategories: ['behavior'],
    matchedRecordCount: 0,
    matchedTagCount: 0,
    totalRecordCount: 0,
    trend: 'stable',
    ...overrides,
  });

  // ── noData ──

  it('totalRecordCount === 0 → noData', () => {
    const result = assessGoalProgress(mkInput({ totalRecordCount: 0 }));
    expect(result.level).toBe('noData');
    expect(result.rate).toBe(0);
    expect(result.trend).toBe('stable');
    expect(result.note).toBe('記録データがありません');
  });

  // ── rate >= 0.5 ──

  it('rate=0.6 + improving → achieved', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 6, totalRecordCount: 10, trend: 'improving' }),
    );
    expect(result.level).toBe('achieved');
    expect(result.rate).toBe(0.6);
  });

  it('rate=0.6 + stable → progressing', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 6, totalRecordCount: 10, trend: 'stable' }),
    );
    expect(result.level).toBe('progressing');
  });

  it('rate=0.5 + declining → progressing', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 5, totalRecordCount: 10, trend: 'declining' }),
    );
    expect(result.level).toBe('progressing');
  });

  // ── rate >= 0.3, < 0.5 ──

  it('rate=0.35 + improving → progressing', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 7, totalRecordCount: 20, trend: 'improving' }),
    );
    expect(result.level).toBe('progressing');
  });

  it('rate=0.35 + stable → progressing', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 7, totalRecordCount: 20, trend: 'stable' }),
    );
    expect(result.level).toBe('progressing');
  });

  it('rate=0.35 + declining → stagnant', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 7, totalRecordCount: 20, trend: 'declining' }),
    );
    expect(result.level).toBe('stagnant');
  });

  // ── rate >= 0.1, < 0.3 ──

  it('rate=0.15 + improving → progressing', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 3, totalRecordCount: 20, trend: 'improving' }),
    );
    expect(result.level).toBe('progressing');
  });

  it('rate=0.15 + stable → stagnant', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 3, totalRecordCount: 20, trend: 'stable' }),
    );
    expect(result.level).toBe('stagnant');
  });

  it('rate=0.15 + declining → regressing', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 3, totalRecordCount: 20, trend: 'declining' }),
    );
    expect(result.level).toBe('regressing');
  });

  // ── rate < 0.1 ──

  it('rate=0.05 + improving → stagnant', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 1, totalRecordCount: 20, trend: 'improving' }),
    );
    expect(result.level).toBe('stagnant');
  });

  it('rate=0.05 + stable → stagnant', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 1, totalRecordCount: 20, trend: 'stable' }),
    );
    expect(result.level).toBe('stagnant');
  });

  it('rate=0.05 + declining → regressing', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 1, totalRecordCount: 20, trend: 'declining' }),
    );
    expect(result.level).toBe('regressing');
  });

  // ── 出力フィールドの検証 ──

  it('matchedRecordCount / matchedTagCount がそのまま返る', () => {
    const result = assessGoalProgress(
      mkInput({
        matchedRecordCount: 8,
        matchedTagCount: 15,
        totalRecordCount: 10,
        trend: 'improving',
      }),
    );
    expect(result.matchedRecordCount).toBe(8);
    expect(result.matchedTagCount).toBe(15);
  });

  it('linkedCategories がそのまま返る', () => {
    const cats = ['behavior', 'communication'] as const;
    const result = assessGoalProgress(
      mkInput({
        linkedCategories: [...cats],
        matchedRecordCount: 5,
        totalRecordCount: 10,
      }),
    );
    expect(result.linkedCategories).toEqual([...cats]);
  });

  it('rate は小数2桁に丸められる', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 1, totalRecordCount: 3, trend: 'improving' }),
    );
    // 1/3 = 0.333... → 0.33
    expect(result.rate).toBe(0.33);
  });

  // ── 境界値テスト ──

  it('rate=0.5 ちょうど + improving → achieved', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 5, totalRecordCount: 10, trend: 'improving' }),
    );
    expect(result.level).toBe('achieved');
  });

  it('rate=0.3 ちょうど + declining → stagnant', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 3, totalRecordCount: 10, trend: 'declining' }),
    );
    expect(result.level).toBe('stagnant');
  });

  it('rate=0.1 ちょうど + declining → regressing', () => {
    const result = assessGoalProgress(
      mkInput({ matchedRecordCount: 1, totalRecordCount: 10, trend: 'declining' }),
    );
    expect(result.level).toBe('regressing');
  });

  // ── 判定マトリクス網羅 ──

  it('全12パターンの判定マトリクスが正しい', () => {
    type Case = [number, number, ProgressTrend, ProgressLevel];
    const cases: Case[] = [
      // rate >= 0.5
      [6, 10, 'improving', 'achieved'],
      [6, 10, 'stable', 'progressing'],
      [6, 10, 'declining', 'progressing'],
      // rate >= 0.3
      [4, 10, 'improving', 'progressing'],
      [4, 10, 'stable', 'progressing'],
      [4, 10, 'declining', 'stagnant'],
      // rate >= 0.1
      [2, 10, 'improving', 'progressing'],
      [2, 10, 'stable', 'stagnant'],
      [2, 10, 'declining', 'regressing'],
      // rate < 0.1
      [0, 10, 'improving', 'stagnant'],
      [0, 10, 'stable', 'stagnant'],
      [0, 10, 'declining', 'regressing'],
    ];

    for (const [matched, total, trend, expected] of cases) {
      const result = assessGoalProgress(
        mkInput({ matchedRecordCount: matched, totalRecordCount: total, trend }),
      );
      expect(result.level).toBe(expected);
    }
  });
});

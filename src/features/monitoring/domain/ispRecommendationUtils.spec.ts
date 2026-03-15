/**
 * @fileoverview ISP 見直し提案ロジックのテスト
 * @description
 * Phase 4-A:
 *   deriveIspRecommendation / buildIspRecommendations のユニットテスト。
 *   判定マトリクスの全パターン + エッジケースをカバーする。
 */

import { describe, expect, it } from 'vitest';
import type { GoalProgressSummary } from './goalProgressTypes';
import type { IspRecommendationLevel } from './ispRecommendationTypes';
import {
  deriveIspRecommendation,
  buildIspRecommendations,
} from './ispRecommendationUtils';

// ─── ヘルパー ────────────────────────────────────────────

/** テスト用 GoalProgressSummary を生成 */
function makeGP(
  overrides: Partial<GoalProgressSummary> & { goalId: string },
): GoalProgressSummary {
  return {
    level: 'progressing',
    rate: 0.4,
    trend: 'stable',
    matchedRecordCount: 10,
    matchedTagCount: 15,
    linkedCategories: ['dailyLiving'],
    ...overrides,
  };
}

// ─── deriveIspRecommendation ─────────────────────────────

describe('deriveIspRecommendation', () => {
  // ── 判定マトリクス: 基本パターン ──

  it('noData → pending', () => {
    const gp = makeGP({ goalId: 'g1', level: 'noData', rate: 0 });
    const result = deriveIspRecommendation(gp);
    expect(result.level).toBe('pending');
    expect(result.reason).toContain('記録データが不足');
  });

  it('achieved → continue（次段階検討を含む）', () => {
    const gp = makeGP({ goalId: 'g1', level: 'achieved', rate: 0.7, trend: 'improving' });
    const result = deriveIspRecommendation(gp);
    expect(result.level).toBe('continue');
    expect(result.reason).toContain('達成');
    expect(result.reason).toContain('次段階');
  });

  it('progressing → continue', () => {
    const gp = makeGP({ goalId: 'g1', level: 'progressing', rate: 0.45, trend: 'stable' });
    const result = deriveIspRecommendation(gp);
    expect(result.level).toBe('continue');
    expect(result.reason).toContain('進捗がみられます');
  });

  it('stagnant + stable → adjust-support', () => {
    const gp = makeGP({ goalId: 'g1', level: 'stagnant', rate: 0.15, trend: 'stable' });
    const result = deriveIspRecommendation(gp);
    expect(result.level).toBe('adjust-support');
    expect(result.reason).toContain('支援方法の見直し');
  });

  it('stagnant + improving → adjust-support（昇格しない）', () => {
    const gp = makeGP({ goalId: 'g1', level: 'stagnant', rate: 0.2, trend: 'improving' });
    const result = deriveIspRecommendation(gp);
    expect(result.level).toBe('adjust-support');
  });

  it('regressing + stable → revise-goal', () => {
    const gp = makeGP({ goalId: 'g1', level: 'regressing', rate: 0.05, trend: 'stable' });
    const result = deriveIspRecommendation(gp);
    expect(result.level).toBe('revise-goal');
    expect(result.reason).toContain('目標の再設定');
  });

  // ── 判定マトリクス: trend=declining による昇格 ──

  it('stagnant + declining → revise-goal に昇格', () => {
    const gp = makeGP({ goalId: 'g1', level: 'stagnant', rate: 0.15, trend: 'declining' });
    const result = deriveIspRecommendation(gp);
    expect(result.level).toBe('revise-goal');
    expect(result.reason).toContain('低下傾向');
  });

  it('regressing + declining + 記録十分 → urgent-review に昇格', () => {
    const gp = makeGP({
      goalId: 'g1',
      level: 'regressing',
      rate: 0.05,
      trend: 'declining',
      matchedRecordCount: 5,
    });
    const result = deriveIspRecommendation(gp);
    expect(result.level).toBe('urgent-review');
    expect(result.reason).toContain('緊急の支援見直し');
  });

  it('regressing + declining + 記録不足 → revise-goal に留まる', () => {
    const gp = makeGP({
      goalId: 'g1',
      level: 'regressing',
      rate: 0.05,
      trend: 'declining',
      matchedRecordCount: 2, // < 3
    });
    const result = deriveIspRecommendation(gp);
    expect(result.level).toBe('revise-goal');
  });

  // ── オプション: goalName ──

  it('goalName が渡されると reason に反映される', () => {
    const gp = makeGP({ goalId: 'g1', level: 'achieved', rate: 0.8 });
    const result = deriveIspRecommendation(gp, { goalName: '社会性の向上' });
    expect(result.reason).toContain('社会性の向上');
    expect(result.reason).not.toContain('目標(g1)');
  });

  it('goalName がない場合はフォールバック表示', () => {
    const gp = makeGP({ goalId: 'g1', level: 'achieved', rate: 0.8 });
    const result = deriveIspRecommendation(gp);
    expect(result.reason).toContain('目標(g1)');
  });

  // ── evidence の検証 ──

  it('evidence に GoalProgress のスナップショットが含まれる', () => {
    const gp = makeGP({
      goalId: 'g1',
      level: 'stagnant',
      rate: 0.2,
      trend: 'stable',
      matchedRecordCount: 8,
      matchedTagCount: 12,
      linkedCategories: ['communication', 'positive'],
    });
    const result = deriveIspRecommendation(gp);
    expect(result.evidence).toEqual({
      progressLevel: 'stagnant',
      rate: 0.2,
      trend: 'stable',
      matchedRecordCount: 8,
      matchedTagCount: 12,
      linkedCategories: ['communication', 'positive'],
    });
  });
});

// ─── buildIspRecommendations ─────────────────────────────

describe('buildIspRecommendations', () => {
  it('空配列 → pending summary', () => {
    const result = buildIspRecommendations([]);
    expect(result.recommendations).toHaveLength(0);
    expect(result.overallLevel).toBe('pending');
    expect(result.actionableCount).toBe(0);
    expect(result.totalGoalCount).toBe(0);
    expect(result.summaryText).toContain('評価対象の目標がありません');
  });

  it('全目標 continue → overallLevel=continue', () => {
    const result = buildIspRecommendations([
      makeGP({ goalId: 'g1', level: 'achieved', rate: 0.7 }),
      makeGP({ goalId: 'g2', level: 'progressing', rate: 0.4 }),
    ]);
    expect(result.overallLevel).toBe('continue');
    expect(result.actionableCount).toBe(2);
    expect(result.totalGoalCount).toBe(2);
  });

  it('1件でも stagnant → overallLevel=adjust-support', () => {
    const result = buildIspRecommendations([
      makeGP({ goalId: 'g1', level: 'achieved', rate: 0.7 }),
      makeGP({ goalId: 'g2', level: 'stagnant', rate: 0.15, trend: 'stable' }),
    ]);
    expect(result.overallLevel).toBe('adjust-support');
  });

  it('1件でも regressing → overallLevel=revise-goal', () => {
    const result = buildIspRecommendations([
      makeGP({ goalId: 'g1', level: 'progressing', rate: 0.4 }),
      makeGP({ goalId: 'g2', level: 'regressing', rate: 0.05, trend: 'stable' }),
    ]);
    expect(result.overallLevel).toBe('revise-goal');
  });

  it('urgent-review があれば overallLevel=urgent-review', () => {
    const result = buildIspRecommendations([
      makeGP({ goalId: 'g1', level: 'progressing', rate: 0.4 }),
      makeGP({
        goalId: 'g2',
        level: 'regressing',
        rate: 0.05,
        trend: 'declining',
        matchedRecordCount: 5,
      }),
    ]);
    expect(result.overallLevel).toBe('urgent-review');
  });

  it('pending のみの場合は actionableCount=0', () => {
    const result = buildIspRecommendations([
      makeGP({ goalId: 'g1', level: 'noData', rate: 0 }),
      makeGP({ goalId: 'g2', level: 'noData', rate: 0 }),
    ]);
    expect(result.actionableCount).toBe(0);
    expect(result.overallLevel).toBe('pending');
  });

  it('pending + actionable → overallLevel は actionable の最大', () => {
    const result = buildIspRecommendations([
      makeGP({ goalId: 'g1', level: 'noData', rate: 0 }),
      makeGP({ goalId: 'g2', level: 'stagnant', rate: 0.15, trend: 'stable' }),
    ]);
    expect(result.overallLevel).toBe('adjust-support');
    expect(result.actionableCount).toBe(1);
  });

  // ── summaryText ──

  it('summaryText にレベル別件数と総合判定が含まれる', () => {
    const result = buildIspRecommendations([
      makeGP({ goalId: 'g1', level: 'achieved', rate: 0.7 }),
      makeGP({ goalId: 'g2', level: 'stagnant', rate: 0.15, trend: 'stable' }),
      makeGP({ goalId: 'g3', level: 'noData', rate: 0 }),
    ]);
    expect(result.summaryText).toContain('3目標中');
    expect(result.summaryText).toContain('継続1件');
    expect(result.summaryText).toContain('支援見直し1件');
    expect(result.summaryText).toContain('判定保留1件');
    expect(result.summaryText).toContain('総合判定: 支援方法の見直し');
  });

  // ── goalNames オプション ──

  it('goalNames が渡されると reason に反映される', () => {
    const result = buildIspRecommendations(
      [makeGP({ goalId: 'g1', level: 'achieved', rate: 0.8 })],
      { goalNames: { g1: '健康管理' } },
    );
    expect(result.recommendations[0].reason).toContain('健康管理');
  });
});

// ─── 判定マトリクス 全パターン網羅 ───────────────────────

describe('判定マトリクス — 全パターン', () => {
  const cases: Array<{
    name: string;
    level: GoalProgressSummary['level'];
    trend: GoalProgressSummary['trend'];
    matchedRecordCount?: number;
    expected: IspRecommendationLevel;
  }> = [
    // achieved は trend に関係なく continue
    { name: 'achieved+improving', level: 'achieved', trend: 'improving', expected: 'continue' },
    { name: 'achieved+stable', level: 'achieved', trend: 'stable', expected: 'continue' },
    { name: 'achieved+declining', level: 'achieved', trend: 'declining', expected: 'continue' },

    // progressing は trend に関係なく continue
    { name: 'progressing+improving', level: 'progressing', trend: 'improving', expected: 'continue' },
    { name: 'progressing+stable', level: 'progressing', trend: 'stable', expected: 'continue' },
    { name: 'progressing+declining', level: 'progressing', trend: 'declining', expected: 'continue' },

    // stagnant: stable/improving → adjust-support, declining → revise-goal
    { name: 'stagnant+improving', level: 'stagnant', trend: 'improving', expected: 'adjust-support' },
    { name: 'stagnant+stable', level: 'stagnant', trend: 'stable', expected: 'adjust-support' },
    { name: 'stagnant+declining', level: 'stagnant', trend: 'declining', expected: 'revise-goal' },

    // regressing: stable/improving → revise-goal
    { name: 'regressing+improving', level: 'regressing', trend: 'improving', expected: 'revise-goal' },
    { name: 'regressing+stable', level: 'regressing', trend: 'stable', expected: 'revise-goal' },
    // regressing+declining + 記録不足 → revise-goal
    { name: 'regressing+declining(記録不足)', level: 'regressing', trend: 'declining', matchedRecordCount: 1, expected: 'revise-goal' },
    // regressing+declining + 記録十分 → urgent-review
    { name: 'regressing+declining(記録十分)', level: 'regressing', trend: 'declining', matchedRecordCount: 5, expected: 'urgent-review' },

    // noData は trend に関係なく pending
    { name: 'noData+stable', level: 'noData', trend: 'stable', expected: 'pending' },
    { name: 'noData+improving', level: 'noData', trend: 'improving', expected: 'pending' },
    { name: 'noData+declining', level: 'noData', trend: 'declining', expected: 'pending' },
  ];

  it.each(cases)('$name → $expected', ({ level, trend, matchedRecordCount, expected }) => {
    const gp = makeGP({
      goalId: 'test',
      level,
      trend,
      rate: level === 'noData' ? 0 : 0.2,
      matchedRecordCount: matchedRecordCount ?? 10,
    });
    const result = deriveIspRecommendation(gp);
    expect(result.level).toBe(expected);
  });
});

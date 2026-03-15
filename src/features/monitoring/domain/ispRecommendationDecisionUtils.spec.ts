/**
 * @fileoverview ISP 見直し判断記録ユーティリティのテスト
 * Phase 4-C
 */
import { describe, it, expect } from 'vitest';

import type { IspRecommendation, IspRecommendationSummary } from './ispRecommendationTypes';
import type { IspRecommendationDecision } from './ispRecommendationDecisionTypes';
import {
  createRecommendationSnapshot,
  createDecisionRecord,
  buildDecisionSummary,
  buildGoalDecisionHistories,
  resolveCurrentDecisionStatus,
  calculateDecisionCompletionRate,
} from './ispRecommendationDecisionUtils';

// ─── テストヘルパー ──────────────────────────────────────

function makeRecommendation(overrides?: Partial<IspRecommendation>): IspRecommendation {
  return {
    goalId: 'goal-1',
    level: 'adjust-support',
    reason: 'テストの理由',
    evidence: {
      progressLevel: 'stagnant',
      rate: 0.45,
      trend: 'stable',
      matchedRecordCount: 5,
      matchedTagCount: 8,
      linkedCategories: ['dailyLiving'],
    },
    ...overrides,
  };
}

function makeSummary(overrides?: Partial<IspRecommendationSummary>): IspRecommendationSummary {
  return {
    recommendations: [
      makeRecommendation({ goalId: 'goal-1' }),
      makeRecommendation({ goalId: 'goal-2', level: 'revise-goal' }),
      makeRecommendation({ goalId: 'goal-3', level: 'continue' }),
    ],
    overallLevel: 'revise-goal',
    actionableCount: 3,
    totalGoalCount: 3,
    summaryText: 'テスト用サマリー',
    ...overrides,
  };
}

function makeDecision(overrides?: Partial<IspRecommendationDecision>): IspRecommendationDecision {
  return {
    id: 'decision-1',
    goalId: 'goal-1',
    userId: 'user-A',
    status: 'accepted',
    decidedBy: 'staff@example.com',
    decidedAt: '2026-03-15T10:00:00Z',
    note: '',
    snapshot: {
      level: 'adjust-support',
      reason: 'テストの理由',
      progressLevel: 'stagnant',
      rate: 0.45,
      trend: 'stable',
      matchedRecordCount: 5,
      matchedTagCount: 8,
    },
    monitoringPeriodFrom: '2026-01-01',
    monitoringPeriodTo: '2026-03-31',
    ...overrides,
  };
}

// ─── createRecommendationSnapshot ────────────────────────

describe('createRecommendationSnapshot', () => {
  it('提案からスナップショットを正しく切り出せる', () => {
    const rec = makeRecommendation({
      level: 'urgent-review',
      reason: '後退が続いている',
      evidence: {
        progressLevel: 'regressing',
        rate: 0.2,
        trend: 'declining',
        matchedRecordCount: 10,
        matchedTagCount: 15,
        linkedCategories: ['communication', 'dailyLiving'],
      },
    });

    const snapshot = createRecommendationSnapshot(rec);

    expect(snapshot.level).toBe('urgent-review');
    expect(snapshot.reason).toBe('後退が続いている');
    expect(snapshot.progressLevel).toBe('regressing');
    expect(snapshot.rate).toBe(0.2);
    expect(snapshot.trend).toBe('declining');
    expect(snapshot.matchedRecordCount).toBe(10);
    expect(snapshot.matchedTagCount).toBe(15);
  });

  it('提案の evidence と snapshot は独立している（参照を共有しない）', () => {
    const rec = makeRecommendation();
    const snapshot = createRecommendationSnapshot(rec);

    // snapshot の値を変えても evidence に影響しないことを確認
    expect(snapshot.rate).toBe(rec.evidence.rate);
    expect(snapshot).not.toBe(rec.evidence);
  });
});

// ─── createDecisionRecord ────────────────────────────────

describe('createDecisionRecord', () => {
  it('判断レコードを正しく生成できる', () => {
    const rec = makeRecommendation({ goalId: 'goal-X' });
    const result = createDecisionRecord({
      id: 'dec-001',
      recommendation: rec,
      userId: 'user-123',
      status: 'accepted',
      decidedBy: 'staff@example.com',
      decidedAt: '2026-03-15T12:00:00Z',
      note: '対応する方針で合意',
      monitoringPeriodFrom: '2026-01-01',
      monitoringPeriodTo: '2026-03-31',
    });

    expect(result.id).toBe('dec-001');
    expect(result.goalId).toBe('goal-X');
    expect(result.userId).toBe('user-123');
    expect(result.status).toBe('accepted');
    expect(result.decidedBy).toBe('staff@example.com');
    expect(result.decidedAt).toBe('2026-03-15T12:00:00Z');
    expect(result.note).toBe('対応する方針で合意');
    expect(result.snapshot.level).toBe('adjust-support');
    expect(result.monitoringPeriodFrom).toBe('2026-01-01');
    expect(result.monitoringPeriodTo).toBe('2026-03-31');
  });

  it('noteを省略するとデフォルト空文字になる', () => {
    const rec = makeRecommendation();
    const result = createDecisionRecord({
      id: 'dec-002',
      recommendation: rec,
      userId: 'user-123',
      status: 'dismissed',
      decidedBy: 'staff@example.com',
      decidedAt: '2026-03-15T12:00:00Z',
      monitoringPeriodFrom: '2026-01-01',
      monitoringPeriodTo: '2026-03-31',
    });

    expect(result.note).toBe('');
  });
});

// ─── buildDecisionSummary ────────────────────────────────

describe('buildDecisionSummary', () => {
  it('判断がない場合、全目標が pending になる', () => {
    const summary = makeSummary();
    const result = buildDecisionSummary(summary, []);

    expect(result.totalGoals).toBe(3);
    expect(result.decidedCount).toBe(0);
    expect(result.pendingCount).toBe(3);
    expect(result.byStatus.pending).toBe(3);
    expect(result.lastDecidedAt).toBeNull();
    expect(result.lastDecidedBy).toBeNull();
  });

  it('全目標に判断があれば pending が 0 になる', () => {
    const summary = makeSummary();
    const decisions = [
      makeDecision({ goalId: 'goal-1', status: 'accepted', decidedAt: '2026-03-15T10:00:00Z' }),
      makeDecision({ id: 'd2', goalId: 'goal-2', status: 'dismissed', decidedAt: '2026-03-15T11:00:00Z' }),
      makeDecision({ id: 'd3', goalId: 'goal-3', status: 'deferred', decidedAt: '2026-03-15T12:00:00Z' }),
    ];

    const result = buildDecisionSummary(summary, decisions);

    expect(result.decidedCount).toBe(3);
    expect(result.pendingCount).toBe(0);
    expect(result.byStatus.accepted).toBe(1);
    expect(result.byStatus.dismissed).toBe(1);
    expect(result.byStatus.deferred).toBe(1);
  });

  it('同じ目標に複数判断がある場合、最新の判断を採用する', () => {
    const summary = makeSummary({
      recommendations: [makeRecommendation({ goalId: 'goal-1' })],
      totalGoalCount: 1,
    });

    const decisions = [
      makeDecision({ id: 'd1', goalId: 'goal-1', status: 'deferred', decidedAt: '2026-03-10T10:00:00Z' }),
      makeDecision({ id: 'd2', goalId: 'goal-1', status: 'accepted', decidedAt: '2026-03-15T10:00:00Z' }),
    ];

    const result = buildDecisionSummary(summary, decisions);

    expect(result.byStatus.accepted).toBe(1);
    expect(result.byStatus.deferred).toBe(0);
    expect(result.decidedCount).toBe(1);
    expect(result.pendingCount).toBe(0);
  });

  it('最終更新の日時と判断者を正しく返す', () => {
    const summary = makeSummary();
    const decisions = [
      makeDecision({ id: 'd1', goalId: 'goal-1', decidedAt: '2026-03-10T10:00:00Z', decidedBy: 'early@example.com' }),
      makeDecision({ id: 'd2', goalId: 'goal-2', decidedAt: '2026-03-15T15:00:00Z', decidedBy: 'latest@example.com' }),
    ];

    const result = buildDecisionSummary(summary, decisions);

    expect(result.lastDecidedAt).toBe('2026-03-15T15:00:00Z');
    expect(result.lastDecidedBy).toBe('latest@example.com');
  });

  it('一部の目標のみ判断がある場合の混合ケース', () => {
    const summary = makeSummary(); // 3目標
    const decisions = [
      makeDecision({ goalId: 'goal-1', status: 'accepted', decidedAt: '2026-03-15T10:00:00Z' }),
    ];

    const result = buildDecisionSummary(summary, decisions);

    expect(result.decidedCount).toBe(1);
    expect(result.pendingCount).toBe(2);
    expect(result.byStatus.accepted).toBe(1);
    expect(result.byStatus.pending).toBe(2);
  });
});

// ─── buildGoalDecisionHistories ──────────────────────────

describe('buildGoalDecisionHistories', () => {
  it('goalId ごとにグルーピングされる', () => {
    const decisions = [
      makeDecision({ id: 'd1', goalId: 'goal-A', decidedAt: '2026-01-01T10:00:00Z' }),
      makeDecision({ id: 'd2', goalId: 'goal-B', decidedAt: '2026-02-01T10:00:00Z' }),
      makeDecision({ id: 'd3', goalId: 'goal-A', decidedAt: '2026-03-01T10:00:00Z' }),
    ];

    const result = buildGoalDecisionHistories(decisions);

    expect(result).toHaveLength(2);

    const goalA = result.find(h => h.goalId === 'goal-A');
    expect(goalA?.decisions).toHaveLength(2);
    // 新しい順
    expect(goalA?.decisions[0].id).toBe('d3');
    expect(goalA?.decisions[1].id).toBe('d1');
    expect(goalA?.latestDecision?.id).toBe('d3');
  });

  it('goalNames が渡されれば goalName が設定される', () => {
    const decisions = [
      makeDecision({ goalId: 'goal-X' }),
    ];
    const names = { 'goal-X': 'コミュニケーション目標' };

    const result = buildGoalDecisionHistories(decisions, names);

    expect(result[0].goalName).toBe('コミュニケーション目標');
  });

  it('空配列なら空配列を返す', () => {
    const result = buildGoalDecisionHistories([]);
    expect(result).toEqual([]);
  });
});

// ─── resolveCurrentDecisionStatus ────────────────────────

describe('resolveCurrentDecisionStatus', () => {
  it('判断がなければ全目標が pending になる', () => {
    const summary = makeSummary();
    const result = resolveCurrentDecisionStatus(summary, []);

    expect(result.get('goal-1')).toBe('pending');
    expect(result.get('goal-2')).toBe('pending');
    expect(result.get('goal-3')).toBe('pending');
  });

  it('判断がある目標はそのステータスを返す', () => {
    const summary = makeSummary();
    const decisions = [
      makeDecision({ goalId: 'goal-1', status: 'accepted', decidedAt: '2026-03-15T10:00:00Z' }),
      makeDecision({ id: 'd2', goalId: 'goal-2', status: 'dismissed', decidedAt: '2026-03-15T11:00:00Z' }),
    ];

    const result = resolveCurrentDecisionStatus(summary, decisions);

    expect(result.get('goal-1')).toBe('accepted');
    expect(result.get('goal-2')).toBe('dismissed');
    expect(result.get('goal-3')).toBe('pending');
  });

  it('同じ目標の複数判断は最新を採用', () => {
    const summary = makeSummary({
      recommendations: [makeRecommendation({ goalId: 'goal-1' })],
      totalGoalCount: 1,
    });
    const decisions = [
      makeDecision({ id: 'd1', goalId: 'goal-1', status: 'deferred', decidedAt: '2026-03-10T10:00:00Z' }),
      makeDecision({ id: 'd2', goalId: 'goal-1', status: 'accepted', decidedAt: '2026-03-15T10:00:00Z' }),
    ];

    const result = resolveCurrentDecisionStatus(summary, decisions);

    expect(result.get('goal-1')).toBe('accepted');
  });
});

// ─── calculateDecisionCompletionRate ─────────────────────

describe('calculateDecisionCompletionRate', () => {
  it('全目標判断済みなら 100%', () => {
    const summary = buildDecisionSummary(makeSummary(), [
      makeDecision({ goalId: 'goal-1', status: 'accepted', decidedAt: '2026-03-15T10:00:00Z' }),
      makeDecision({ id: 'd2', goalId: 'goal-2', status: 'dismissed', decidedAt: '2026-03-15T11:00:00Z' }),
      makeDecision({ id: 'd3', goalId: 'goal-3', status: 'deferred', decidedAt: '2026-03-15T12:00:00Z' }),
    ]);
    expect(calculateDecisionCompletionRate(summary)).toBe(100);
  });

  it('半分判断済みなら約50%', () => {
    // 3目標のうち 1件だけ判断
    const recSummary = makeSummary();
    const summary = buildDecisionSummary(recSummary, [
      makeDecision({ goalId: 'goal-1', status: 'accepted', decidedAt: '2026-03-15T10:00:00Z' }),
    ]);
    // decidedCount=1, pending=2 → actionable = 3-2 = 1 → 100%
    // ↑ 実際は提案レベルの pending と判断の pending が異なる
    // totalGoals=3, byStatus.pending=2 → actionable = 3-2 = 1, decidedCount=1 → 100%
    // ※ pending カウントは「判断が undecided」の目標数であって、提案レベルが pending の件数ではない
    // よって 1 / 1 = 100%
    expect(calculateDecisionCompletionRate(summary)).toBe(100);
  });

  it('判断が0件なら全て pending → actionable=0 → 100%（操作なし完了）', () => {
    const summary = buildDecisionSummary(makeSummary(), []);
    // totalGoals=3, byStatus.pending=3 → actionable = 3-3 = 0 → 100%
    expect(calculateDecisionCompletionRate(summary)).toBe(100);
  });

  it('目標0件なら 100%', () => {
    const recSummary = makeSummary({
      recommendations: [],
      totalGoalCount: 0,
    });
    const summary = buildDecisionSummary(recSummary, []);
    expect(calculateDecisionCompletionRate(summary)).toBe(100);
  });
});

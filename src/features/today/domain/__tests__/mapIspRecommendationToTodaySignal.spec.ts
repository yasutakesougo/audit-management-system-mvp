import { describe, expect, it } from 'vitest';

import type {
  IspRecommendation,
  IspRecommendationSummary,
} from '@/features/monitoring/domain/ispRecommendationTypes';
import { mapIspRecommendationToTodaySignal } from '../mapIspRecommendationToTodaySignal';

function makeRecommendation(
  overrides?: Partial<IspRecommendation>,
): IspRecommendation {
  return {
    goalId: 'goal-1',
    level: 'adjust-support',
    reason: '支援方法の見直しが必要です',
    evidence: {
      progressLevel: 'stagnant',
      rate: 0.4,
      trend: 'stable',
      matchedRecordCount: 4,
      matchedTagCount: 2,
      linkedCategories: [],
    },
    ...overrides,
  };
}

function makeSummary(
  recommendations: IspRecommendation[],
): IspRecommendationSummary {
  return {
    recommendations,
    overallLevel: recommendations[0]?.level ?? 'pending',
    actionableCount: recommendations.filter((r) => r.level !== 'pending').length,
    totalGoalCount: recommendations.length,
    summaryText: 'summary',
  };
}

describe('mapIspRecommendationToTodaySignal', () => {
  it('summary がない場合は null', () => {
    const signal = mapIspRecommendationToTodaySignal({
      userId: 'U001',
      sourceRef: 'monitoring:2026-Q2',
      recommendationSummary: null,
    });
    expect(signal).toBeNull();
  });

  it('見直しレベル（adjust/revise/urgent）がない場合は null', () => {
    const summary = makeSummary([
      makeRecommendation({ level: 'continue' }),
      makeRecommendation({ goalId: 'goal-2', level: 'pending' }),
    ]);

    const signal = mapIspRecommendationToTodaySignal({
      userId: 'U001',
      sourceRef: 'monitoring:2026-Q2',
      recommendationSummary: summary,
    });
    expect(signal).toBeNull();
  });

  it('adjust-support は low impact で signal を生成する', () => {
    const createdAt = '2026-04-12T00:00:00.000Z';
    const summary = makeSummary([makeRecommendation({ level: 'adjust-support' })]);

    const signal = mapIspRecommendationToTodaySignal({
      userId: 'U001',
      sourceRef: 'monitoring:2026-Q2',
      createdAt,
      recommendationSummary: summary,
    });

    expect(signal).not.toBeNull();
    expect(signal?.code).toBe('isp_renew_suggest');
    expect(signal?.priority).toBe('P2');
    expect(signal?.audience).toEqual(['admin']);
    expect(signal?.metadata).toMatchObject({
      userId: 'U001',
      sourceRef: 'monitoring:2026-Q2',
      impact: 'low',
      createdAt,
    });
  });

  it('revise-goal / urgent-review を含む場合は high impact を採用', () => {
    const summary = makeSummary([
      makeRecommendation({ level: 'adjust-support', reason: '軽微な見直し' }),
      makeRecommendation({ goalId: 'goal-2', level: 'revise-goal', reason: '目標再設定が必要' }),
      makeRecommendation({ goalId: 'goal-3', level: 'urgent-review', reason: '緊急レビューが必要' }),
    ]);

    const signal = mapIspRecommendationToTodaySignal({
      userId: 'U009',
      sourceRef: 'meeting/2026-04',
      createdAt: '2026-04-12T00:00:00.000Z',
      recommendationSummary: summary,
    });

    expect(signal).not.toBeNull();
    const metadata = signal?.metadata as Record<string, unknown>;
    expect(metadata.impact).toBe('high');
    expect(metadata.reason).toBe('緊急レビューが必要');
    expect(signal?.id).toContain('isp_renew_suggest:u009:meeting-2026-04');
  });

  it('recommendation-only: apply 由来のフィールドを metadata に含めない', () => {
    const summary = makeSummary([makeRecommendation({ level: 'revise-goal' })]);
    const signal = mapIspRecommendationToTodaySignal({
      userId: 'U005',
      sourceRef: 'src-ref-1',
      recommendationSummary: summary,
    });

    expect(signal).not.toBeNull();
    const metadata = signal?.metadata as Record<string, unknown>;
    expect(metadata).not.toHaveProperty('approvedBy');
    expect(metadata).not.toHaveProperty('rollbackSnapshotRef');
    expect(metadata).not.toHaveProperty('diff');
    expect(metadata).not.toHaveProperty('targetLayer');
  });
});

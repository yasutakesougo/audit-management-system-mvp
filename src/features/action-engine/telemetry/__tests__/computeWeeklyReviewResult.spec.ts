import { describe, expect, it } from 'vitest';
import {
  computeWeeklyReviewResult,
  WEEKLY_REVIEW_THRESHOLDS,
  type WeeklyReviewInputMetrics,
} from '../computeWeeklyReviewResult';
import type { SuggestionLifecycleAnomaly } from '../detectSuggestionLifecycleAnomalies';

function metrics(
  overrides: Partial<WeeklyReviewInputMetrics> = {},
): WeeklyReviewInputMetrics {
  return {
    dismissRate: 0.5,
    resurfacedRate: 0.2,
    shownCount: 100,
    ...overrides,
  };
}

function anomaly(
  overrides: Partial<SuggestionLifecycleAnomaly> = {},
): SuggestionLifecycleAnomaly {
  return {
    id: 'a-1',
    type: 'drop',
    severity: 'warning',
    title: 'shown が急減',
    message: 'warning anomaly',
    currentShown: 10,
    previousShown: 20,
    dropRate: 0.5,
    ...overrides,
  };
}

describe('computeWeeklyReviewResult', () => {
  it('全条件を満たすと PASS', () => {
    const result = computeWeeklyReviewResult({
      current: metrics({
        dismissRate: 0.35, // -15pt
        resurfacedRate: 0.1, // -10pt
        shownCount: 80, // 80%
      }),
      previous: metrics(),
    });

    expect(result.status).toBe('PASS');
    expect(result.metrics.deltas.dismissRatePt).toBeCloseTo(-15);
    expect(result.metrics.deltas.resurfacedRatePt).toBeCloseTo(-10);
    expect(result.metrics.deltas.shownCoverage).toBeCloseTo(0.8);
  });

  it('dismissRate の改善不足で FAIL', () => {
    const result = computeWeeklyReviewResult({
      current: metrics({ dismissRate: 0.45 }), // -5pt
      previous: metrics(),
    });

    expect(result.status).toBe('FAIL');
    expect(result.reasons.join('\n')).toContain('dismissRate の改善が不足');
  });

  it('resurfacedRate の改善不足で FAIL', () => {
    const result = computeWeeklyReviewResult({
      current: metrics({
        dismissRate: 0.35,
        resurfacedRate: 0.17, // -3pt
      }),
      previous: metrics(),
    });

    expect(result.status).toBe('FAIL');
    expect(result.reasons.join('\n')).toContain('resurfacedRate の改善が不足');
  });

  it('shownCount 比率不足で FAIL', () => {
    const result = computeWeeklyReviewResult({
      current: metrics({
        dismissRate: 0.35,
        resurfacedRate: 0.1,
        shownCount: 69,
      }),
      previous: metrics({ shownCount: 100 }),
    });

    expect(result.status).toBe('FAIL');
    expect(result.reasons.join('\n')).toContain('shownCount が前期間比');
  });

  it('shownCount 最低件数不足で FAIL', () => {
    const result = computeWeeklyReviewResult({
      current: metrics({
        dismissRate: 0.35,
        resurfacedRate: 0.1,
        shownCount: 19,
      }),
      previous: metrics({ shownCount: 20 }),
    });

    expect(result.status).toBe('FAIL');
    expect(result.reasons.join('\n')).toContain('shownCount が 19 件');
  });

  it('閾値ちょうどは PASS（境界値）', () => {
    const result = computeWeeklyReviewResult({
      current: metrics({
        dismissRate: 0.4, // -10pt
        resurfacedRate: 0.15, // -5pt
        shownCount: 70, // 70%
      }),
      previous: metrics({
        dismissRate: 0.5,
        resurfacedRate: 0.2,
        shownCount: 100,
      }),
    });

    expect(result.status).toBe('PASS');
    expect(result.metrics.deltas.dismissRatePt).toBeCloseTo(
      WEEKLY_REVIEW_THRESHOLDS.dismissRateDeltaPtMax,
    );
    expect(result.metrics.deltas.resurfacedRatePt).toBeCloseTo(
      WEEKLY_REVIEW_THRESHOLDS.resurfacedRateDeltaPtMax,
    );
    expect(result.metrics.deltas.shownCoverage).toBeCloseTo(
      WEEKLY_REVIEW_THRESHOLDS.shownCoverageMin,
    );
  });

  it('critical anomaly があれば FAIL 寄り判定にする', () => {
    const result = computeWeeklyReviewResult({
      current: metrics({
        dismissRate: 0.35,
        resurfacedRate: 0.1,
        shownCount: 80,
      }),
      previous: metrics(),
      anomalies: [
        anomaly({
          severity: 'critical',
          type: 'zero',
        }),
      ],
    });

    expect(result.status).toBe('FAIL');
    expect(result.reasons.join('\n')).toContain('critical anomaly を検知');
  });

  it('warning anomaly のみなら PASS を維持し補助理由を出す', () => {
    const result = computeWeeklyReviewResult({
      current: metrics({
        dismissRate: 0.35,
        resurfacedRate: 0.1,
        shownCount: 80,
      }),
      previous: metrics(),
      anomalies: [anomaly()],
    });

    expect(result.status).toBe('PASS');
    expect(result.reasons.join('\n')).toContain('warning anomaly を検知');
  });
});


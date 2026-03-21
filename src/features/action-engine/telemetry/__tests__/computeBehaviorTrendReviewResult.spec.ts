import { describe, expect, it } from 'vitest';
import type { SuggestionTelemetryByRule } from '../summarizeSuggestionTelemetry';
import {
  BEHAVIOR_TREND_REVIEW_CTA_DELTA_MIN_PT,
  BEHAVIOR_TREND_REVIEW_MIN_SHOWN,
  computeBehaviorTrendReviewResult,
} from '../computeBehaviorTrendReviewResult';

function row(
  ruleId: string,
  shown: number,
  clicked: number,
  dismissed: number,
): SuggestionTelemetryByRule {
  return {
    ruleId,
    shown,
    clicked,
    dismissed,
    snoozed: 0,
    resurfaced: 0,
    rates: {
      cta: shown > 0 ? clicked / shown : 0,
      dismiss: shown > 0 ? dismissed / shown : 0,
      snooze: 0,
      resurfaced: 0,
      noResponse: shown > 0 ? (shown - clicked - dismissed) / shown : 0,
    },
  };
}

describe('computeBehaviorTrendReviewResult', () => {
  it('min shown 未満は NO_DATA', () => {
    const result = computeBehaviorTrendReviewResult({
      currentByRule: [row('behavior-trend-increase', 10, 2, 5)],
      previousByRule: [row('behavior-trend-increase', 12, 2, 6)],
    });

    expect(result.status).toBe('NO_DATA');
    expect(result.reasons.join('\n')).toContain('shown 件数が不足');
  });

  it('dismissRate 改善かつ ctaRate の悪化が許容内なら PASS', () => {
    const result = computeBehaviorTrendReviewResult({
      currentByRule: [row('behavior-trend-increase', 30, 11, 12)], // cta 36.7 / dismiss 40.0
      previousByRule: [row('behavior-trend-increase', 30, 12, 15)], // cta 40.0 / dismiss 50.0
    });

    expect(result.status).toBe('PASS');
    expect(result.reasons[0]).toContain('許容範囲内');
  });

  it('dismissRate が悪化すると FAIL', () => {
    const result = computeBehaviorTrendReviewResult({
      currentByRule: [row('behavior-trend-increase', 30, 12, 16)], // dismiss 53.3
      previousByRule: [row('behavior-trend-increase', 30, 12, 15)], // dismiss 50.0
    });

    expect(result.status).toBe('FAIL');
    expect(result.reasons.join('\n')).toContain('dismissRate が悪化');
  });

  it('ctaRate の悪化が閾値を下回ると FAIL', () => {
    const result = computeBehaviorTrendReviewResult({
      currentByRule: [row('behavior-trend-increase', 30, 7, 12)], // cta 23.3
      previousByRule: [row('behavior-trend-increase', 30, 10, 12)], // cta 33.3
      ctaRateDeltaMinPt: BEHAVIOR_TREND_REVIEW_CTA_DELTA_MIN_PT,
    });

    expect(result.status).toBe('FAIL');
    expect(result.reasons.join('\n')).toContain('ctaRate が悪化');
  });

  it('対象 rule のみで評価する', () => {
    const result = computeBehaviorTrendReviewResult({
      currentByRule: [
        row('behavior-trend-increase', 25, 9, 10),
        row('assessment-stale', 500, 0, 500),
      ],
      previousByRule: [
        row('behavior-trend-increase', 30, 12, 15),
        row('assessment-stale', 500, 500, 0),
      ],
      minShownCount: BEHAVIOR_TREND_REVIEW_MIN_SHOWN,
    });

    expect(result.current.shown).toBe(25);
    expect(result.previous.shown).toBe(30);
    expect(result.status).toBe('PASS');
  });
});

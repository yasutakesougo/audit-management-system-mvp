import { describe, expect, it } from 'vitest';
import type { SuggestionTelemetryByRule } from '../summarizeSuggestionTelemetry';
import {
  ASSESSMENT_STALE_REVIEW_MIN_SHOWN,
  computeAssessmentStaleReviewResult,
} from '../computeAssessmentStaleReviewResult';

function row(
  ruleId: string,
  shown: number,
  dismissed: number,
  snoozed: number,
  resurfaced: number,
): SuggestionTelemetryByRule {
  return {
    ruleId,
    shown,
    clicked: 0,
    dismissed,
    snoozed,
    resurfaced,
    rates: {
      cta: 0,
      dismiss: shown > 0 ? dismissed / shown : 0,
      snooze: shown > 0 ? snoozed / shown : 0,
      resurfaced: snoozed > 0 ? resurfaced / snoozed : 0,
      noResponse: 0,
    },
  };
}

describe('computeAssessmentStaleReviewResult', () => {
  it('min shown 未満は NO_DATA', () => {
    const result = computeAssessmentStaleReviewResult({
      currentByRule: [row('data-insufficiency', 10, 1, 2, 1)],
      previousByRule: [row('data-insufficiency', 12, 1, 2, 1)],
    });

    expect(result.status).toBe('NO_DATA');
    expect(result.reasons.join('\n')).toContain('shown 件数が不足');
  });

  it('snoozeRate/resurfacedRate がともに改善または維持なら PASS', () => {
    const result = computeAssessmentStaleReviewResult({
      currentByRule: [
        row('data-insufficiency', 30, 6, 6, 2), // 20%, 33.3%
      ],
      previousByRule: [
        row('data-insufficiency', 30, 6, 9, 4), // 30%, 44.4%
      ],
    });

    expect(result.status).toBe('PASS');
    expect(result.reasons[0]).toContain('前期間以下');
  });

  it('snoozeRate が悪化すると FAIL', () => {
    const result = computeAssessmentStaleReviewResult({
      currentByRule: [
        row('assessment-stale', 30, 4, 12, 3), // 40%
      ],
      previousByRule: [
        row('assessment-stale', 30, 4, 9, 3), // 30%
      ],
    });

    expect(result.status).toBe('FAIL');
    expect(result.reasons.join('\n')).toContain('snoozeRate が悪化');
  });

  it('resurfacedRate が悪化すると FAIL', () => {
    const result = computeAssessmentStaleReviewResult({
      currentByRule: [
        row('data-insufficiency', 30, 4, 10, 6), // 60%
      ],
      previousByRule: [
        row('data-insufficiency', 30, 4, 10, 4), // 40%
      ],
    });

    expect(result.status).toBe('FAIL');
    expect(result.reasons.join('\n')).toContain('resurfacedRate が悪化');
  });

  it('assessment-stale と data-insufficiency を合算評価する', () => {
    const result = computeAssessmentStaleReviewResult({
      currentByRule: [
        row('assessment-stale', 10, 1, 2, 1),
        row('data-insufficiency', 15, 2, 3, 1),
      ],
      previousByRule: [
        row('assessment-stale', 12, 1, 4, 2),
        row('data-insufficiency', 18, 2, 5, 3),
      ],
      minShownCount: ASSESSMENT_STALE_REVIEW_MIN_SHOWN,
    });

    expect(result.status).toBe('PASS');
    expect(result.current.shown).toBe(25);
    expect(result.previous.shown).toBe(30);
  });
});


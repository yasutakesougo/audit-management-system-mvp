import type { SuggestionTelemetryByRule } from './summarizeSuggestionTelemetry';

export type AssessmentStaleReviewStatus = 'PASS' | 'FAIL' | 'NO_DATA';

export type AssessmentStaleLifecycleSnapshot = {
  shown: number;
  dismissed: number;
  snoozed: number;
  resurfaced: number;
  dismissRate: number;
  snoozeRate: number;
  resurfacedRate: number;
};

export type AssessmentStaleReviewResult = {
  status: AssessmentStaleReviewStatus;
  reasons: string[];
  current: AssessmentStaleLifecycleSnapshot;
  previous: AssessmentStaleLifecycleSnapshot;
  deltas: {
    shownCount: number;
    snoozeRatePt: number;
    resurfacedRatePt: number;
  };
};

export type ComputeAssessmentStaleReviewResultInput = {
  currentByRule: SuggestionTelemetryByRule[];
  previousByRule: SuggestionTelemetryByRule[];
  minShownCount?: number;
};

export const ASSESSMENT_STALE_RULE_ALIASES = [
  'assessment-stale',
  'data-insufficiency',
] as const;

export const ASSESSMENT_STALE_REVIEW_MIN_SHOWN = 20;

function buildSnapshot(
  rows: SuggestionTelemetryByRule[],
): AssessmentStaleLifecycleSnapshot {
  const shown = rows.reduce((sum, row) => sum + row.shown, 0);
  const dismissed = rows.reduce((sum, row) => sum + row.dismissed, 0);
  const snoozed = rows.reduce((sum, row) => sum + row.snoozed, 0);
  const resurfaced = rows.reduce((sum, row) => sum + row.resurfaced, 0);

  return {
    shown,
    dismissed,
    snoozed,
    resurfaced,
    dismissRate: shown > 0 ? dismissed / shown : 0,
    snoozeRate: shown > 0 ? snoozed / shown : 0,
    resurfacedRate: snoozed > 0 ? resurfaced / snoozed : 0,
  };
}

/**
 * #1167 assessment-stale（alias: data-insufficiency）の週次効果を評価する。
 * PASS 条件:
 * - snoozeRate が前期間以下
 * - resurfacedRate が前期間以下
 */
export function computeAssessmentStaleReviewResult(
  input: ComputeAssessmentStaleReviewResultInput,
): AssessmentStaleReviewResult {
  const {
    currentByRule,
    previousByRule,
    minShownCount = ASSESSMENT_STALE_REVIEW_MIN_SHOWN,
  } = input;

  const aliasSet = new Set<string>(ASSESSMENT_STALE_RULE_ALIASES);
  const currentRows = currentByRule.filter((row) => aliasSet.has(row.ruleId));
  const previousRows = previousByRule.filter((row) => aliasSet.has(row.ruleId));

  const current = buildSnapshot(currentRows);
  const previous = buildSnapshot(previousRows);
  const deltas = {
    shownCount: current.shown - previous.shown,
    snoozeRatePt: (current.snoozeRate - previous.snoozeRate) * 100,
    resurfacedRatePt: (current.resurfacedRate - previous.resurfacedRate) * 100,
  };

  if (current.shown < minShownCount || previous.shown < minShownCount) {
    return {
      status: 'NO_DATA',
      reasons: [
        `shown 件数が不足（current=${current.shown}, previous=${previous.shown}, min=${minShownCount}）`,
      ],
      current,
      previous,
      deltas,
    };
  }

  const failReasons: string[] = [];
  if (current.snoozeRate > previous.snoozeRate) {
    failReasons.push(
      `snoozeRate が悪化（${(previous.snoozeRate * 100).toFixed(1)}% → ${(current.snoozeRate * 100).toFixed(1)}%）`,
    );
  }
  if (current.resurfacedRate > previous.resurfacedRate) {
    failReasons.push(
      `resurfacedRate が悪化（${(previous.resurfacedRate * 100).toFixed(1)}% → ${(current.resurfacedRate * 100).toFixed(1)}%）`,
    );
  }

  if (failReasons.length === 0) {
    return {
      status: 'PASS',
      reasons: ['snoozeRate / resurfacedRate ともに前期間以下'],
      current,
      previous,
      deltas,
    };
  }

  return {
    status: 'FAIL',
    reasons: failReasons,
    current,
    previous,
    deltas,
  };
}


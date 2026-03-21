import type { SuggestionTelemetryByRule } from './summarizeSuggestionTelemetry';

export type BehaviorTrendReviewStatus = 'PASS' | 'FAIL' | 'NO_DATA';

export type BehaviorTrendLifecycleSnapshot = {
  shown: number;
  clicked: number;
  dismissed: number;
  ctaRate: number;
  dismissRate: number;
};

export type BehaviorTrendReviewResult = {
  status: BehaviorTrendReviewStatus;
  reasons: string[];
  current: BehaviorTrendLifecycleSnapshot;
  previous: BehaviorTrendLifecycleSnapshot;
  deltas: {
    shownCount: number;
    ctaRatePt: number;
    dismissRatePt: number;
  };
};

export type ComputeBehaviorTrendReviewResultInput = {
  currentByRule: SuggestionTelemetryByRule[];
  previousByRule: SuggestionTelemetryByRule[];
  minShownCount?: number;
  ctaRateDeltaMinPt?: number;
};

export const BEHAVIOR_TREND_RULE_ALIASES = ['behavior-trend-increase'] as const;
export const BEHAVIOR_TREND_REVIEW_MIN_SHOWN = 20;
export const BEHAVIOR_TREND_REVIEW_CTA_DELTA_MIN_PT = -5;

function buildSnapshot(
  rows: SuggestionTelemetryByRule[],
): BehaviorTrendLifecycleSnapshot {
  const shown = rows.reduce((sum, row) => sum + row.shown, 0);
  const clicked = rows.reduce((sum, row) => sum + row.clicked, 0);
  const dismissed = rows.reduce((sum, row) => sum + row.dismissed, 0);

  return {
    shown,
    clicked,
    dismissed,
    ctaRate: shown > 0 ? clicked / shown : 0,
    dismissRate: shown > 0 ? dismissed / shown : 0,
  };
}

/**
 * #1166 behavior-trend-increase の週次効果を評価する。
 * PASS 条件:
 * - dismissRate が前期間以下
 * - ctaRate の悪化が閾値以内（既定: -5pt まで許容）
 */
export function computeBehaviorTrendReviewResult(
  input: ComputeBehaviorTrendReviewResultInput,
): BehaviorTrendReviewResult {
  const {
    currentByRule,
    previousByRule,
    minShownCount = BEHAVIOR_TREND_REVIEW_MIN_SHOWN,
    ctaRateDeltaMinPt = BEHAVIOR_TREND_REVIEW_CTA_DELTA_MIN_PT,
  } = input;

  const aliasSet = new Set<string>(BEHAVIOR_TREND_RULE_ALIASES);
  const currentRows = currentByRule.filter((row) => aliasSet.has(row.ruleId));
  const previousRows = previousByRule.filter((row) => aliasSet.has(row.ruleId));

  const current = buildSnapshot(currentRows);
  const previous = buildSnapshot(previousRows);
  const deltas = {
    shownCount: current.shown - previous.shown,
    ctaRatePt: (current.ctaRate - previous.ctaRate) * 100,
    dismissRatePt: (current.dismissRate - previous.dismissRate) * 100,
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
  if (current.dismissRate > previous.dismissRate) {
    failReasons.push(
      `dismissRate が悪化（${(previous.dismissRate * 100).toFixed(1)}% → ${(current.dismissRate * 100).toFixed(1)}%）`,
    );
  }

  if (deltas.ctaRatePt < ctaRateDeltaMinPt) {
    failReasons.push(
      `ctaRate が悪化（Δ ${deltas.ctaRatePt.toFixed(1)}pt / 許容 >= ${ctaRateDeltaMinPt.toFixed(1)}pt）`,
    );
  }

  if (failReasons.length === 0) {
    return {
      status: 'PASS',
      reasons: ['dismissRate は前期間以下、ctaRate も許容範囲内'],
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

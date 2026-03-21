import type { SuggestionLifecycleAnomaly } from './detectSuggestionLifecycleAnomalies';

export type WeeklyReviewInputMetrics = {
  dismissRate: number;
  resurfacedRate: number;
  shownCount: number;
};

export type WeeklyReviewMetrics = {
  current: WeeklyReviewInputMetrics;
  previous: WeeklyReviewInputMetrics;
  deltas: {
    dismissRatePt: number;
    resurfacedRatePt: number;
    shownCount: number;
    shownCoverage: number;
  };
};

export type WeeklyReviewResult = {
  status: 'PASS' | 'FAIL';
  reasons: string[];
  metrics: WeeklyReviewMetrics;
};

export type ComputeWeeklyReviewResultInput = {
  current: WeeklyReviewInputMetrics;
  previous: WeeklyReviewInputMetrics;
  anomalies?: SuggestionLifecycleAnomaly[];
};

export const WEEKLY_REVIEW_THRESHOLDS = {
  dismissRateDeltaPtMax: -10,
  resurfacedRateDeltaPtMax: -5,
  shownCoverageMin: 0.7,
  shownCurrentMin: 20,
} as const;

function toPercentPoint(rate: number): number {
  return rate * 100;
}

/**
 * corrective-action telemetry の週次レビュー結果を機械判定する。
 */
export function computeWeeklyReviewResult(
  input: ComputeWeeklyReviewResultInput,
): WeeklyReviewResult {
  const { current, previous, anomalies = [] } = input;

  const dismissRatePt = toPercentPoint(current.dismissRate)
    - toPercentPoint(previous.dismissRate);
  const resurfacedRatePt = toPercentPoint(current.resurfacedRate)
    - toPercentPoint(previous.resurfacedRate);
  const shownCoverage = previous.shownCount > 0
    ? current.shownCount / previous.shownCount
    : 1;
  const shownCountDelta = current.shownCount - previous.shownCount;

  const failReasons: string[] = [];
  const infoReasons: string[] = [];

  if (dismissRatePt > WEEKLY_REVIEW_THRESHOLDS.dismissRateDeltaPtMax) {
    failReasons.push(
      `dismissRate の改善が不足（Δ ${dismissRatePt.toFixed(1)}pt / 要件 <= ${WEEKLY_REVIEW_THRESHOLDS.dismissRateDeltaPtMax}pt）`,
    );
  }

  if (resurfacedRatePt > WEEKLY_REVIEW_THRESHOLDS.resurfacedRateDeltaPtMax) {
    failReasons.push(
      `resurfacedRate の改善が不足（Δ ${resurfacedRatePt.toFixed(1)}pt / 要件 <= ${WEEKLY_REVIEW_THRESHOLDS.resurfacedRateDeltaPtMax}pt）`,
    );
  }

  if (current.shownCount < previous.shownCount * WEEKLY_REVIEW_THRESHOLDS.shownCoverageMin) {
    failReasons.push(
      `shownCount が前期間比 ${Math.round(shownCoverage * 100)}%（要件 >= ${Math.round(WEEKLY_REVIEW_THRESHOLDS.shownCoverageMin * 100)}%）`,
    );
  }

  if (current.shownCount < WEEKLY_REVIEW_THRESHOLDS.shownCurrentMin) {
    failReasons.push(
      `shownCount が ${current.shownCount} 件（要件 >= ${WEEKLY_REVIEW_THRESHOLDS.shownCurrentMin} 件）`,
    );
  }

  const criticalAnomalies = anomalies.filter((a) => a.severity === 'critical');
  if (criticalAnomalies.length > 0) {
    failReasons.push(
      `critical anomaly を検知（${criticalAnomalies.length}件）`,
    );
  }

  const warningAnomalies = anomalies.filter((a) => a.severity === 'warning');
  if (warningAnomalies.length > 0) {
    infoReasons.push(
      `warning anomaly を検知（${warningAnomalies.length}件）`,
    );
  }

  const status: 'PASS' | 'FAIL' = failReasons.length === 0 ? 'PASS' : 'FAIL';
  const reasons = status === 'PASS'
    ? (infoReasons.length > 0 ? infoReasons : ['全ての週次レビュー条件を満たしています'])
    : [...failReasons, ...infoReasons];

  return {
    status,
    reasons,
    metrics: {
      current,
      previous,
      deltas: {
        dismissRatePt,
        resurfacedRatePt,
        shownCount: shownCountDelta,
        shownCoverage,
      },
    },
  };
}


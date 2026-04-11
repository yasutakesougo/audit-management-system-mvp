export const improvementMetricValues = [
  'behavior_frequency',
  'incident_count',
  'intervention_count',
  'duration_minutes',
  'intensity_score',
  'adaptive_behavior_score',
  'derived_behavior_frequency',
  'derived_intensity_avg',
] as const;

export type ImprovementTargetMetric = (typeof improvementMetricValues)[number];

export const improvementConfidenceValues = [
  'low',
  'medium',
  'high',
] as const;

export type ImprovementConfidence = (typeof improvementConfidenceValues)[number];

export type ImprovementOutcome = {
  id: string;
  planningSheetId: string;
  patchId: string;
  observedAt: string;
  targetMetric: ImprovementTargetMetric;
  source: 'manual_kpi' | 'derived';
  metricDefinitionId?: string;
  beforeValue: number;
  afterValue: number;
  changeRate: number;
  isImproved: boolean;
  confidence: ImprovementConfidence;
  evaluationWindowDays?: number;
  createdAt: string;
};

export type ImprovementEvaluationDirection = 'decrease_good' | 'increase_good';

export function evaluateImprovement(input: {
  before: number;
  after: number;
  direction: ImprovementEvaluationDirection;
}): Pick<ImprovementOutcome, 'changeRate' | 'isImproved'> {
  const { before, after, direction } = input;
  const changeRate = before === 0 ? 0 : (after - before) / before;
  const isImproved =
    direction === 'decrease_good'
      ? after < before
      : after > before;

  return {
    changeRate,
    isImproved,
  };
}

export function calculateImprovementFactor(
  outcomes: readonly ImprovementOutcome[],
): number {
  const manualOutcomes = outcomes.filter((outcome) => outcome.source === 'manual_kpi');
  const derivedOutcomes = outcomes.filter((outcome) => outcome.source === 'derived');

  let totalScore = 0;
  let totalWeight = 0;

  if (manualOutcomes.length > 0) {
    const successCount = manualOutcomes.filter((o) => o.isImproved).length;
    totalScore += (successCount / manualOutcomes.length) * 1.0;
    totalWeight += 1.0;
  }

  if (derivedOutcomes.length > 0) {
    const successCount = derivedOutcomes.filter((o) => o.isImproved).length;
    totalScore += (successCount / derivedOutcomes.length) * 0.2; // Derived is weak
    totalWeight += 0.2;
  }

  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

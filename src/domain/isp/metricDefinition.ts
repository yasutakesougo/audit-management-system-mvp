import type { ImprovementTargetMetric } from './improvementOutcome';

export type MetricDirection = 'decrease_good' | 'increase_good';
export type MetricSource = 'manual' | 'derived';
export type MetricUnit = 'count' | 'minutes' | 'score';

export type MetricDefinition = {
  id: ImprovementTargetMetric;
  name: string;
  direction: MetricDirection;
  unit: MetricUnit;
  source: MetricSource;
  description?: string;
};

export const DEFAULT_METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    id: 'behavior_frequency',
    name: '問題行動の発生回数',
    direction: 'decrease_good',
    unit: 'count',
    source: 'manual',
    description: '観察期間内の対象行動の発生回数',
  },
  {
    id: 'incident_count',
    name: 'トラブル・インシデント件数',
    direction: 'decrease_good',
    unit: 'count',
    source: 'manual',
    description: 'ヒヤリハット、事故、物損などの発生件数',
  },
  {
    id: 'intervention_count',
    name: '支援介入（制止等）回数',
    direction: 'decrease_good',
    unit: 'count',
    source: 'manual',
    description: 'パニック抑制、身体的制止が必要になった回数',
  },
  {
    id: 'duration_minutes',
    name: '問題行動の継続時間',
    direction: 'decrease_good',
    unit: 'minutes',
    source: 'manual',
    description: '対象行動が持続した合計時間（分）',
  },
  {
    id: 'intensity_score',
    name: '行動の強度スコア',
    direction: 'decrease_good',
    unit: 'score',
    source: 'manual',
    description: '行動強度を数値化したスコア（自傷、他害、破壊などの程度）',
  },
  {
    id: 'adaptive_behavior_score',
    name: '適応行動スコア',
    direction: 'increase_good',
    unit: 'score',
    source: 'manual',
    description: '代替行動や望ましい行動の達成度スコア',
  },
  {
    id: 'derived_behavior_frequency',
    name: '【自動】行動発生数',
    direction: 'decrease_good',
    unit: 'count',
    source: 'derived',
    description: 'ABC記録から自動算出される発生頻度（推定値）',
  },
  {
    id: 'derived_intensity_avg',
    name: '【自動】平均強度ランク',
    direction: 'decrease_good',
    unit: 'score',
    source: 'derived',
    description: 'ABC記録から自動算出される平均的な行動強度（推定値）',
  },
] as const;

export function getMetricDefinition(metricId: string): MetricDefinition | null {
  return DEFAULT_METRIC_DEFINITIONS.find((metric) => metric.id === metricId) ?? null;
}

import type { AbcRecord } from '../abc/abcRecord';
import type { ImprovementOutcome, ImprovementTargetMetric } from './improvementOutcome';
import type { MetricDefinition } from './metricDefinition';

export type AbcWindow = {
  after: AbcRecord[];
  before: AbcRecord[];
};

/**
 * ABC 記録から改善評価（Outcome）を自動算出する
 */
export function deriveImprovementOutcome(
  metric: MetricDefinition,
  window: AbcWindow,
  context: { planningSheetId: string; patchId: string; observedAt: string }
): ImprovementOutcome | null {
  if (metric.source !== 'derived') return null;

  let beforeValue = 0;
  let afterValue = 0;

  // 重要：データ不足の場合はノイズ抑制のため生成しない（安全装置）
  if (window.before.length < 5 || window.after.length < 5) {
    return null;
  }

  switch (metric.id) {
    case 'derived_behavior_frequency':
      beforeValue = window.before.length;
      afterValue = window.after.length;
      break;

    case 'derived_intensity_avg': {
      const intensityWeight: Record<string, number> = { low: 1, medium: 2, high: 3 };
      beforeValue = window.before.length === 0 ? 0 : 
        window.before.reduce((sum, r) => sum + (intensityWeight[r.intensity] || 1), 0) / window.before.length;
      afterValue = window.after.length === 0 ? 0 :
        window.after.reduce((sum, r) => sum + (intensityWeight[r.intensity] || 1), 0) / window.after.length;
      break;
    }

    default:
      return null;
  }

  const changeRate = beforeValue === 0 ? 0 : (afterValue - beforeValue) / beforeValue;
  const isImproved = metric.direction === 'decrease_good' 
    ? afterValue < beforeValue 
    : afterValue > beforeValue;

  return {
    id: `derived-${metric.id}-${context.patchId}`,
    planningSheetId: context.planningSheetId,
    patchId: context.patchId,
    observedAt: context.observedAt,
    targetMetric: metric.id as ImprovementTargetMetric,
    source: 'derived',
    metricDefinitionId: metric.id,
    beforeValue,
    afterValue,
    changeRate,
    isImproved,
    confidence: 'low', // 推定値は常に信頼度：低
    createdAt: new Date().toISOString(),
  };
}

import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import type { FormState } from './components/new-form/types';

/**
 * 氷山分析の Draft 群を PlanningSheet の FormState にマッピングする。
 * 
 * マッピング方針:
 * - targetBehavior: 最初の行動ノードをセット（空の場合のみ）
 * - triggers: 全ての triggerFactors をカンマ区切りで集約
 * - environmentFactors: 同上（重複を許容するか、triggers と分けるかは運用次第。ここでは triggers に集約）
 */
export function icebergToPlanningBridge(drafts: BehaviorInterventionPlan[]): Partial<FormState> {
  if (drafts.length === 0) return {};

  const firstDraft = drafts[0];
  const allTriggers = Array.from(new Set(drafts.flatMap(d => d.triggerFactors.map(t => t.label))));

  return {
    targetBehavior: firstDraft.targetBehavior,
    triggers: allTriggers.join(', '),
    environmentFactors: allTriggers.join(', '), // Iceberg では区別が難しいため両方に入れる
  };
}

export interface IcebergImportResult {
  formPatches: Partial<FormState>;
  summary: {
    behaviorCount: number;
    triggerCount: number;
  };
}

export function buildIcebergImportResult(drafts: BehaviorInterventionPlan[]): IcebergImportResult {
  const patches = icebergToPlanningBridge(drafts);
  const allTriggers = Array.from(new Set(drafts.flatMap(d => d.triggerFactors.map(t => t.label))));

  return {
    formPatches: patches,
    summary: {
      behaviorCount: drafts.length,
      triggerCount: allTriggers.length,
    }
  };
}

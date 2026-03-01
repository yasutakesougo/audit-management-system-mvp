// ---------------------------------------------------------------------------
// toBipOptions — Domain bridge utility
//
// BehaviorInterventionPlan → BipOption 変換。
// Daily ドメインが Analysis ドメインの型に直接依存しないための DTO 変換層。
// ---------------------------------------------------------------------------
import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';

/**
 * ProcedureEditor に渡す BIP の軽量参照型。
 * Daily ドメイン内に閉じた型で、Analysis ドメインへの依存を遮断する。
 */
export type BipOption = {
  id: string;
  /** 表示ラベル（例: "他害（引き金: 騒音）"） */
  label: string;
};

/**
 * BehaviorInterventionPlan の配列を BipOption の配列に変換する。
 *
 * @example
 * ```ts
 * const plans = interventionStore.getByUserId('user-1');
 * const options = toBipOptions(plans);
 * // → [{ id: 'bip-1', label: '他害（引き金: 騒音, 順番待ち）' }]
 * ```
 */
export function toBipOptions(plans: BehaviorInterventionPlan[]): BipOption[] {
  return plans.map((plan) => {
    const triggers =
      plan.triggerFactors.length > 0
        ? `（引き金: ${plan.triggerFactors.map((f) => f.label).join(', ')}）`
        : '';
    return {
      id: plan.id,
      label: `${plan.targetBehavior}${triggers}`,
    };
  });
}

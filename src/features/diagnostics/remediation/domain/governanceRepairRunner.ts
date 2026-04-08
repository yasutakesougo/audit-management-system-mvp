import { RepairPlan, RepairRunResult } from "./repairTypes";

/**
 * GovernanceRepairRunner — 修復計画を実行する。
 * 現段階では実際の修復は行わず、dry-run モードでのみ動作する。
 */
export const runGovernanceRepairs = async (
  plans: RepairPlan[],
  mode: 'dry_run' | 'live' = 'dry_run'
): Promise<RepairRunResult> => {
  const timestamp = new Date().toISOString();
  
  // 安全装置: 明示的に 'live' かつ safeToAutoExecute が true のもの以外は実行しない（現時点では live もシミュレート）
  const results = plans.map(plan => {
    const isActuallyRepairable = plan.safeToAutoExecute;
    
    if (mode === 'dry_run') {
      return {
        id: plan.id,
        success: true,
        auditLog: `[Dry-Run] Would repair ${plan.listKey}:${plan.targetField || 'list'}. Intent: ${plan.intent}`,
      };
    }
    
    // Live モード（プロトタイプ）
    if (!isActuallyRepairable) {
      return {
        id: plan.id,
        success: false,
        error: "Execution blocked: High risk level or missing approval.",
        auditLog: `[Live-Blocked] ${plan.listKey}:${plan.targetField || 'list'}. Reason: ${plan.reason}`,
      };
    }
    
    return {
      id: plan.id,
      success: true,
      auditLog: `[Live-Simulated] Repaired ${plan.listKey}:${plan.targetField}. Payload: ${JSON.stringify(plan.payload)}`,
    };
  });

  return {
    mode,
    timestamp,
    plans,
    executedCount: results.filter(r => r.success && mode === 'live').length,
    blockedCount: results.filter(r => !r.success).length,
    results,
  };
};

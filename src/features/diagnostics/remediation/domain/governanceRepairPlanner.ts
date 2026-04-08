import { HealthCheckResult } from "../../health/types";
import { RepairPlan } from "./repairTypes";

/**
 * 診断結果から実行可能な修復計画を組み立てる。
 * 現在のスコープでは 'auto_heal' 判定となった項目のみを対象とする。
 */
export const planGovernanceRepairs = (results: HealthCheckResult[]): RepairPlan[] => {
  return results
    .filter(r => r.governance?.action === 'auto_heal')
    .map(r => {
      const g = r.governance!;
      const evidence = (r.evidence || {}) as Record<string, unknown>;
      const drifted = Array.isArray(evidence.drifted) ? (evidence.drifted as Record<string, unknown>[]) : [];
      
      // 修復インテントの判定
      const isSchemaDrift = r.category === 'schema' && drifted.length > 0;
      
      return {
        id: r.key,
        listKey: typeof evidence.listKey === 'string' ? evidence.listKey : 'unknown',
        listTitle: typeof evidence.listTitle === 'string' ? evidence.listTitle : r.label,
        targetField: (typeof drifted[0]?.expected === 'string' ? drifted[0].expected : (typeof evidence.targetField === 'string' ? evidence.targetField : undefined)) as string | undefined,
        driftType: (typeof drifted[0]?.driftType === 'string' ? drifted[0].driftType : (typeof evidence.driftType === 'string' ? evidence.driftType : undefined)) as string | undefined,
        action: g.action,
        intent: isSchemaDrift ? 'schema_update' : 'data_patch',
        payload: {
          drifted: evidence.drifted,
          originalEvidence: evidence,
        },
        safeToAutoExecute: g.action === 'auto_heal' && g.riskLevel === 'low',
        reason: r.summary,
        auditMessage: `[Auto-Heal] ${r.label}: ${r.summary}`,
      };
    });
};

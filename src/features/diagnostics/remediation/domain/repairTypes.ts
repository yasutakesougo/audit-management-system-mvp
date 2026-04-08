import { GovernanceAction } from "../../governance/governanceEngine";

/**
 * RepairPlan — 実行可能な修復計画
 */
export interface RepairPlan {
  id: string;             // 基になった HealthCheckResult.key
  listKey: string;
  listTitle: string;
  targetField?: string;
  driftType?: string;
  action: GovernanceAction;
  intent: 'schema_update' | 'index_create' | 'data_patch';
  payload: Record<string, unknown>;
  
  // 運用メタデータ
  safeToAutoExecute: boolean;
  reason: string;
  auditMessage: string;
}

/**
 * RepairRunResult — 修復実行（または Dry-run）の結果サマリー
 */
export interface RepairRunResult {
  mode: 'dry_run' | 'live';
  timestamp: string;
  plans: RepairPlan[];
  executedCount: number;
  blockedCount: number;
  results: {
    id: string;
    success: boolean;
    error?: string;
    auditLog: string;
  }[];
}

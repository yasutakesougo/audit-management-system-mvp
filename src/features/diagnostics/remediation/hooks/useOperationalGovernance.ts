import React from 'react';
import { usePersistentDrift } from '../../drift/hooks/usePersistentDrift';
import { SP_LIST_REGISTRY } from '@/sharepoint/spListRegistry';
import { 
  deriveGovernanceRecommendations, 
  type GovernanceRecommendation 
} from '../domain/governanceAdvisor';
import { 
  executeGovernanceRepair, 
  type GovernanceRepairResult 
} from '../domain/governanceRepairExecutor';
import { useSP } from '@/lib/spClient';
import { auditLog } from '@/lib/debugLogger';
import { toast } from 'react-hot-toast';
import { GovernanceAuditStore } from '../domain/governanceAuditStore';

export interface OperationalGovernanceState {
  recommendations: GovernanceRecommendation[];
  loading: boolean;
  error: string | null;
  executingIds: Set<string>;
  results: Record<string, GovernanceRepairResult>;
}

/**
 * Unified Operational Governance Hook (Phase 2-B)
 * 
 * Orchestrates drift detection and remediation recommendations.
 */
export function useOperationalGovernance() {
  const { persistentDrifts, loading: loadingDrift, error: driftError } = usePersistentDrift();
  const sp = useSP();
  
  const [executingIds, setExecutingIds] = React.useState<Set<string>>(new Set());
  const [results, setResults] = React.useState<Record<string, GovernanceRepairResult>>({});

  // 1. Derive recommendations from raw signals
  const recommendations = React.useMemo(() => {
    return deriveGovernanceRecommendations(SP_LIST_REGISTRY, persistentDrifts);
  }, [persistentDrifts]);

  // 2. Repair Execution
  const repair = async (recommendation: GovernanceRecommendation, options: { dryRun?: boolean } = {}) => {
    if (!sp) return;

    const auditStore = GovernanceAuditStore.getInstance();
    
    setExecutingIds(prev => new Set(prev).add(recommendation.id));
    
    // Audit Context
    const auditContext = {
      recommendationId: recommendation.id,
      reasonKey: `${recommendation.listKey}:${recommendation.targetField}`,
      listKey: recommendation.listKey,
      actionType: recommendation.action.type,
      recommendedAction: recommendation.action.label,
      confidence: recommendation.action.confidence,
      autoExecutable: recommendation.action.autoExecutable,
      priorityScore: recommendation.priority.score,
      priorityLevel: recommendation.priority.level,
      status: 'suggested' as const,
    };

    try {
      if (options.dryRun) {
        auditLog.info('governance:dryrun', `[Audit] DRY RUN: Would execute ${recommendation.id}`, auditContext);
        
        // Record as Dry-Run Pass in Store
        auditStore.logDecision({
          ...auditContext,
          status: 'dry_run_passed',
          simulatedResult: 'passed'
        });

        await new Promise(r => setTimeout(r, 800)); // Simulate latency
        
        const dryRes: GovernanceRepairResult = {
          recommendationId: recommendation.id,
          status: 'success',
          actionPerformed: recommendation.action.type,
          timestamp: new Date().toISOString(),
          errorDetail: `(Dry Run: Confidence=${recommendation.action.confidence})`,
        };
        setResults(prev => ({ ...prev, [recommendation.id]: dryRes }));
        toast(`[検証] ${recommendation.action.label} (確信度: ${recommendation.action.confidence})`, { icon: 'ℹ️' });
        return;
      }

      auditLog.info('governance:audit', `[Audit] Executing ${recommendation.id}`, auditContext);
      const res = await executeGovernanceRepair(sp, recommendation);
      
      setResults(prev => ({ ...prev, [recommendation.id]: res }));
      
      if (res.status === 'success') {
        auditLog.info('governance:audit_success', `[Audit] Success: ${recommendation.id}`, { result: res });
        
        // Finalize Audit Trace (Success)
        auditStore.logDecision({
          ...auditContext,
          status: 'executed',
          operatorDecision: 'executed',
          simulatedResult: 'passed'
        });

        toast.success(`修復完了: ${recommendation.action.label}`);
      } else {
        auditLog.error('governance:audit_fail', `[Audit] Failed: ${recommendation.id}`, { error: res.errorDetail });
        
        auditStore.logDecision({
          ...auditContext,
          status: 'failed',
          simulatedResult: 'failed',
          errorMessage: res.errorDetail
        });

        toast.error(`修復失敗: ${res.errorDetail}`);
      }
    } catch (err) {
      auditLog.error('governance:audit_error', `[Audit] Fatal error during ${recommendation.id}`, { err });
      toast.error('予期せぬエラーが発生しました');
    } finally {
      setExecutingIds(prev => {
        const next = new Set(prev);
        next.delete(recommendation.id);
        return next;
      });
    }
  };

  return {
    recommendations,
    loading: loadingDrift,
    error: driftError,
    executingIds,
    results,
    repair,
    refresh: () => {
       // Future: manual trigger for patrol refresh if needed
    }
  };
}

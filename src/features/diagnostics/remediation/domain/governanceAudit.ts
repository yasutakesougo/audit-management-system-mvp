import { type GovernancePriorityLevel } from './governanceAdvisor';

/**
 * Governance Audit OS — 運用OSの判断と実行を記録し、学習するための基盤
 */

export interface GovernanceAuditEntry {
  id: string;
  timestamp: string;
  recommendationId: string;
  reasonKey: string;           // SP List + Field key
  listKey: string;
  actionType: string;
  recommendedAction: string;   // Human readable action text
  
  // System Decision (Reasoning context)
  confidence: 'high' | 'medium' | 'low';
  autoExecutable: boolean;
  priorityScore: number;
  priorityLevel: GovernancePriorityLevel;
  
  // Outcome
  status: 'suggested' | 'dry_run_passed' | 'executed' | 'ignored' | 'modified' | 'failed';
  operatorDecision?: 'executed' | 'ignored' | 'modified';
  /** 判断の理由や修正内容のメモ（ignored/modified時のキャリブレーション用） */
  operatorComment?: string;
  simulatedResult?: 'passed' | 'failed'; 
  
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface GovernanceAuditSummary {
  totalRecommendations: number;
  autoExecuteSuccessRate: number; // システムの自動判断が人間と一致した割合
  integrityRestoredCount: number;
}

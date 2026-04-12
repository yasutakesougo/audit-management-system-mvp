import type { IspRecommendationDecision } from './ispRecommendationDecisionTypes';
import type { IspRecommendationLevel } from './ispRecommendationTypes';

export type MonitoringToIspDecision = 'pending' | 'approved' | 'rejected';
export type MonitoringToIspImpact = 'low' | 'high';
export type MonitoringToIspTargetLayer = 'L2' | 'L1';

export interface MonitoringToIspProposal {
  proposalId: string;
  sourceRecords: string[];
  ruleVersion: string;
  decision: MonitoringToIspDecision;
  reviewer?: string;
  decidedAt?: string;
  reason?: string;
  impact: MonitoringToIspImpact;
  targetLayer: MonitoringToIspTargetLayer;
  diff: Record<string, unknown>;
  requestedBy?: string;
}

export interface MonitoringToIspApplyRequest {
  proposalId: string;
  approvedBy: string[];
  rollbackSnapshotRef: string;
}

export interface PolicyCheckResult {
  ok: boolean;
  reason?: string;
}

const POLICY_VERSION = 'monitoring-to-isp/v0.1';
const DEFAULT_REQUESTER = 'monitoring-engine';

export function assertRecommendationOnlyWriteForbidden(): never {
  throw new Error(
    '[MonitoringToIspPolicy] recommendation-only boundary violation: direct write is forbidden.',
  );
}

export function inferImpactFromRecommendationLevel(
  level: IspRecommendationLevel,
): MonitoringToIspImpact {
  if (level === 'revise-goal' || level === 'urgent-review') {
    return 'high';
  }
  return 'low';
}

export function toMonitoringToIspProposal(
  decision: IspRecommendationDecision,
  options?: {
    sourceRecords?: string[];
    ruleVersion?: string;
    targetLayer?: MonitoringToIspTargetLayer;
    diff?: Record<string, unknown>;
    requestedBy?: string;
  },
): MonitoringToIspProposal {
  return {
    proposalId: decision.id,
    sourceRecords: options?.sourceRecords ?? [decision.goalId],
    ruleVersion: options?.ruleVersion ?? POLICY_VERSION,
    decision: mapDecisionStatus(decision.status),
    reviewer: decision.decidedBy,
    decidedAt: decision.decidedAt,
    reason: decision.note,
    impact: inferImpactFromRecommendationLevel(decision.snapshot.level),
    targetLayer: options?.targetLayer ?? 'L2',
    diff: options?.diff ?? {},
    requestedBy: options?.requestedBy ?? DEFAULT_REQUESTER,
  };
}

export function canApplyProposal(
  proposal: MonitoringToIspProposal,
  approvers: string[],
): PolicyCheckResult {
  if (proposal.decision !== 'approved') {
    return {
      ok: false,
      reason: 'proposal must be approved before apply.',
    };
  }

  const normalizedApprovers = normalizeApprovers(approvers);
  const requiredApprovals = requiredApprovalCount(proposal);

  if (normalizedApprovers.length < requiredApprovals) {
    return {
      ok: false,
      reason: `requires ${requiredApprovals} approval(s), got ${normalizedApprovers.length}.`,
    };
  }

  if (
    requiredApprovals === 1 &&
    proposal.requestedBy &&
    normalizedApprovers.length === 1 &&
    normalizedApprovers[0] === proposal.requestedBy
  ) {
    return {
      ok: false,
      reason: 'requester cannot be the sole approver.',
    };
  }

  return { ok: true };
}

export function validateApplyRequest(
  proposal: MonitoringToIspProposal,
  request: MonitoringToIspApplyRequest,
): PolicyCheckResult {
  if (request.proposalId !== proposal.proposalId) {
    return {
      ok: false,
      reason: 'apply request proposalId does not match proposal.',
    };
  }

  if (!request.rollbackSnapshotRef.trim()) {
    return {
      ok: false,
      reason: 'rollbackSnapshotRef is required.',
    };
  }

  return canApplyProposal(proposal, request.approvedBy);
}

export function buildRollbackSnapshotRef(
  proposalId: string,
  now: Date = new Date(),
): string {
  return `rollback:${proposalId}:${now.toISOString()}`;
}

function requiredApprovalCount(proposal: MonitoringToIspProposal): 1 | 2 {
  if (proposal.impact === 'high') return 2;
  if (proposal.targetLayer === 'L1') return 1;
  return 1;
}

function normalizeApprovers(approvers: string[]): string[] {
  return [...new Set(approvers.map((id) => id.trim()).filter(Boolean))];
}

function mapDecisionStatus(
  status: IspRecommendationDecision['status'],
): MonitoringToIspDecision {
  if (status === 'accepted') return 'approved';
  if (status === 'dismissed') return 'rejected';
  return 'pending';
}

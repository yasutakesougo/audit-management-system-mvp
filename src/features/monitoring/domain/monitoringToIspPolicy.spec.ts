import { describe, expect, it } from 'vitest';

import type { MonitoringToIspProposal } from './monitoringToIspPolicy';
import {
  assertRecommendationOnlyWriteForbidden,
  canApplyProposal,
  validateApplyRequest,
} from './monitoringToIspPolicy';

function makeProposal(overrides?: Partial<MonitoringToIspProposal>): MonitoringToIspProposal {
  return {
    proposalId: 'proposal-1',
    sourceRecords: ['record-1'],
    ruleVersion: 'monitoring-to-isp/v0.1',
    decision: 'approved',
    reviewer: 'service-manager@example.com',
    decidedAt: '2026-04-01T00:00:00.000Z',
    reason: 'test',
    impact: 'low',
    targetLayer: 'L2',
    diff: { supportPolicy: 'update' },
    requestedBy: 'monitoring-engine',
    ...overrides,
  };
}

describe('monitoringToIspPolicy', () => {
  it('approval なしでは apply できない', () => {
    const proposal = makeProposal();
    const result = validateApplyRequest(proposal, {
      proposalId: proposal.proposalId,
      approvedBy: [],
      rollbackSnapshotRef: 'rollback:proposal-1:2026-04-01T00:00:00.000Z',
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('requires');
  });

  it('high-impact は dual sign-off が必須', () => {
    const proposal = makeProposal({ impact: 'high' });
    const result = canApplyProposal(proposal, ['service-manager@example.com']);

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('requires 2 approval');
  });

  it('requester は sole approver になれない', () => {
    const proposal = makeProposal({
      requestedBy: 'case-owner@example.com',
    });
    const result = canApplyProposal(proposal, ['case-owner@example.com']);

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('sole approver');
  });

  it('apply 時に rollbackSnapshotRef が必須', () => {
    const proposal = makeProposal();
    const result = validateApplyRequest(proposal, {
      proposalId: proposal.proposalId,
      approvedBy: ['service-manager@example.com'],
      rollbackSnapshotRef: '   ',
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('rollbackSnapshotRef');
  });

  it('direct write forbidden assertion は例外を投げる', () => {
    expect(() => assertRecommendationOnlyWriteForbidden()).toThrowError(
      /recommendation-only boundary violation/,
    );
  });
});

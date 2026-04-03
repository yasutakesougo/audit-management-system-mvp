import { describe, it, expect } from 'vitest';
import { resolveInternalNamesDetailed, areEssentialFieldsResolved } from '@/lib/sp/helpers';
import { ISP_DECISION_CANDIDATES, ISP_DECISION_ESSENTIALS } from '../ispThreeLayerFields';

describe('ISP_DECISION_CANDIDATES drift', () => {
  const allCandidates = ISP_DECISION_CANDIDATES as unknown as Record<string, string[]>;
  const essentials = ISP_DECISION_ESSENTIALS as unknown as string[];

  it('標準名 (UserId, Status 等) がそのまま解決される（drift なし）', () => {
    const available = new Set(['Id', 'Title', 'UserId', 'GoalId', 'Status', 'DecidedBy', 'DecidedAt']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, allCandidates);

    expect(resolved.userId).toBe('UserId');
    expect(resolved.status).toBe('Status');
    expect(fieldStatus.userId.isDrifted).toBe(false);
  });

  it('UserCode や DecisionStatus などの別名でも解決される（drift あり）', () => {
    const available = new Set(['Id', 'Title', 'UserCode', 'DecisionStatus', 'cr013_snapshotJson']);
    const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, allCandidates);

    expect(resolved.userId).toBe('UserCode');
    expect(resolved.status).toBe('DecisionStatus');
    expect(resolved.snapshotJson).toBe('cr013_snapshotJson');

    expect(fieldStatus.userId.isDrifted).toBe(true);
    expect(fieldStatus.status.isDrifted).toBe(true);
  });

  it('必須フィールド (goalId) が欠落している場合に検出できる', () => {
    const available = new Set(['Id', 'Title', 'UserId', 'Status']); // GoalId is missing
    const { resolved } = resolveInternalNamesDetailed(available, allCandidates);
    
    const isHealthy = areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials);
    expect(isHealthy).toBe(false);
  });

  it('任意フィールド (note) が欠落していても必須が揃っていれば Healthy', () => {
    const available = new Set(['Id', 'Title', 'UserId', 'GoalId', 'Status']); // Note is missing but not essential
    const { resolved } = resolveInternalNamesDetailed(available, allCandidates);

    const isHealthy = areEssentialFieldsResolved(resolved as Record<string, string | undefined>, essentials);
    expect(isHealthy).toBe(true);
    expect(resolved.note).toBeUndefined();
  });
});

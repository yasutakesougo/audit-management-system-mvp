import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  remediationAuditBus,
  emitPlanCreated,
  emitExecutionCompleted,
  type RemediationAuditEntry,
} from '../audit';
import type { RemediationPlan, RemediationResult } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePlan(overrides: Partial<RemediationPlan> = {}): RemediationPlan {
  return {
    id: 'plan-audit-1',
    target: { type: 'index', listKey: 'TestList', fieldName: 'FieldX' },
    action: 'delete_index',
    risk: 'safe',
    autoExecutable: true,
    requiresApproval: false,
    reason: 'ゾンビ列の削除',
    source: 'nightly_patrol',
    createdAt: '2026-04-18T00:00:00.000Z',
    ...overrides,
  };
}

function makeResult(overrides: Partial<RemediationResult> = {}): RemediationResult {
  return {
    planId: 'plan-audit-1',
    status: 'success',
    executedAt: '2026-04-18T00:01:00.000Z',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('remediation/audit: RemediationAuditBus', () => {
  beforeEach(() => {
    remediationAuditBus._reset();
  });

  it('should deliver events to subscribers', () => {
    const received: RemediationAuditEntry[] = [];
    remediationAuditBus.subscribe(e => received.push(e));

    const plan = makePlan();
    emitPlanCreated(plan);

    expect(received).toHaveLength(1);
    expect(received[0].phase).toBe('planned');
    expect(received[0].planId).toBe('plan-audit-1');
  });

  it('should unsubscribe correctly', () => {
    const received: RemediationAuditEntry[] = [];
    const unsub = remediationAuditBus.subscribe(e => received.push(e));

    emitPlanCreated(makePlan());
    expect(received).toHaveLength(1);

    unsub();
    emitPlanCreated(makePlan({ id: 'plan-2' }));
    expect(received).toHaveLength(1); // no new events
  });

  it('should survive listener errors (fail-open)', () => {
    const good: RemediationAuditEntry[] = [];
    remediationAuditBus.subscribe(() => { throw new Error('boom'); });
    remediationAuditBus.subscribe(e => good.push(e));

    emitPlanCreated(makePlan());

    expect(good).toHaveLength(1); // second listener still received
  });
});

describe('remediation/audit: emitPlanCreated', () => {
  beforeEach(() => {
    remediationAuditBus._reset();
  });

  it('should emit a planned-phase entry with all plan fields', () => {
    const entries: RemediationAuditEntry[] = [];
    remediationAuditBus.subscribe(e => entries.push(e));

    const plan = makePlan({
      risk: 'moderate',
      autoExecutable: false,
      requiresApproval: true,
      source: 'realtime',
    });
    emitPlanCreated(plan);

    const entry = entries[0];
    expect(entry.phase).toBe('planned');
    expect(entry.listKey).toBe('TestList');
    expect(entry.fieldName).toBe('FieldX');
    expect(entry.action).toBe('delete_index');
    expect(entry.risk).toBe('moderate');
    expect(entry.autoExecutable).toBe(false);
    expect(entry.requiresApproval).toBe(true);
    expect(entry.reason).toBe('ゾンビ列の削除');
    expect(entry.source).toBe('realtime');
    expect(entry.timestamp).toBe('2026-04-18T00:00:00.000Z');
    // execution fields are not set for planned phase
    expect(entry.executionStatus).toBeUndefined();
    expect(entry.executionError).toBeUndefined();
  });
});

describe('remediation/audit: emitExecutionCompleted', () => {
  beforeEach(() => {
    remediationAuditBus._reset();
  });

  it('should emit an executed-phase entry with success status', () => {
    const entries: RemediationAuditEntry[] = [];
    remediationAuditBus.subscribe(e => entries.push(e));

    emitExecutionCompleted(makePlan(), makeResult());

    const entry = entries[0];
    expect(entry.phase).toBe('executed');
    expect(entry.executionStatus).toBe('success');
    expect(entry.executionError).toBeUndefined();
    expect(entry.timestamp).toBe('2026-04-18T00:01:00.000Z');
  });

  it('should emit an executed-phase entry with error details', () => {
    const entries: RemediationAuditEntry[] = [];
    remediationAuditBus.subscribe(e => entries.push(e));

    const errorResult = makeResult({
      status: 'error',
      error: { code: 'SP_API_ERROR', message: 'timeout', retryable: true },
    });
    emitExecutionCompleted(makePlan(), errorResult);

    const entry = entries[0];
    expect(entry.phase).toBe('executed');
    expect(entry.executionStatus).toBe('error');
    expect(entry.executionError).toEqual({
      code: 'SP_API_ERROR',
      message: 'timeout',
      retryable: true,
    });
  });

  it('should emit an executed-phase entry with skipped status', () => {
    const entries: RemediationAuditEntry[] = [];
    remediationAuditBus.subscribe(e => entries.push(e));

    const skippedResult = makeResult({
      status: 'skipped',
      error: { code: 'APPROVAL_REQUIRED', message: 'needs approval', retryable: false },
    });
    emitExecutionCompleted(makePlan(), skippedResult);

    const entry = entries[0];
    expect(entry.executionStatus).toBe('skipped');
    expect(entry.executionError?.code).toBe('APPROVAL_REQUIRED');
  });

  it('should preserve plan context in execution audit (risk, autoExecutable separation)', () => {
    const entries: RemediationAuditEntry[] = [];
    remediationAuditBus.subscribe(e => entries.push(e));

    // safe risk but NOT autoExecutable — policy override
    const plan = makePlan({ risk: 'safe', autoExecutable: false, requiresApproval: true });
    emitExecutionCompleted(plan, makeResult());

    const entry = entries[0];
    expect(entry.risk).toBe('safe');
    expect(entry.autoExecutable).toBe(false);
    expect(entry.requiresApproval).toBe(true);
  });
});

describe('remediation/audit: executor integration', () => {
  beforeEach(() => {
    remediationAuditBus._reset();
  });

  it('executor should emit audit event on successful execution', async () => {
    const { executeRemediation } = await import('../executor');
    const entries: RemediationAuditEntry[] = [];
    remediationAuditBus.subscribe(e => entries.push(e));

    const spClient = { updateField: vi.fn().mockResolvedValue('success') };
    const plan = makePlan();

    await executeRemediation(spClient as never, plan, { now: () => '2026-04-18T12:00:00.000Z' });

    expect(entries).toHaveLength(1);
    expect(entries[0].phase).toBe('executed');
    expect(entries[0].executionStatus).toBe('success');
    expect(entries[0].planId).toBe(plan.id);
  });

  it('executor should emit audit event on error', async () => {
    const { executeRemediation } = await import('../executor');
    const entries: RemediationAuditEntry[] = [];
    remediationAuditBus.subscribe(e => entries.push(e));

    const spClient = { updateField: vi.fn().mockRejectedValue(new Error('SP down')) };
    const plan = makePlan();

    await executeRemediation(spClient as never, plan, { now: () => '2026-04-18T12:00:00.000Z' });

    expect(entries).toHaveLength(1);
    expect(entries[0].phase).toBe('executed');
    expect(entries[0].executionStatus).toBe('error');
    expect(entries[0].executionError?.message).toBe('SP down');
  });

  it('executor should emit audit event on skipped (unsupported action)', async () => {
    const { executeRemediation } = await import('../executor');
    const entries: RemediationAuditEntry[] = [];
    remediationAuditBus.subscribe(e => entries.push(e));

    const spClient = { updateField: vi.fn() };
    const plan = makePlan({ action: 'rename_field' });

    await executeRemediation(spClient as never, plan, { now: () => '2026-04-18T12:00:00.000Z' });

    expect(entries).toHaveLength(1);
    expect(entries[0].executionStatus).toBe('skipped');
    expect(entries[0].executionError?.code).toBe('UNSUPPORTED_ACTION');
  });
});

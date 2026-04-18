import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeRemediation, executeRemediationBatch, type RemediationSpClient } from '../executor';
import type { RemediationPlan } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const FIXED_NOW = '2026-04-18T12:00:00.000Z';
const nowFn = () => FIXED_NOW;

function makePlan(overrides: Partial<RemediationPlan> = {}): RemediationPlan {
  return {
    id: 'plan-1',
    target: { type: 'index', listKey: 'TestList', fieldName: 'FieldA' },
    action: 'delete_index',
    risk: 'safe',
    autoExecutable: true,
    requiresApproval: false,
    reason: 'Test reason',
    source: 'realtime',
    createdAt: '2026-04-18T00:00:00.000Z',
    ...overrides,
  };
}

function makeMockClient(): RemediationSpClient {
  return { updateField: vi.fn().mockResolvedValue('success') };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('remediation/executor: executeRemediation', () => {
  let spClient: RemediationSpClient;

  beforeEach(() => {
    spClient = makeMockClient();
  });

  // ── Unsupported action ───────────────────────────────────────────────────

  it('should skip unsupported actions safely', async () => {
    const plan = makePlan({ action: 'rename_field' as RemediationPlan['action'] });

    const result = await executeRemediation(spClient, plan, { now: nowFn });

    expect(result.status).toBe('skipped');
    expect(result.error?.code).toBe('UNSUPPORTED_ACTION');
    expect(result.error?.message).toContain('rename_field');
    expect(spClient.updateField).not.toHaveBeenCalled();
  });

  // ── Approval gate ────────────────────────────────────────────────────────

  it('should skip plans that require approval when not approved', async () => {
    const plan = makePlan({ requiresApproval: true });

    const result = await executeRemediation(spClient, plan, { now: nowFn });

    expect(result.status).toBe('skipped');
    expect(result.error?.code).toBe('APPROVAL_REQUIRED');
    expect(spClient.updateField).not.toHaveBeenCalled();
  });

  it('should execute plans that require approval when explicitly approved', async () => {
    const plan = makePlan({ requiresApproval: true });

    const result = await executeRemediation(spClient, plan, { now: nowFn, approved: true });

    expect(result.status).toBe('success');
    expect(spClient.updateField).toHaveBeenCalled();
  });

  // ── delete_index ─────────────────────────────────────────────────────────

  it('should call updateField with Indexed=false for delete_index', async () => {
    const plan = makePlan({ action: 'delete_index' });

    const result = await executeRemediation(spClient, plan, { now: nowFn });

    expect(spClient.updateField).toHaveBeenCalledWith('TestList', 'FieldA', { Indexed: false });
    expect(result.status).toBe('success');
    expect(result.executedAt).toBe(FIXED_NOW);
  });

  // ── create_index ─────────────────────────────────────────────────────────

  it('should call updateField with Indexed=true for create_index', async () => {
    const plan = makePlan({ action: 'create_index' });

    const result = await executeRemediation(spClient, plan, { now: nowFn });

    expect(spClient.updateField).toHaveBeenCalledWith('TestList', 'FieldA', { Indexed: true });
    expect(result.status).toBe('success');
  });

  // ── Error handling ───────────────────────────────────────────────────────

  it('should return structured error when SP API returns "error"', async () => {
    vi.mocked(spClient.updateField).mockResolvedValue('error');
    const plan = makePlan();

    const result = await executeRemediation(spClient, plan, { now: nowFn });

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('SP_API_ERROR');
    expect(result.error?.retryable).toBe(true);
  });

  it('should return structured error when SP API throws', async () => {
    vi.mocked(spClient.updateField).mockRejectedValue(new Error('Network timeout'));
    const plan = makePlan();

    const result = await executeRemediation(spClient, plan, { now: nowFn });

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('UNEXPECTED_ERROR');
    expect(result.error?.message).toBe('Network timeout');
    expect(result.error?.retryable).toBe(true);
  });

  it('should return error for invalid target (missing listKey)', async () => {
    const plan = makePlan({ target: { type: 'index' } });

    const result = await executeRemediation(spClient, plan, { now: nowFn });

    expect(result.status).toBe('error');
    expect(result.error?.code).toBe('INVALID_TARGET');
    expect(result.error?.retryable).toBe(false);
  });
});

describe('remediation/executor: executeRemediationBatch', () => {
  it('should execute all plans and return results in order', async () => {
    const spClient = makeMockClient();
    const plans = [
      makePlan({ id: 'p1', action: 'delete_index' }),
      makePlan({ id: 'p2', action: 'create_index' }),
    ];

    const results = await executeRemediationBatch(spClient, plans, { now: nowFn });

    expect(results).toHaveLength(2);
    expect(results[0].planId).toBe('p1');
    expect(results[0].status).toBe('success');
    expect(results[1].planId).toBe('p2');
    expect(results[1].status).toBe('success');
  });

  it('should continue execution after individual plan failure', async () => {
    const spClient = makeMockClient();
    vi.mocked(spClient.updateField)
      .mockResolvedValueOnce('error')
      .mockResolvedValueOnce('success');

    const plans = [
      makePlan({ id: 'fail', action: 'delete_index' }),
      makePlan({ id: 'pass', action: 'create_index' }),
    ];

    const results = await executeRemediationBatch(spClient, plans, { now: nowFn });

    expect(results[0].status).toBe('error');
    expect(results[1].status).toBe('success');
  });
});

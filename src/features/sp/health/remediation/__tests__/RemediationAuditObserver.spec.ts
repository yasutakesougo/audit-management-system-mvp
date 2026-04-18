import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RemediationAuditObserver } from '../RemediationAuditObserver';
import { remediationAuditBus, emitPlanCreated, emitExecutionCompleted } from '../audit';
import { InMemoryRemediationAuditRepository } from '../RemediationAuditRepository';
import type { RemediationPlan, RemediationResult } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePlan(overrides: Partial<RemediationPlan> = {}): RemediationPlan {
  return {
    id: 'plan-obs-1',
    target: { type: 'index', listKey: 'TestList', fieldName: 'FieldX' },
    action: 'delete_index',
    risk: 'safe',
    autoExecutable: true,
    requiresApproval: false,
    reason: 'Observer test',
    source: 'nightly_patrol',
    createdAt: '2026-04-18T00:00:00.000Z',
    ...overrides,
  };
}

function makeResult(overrides: Partial<RemediationResult> = {}): RemediationResult {
  return {
    planId: 'plan-obs-1',
    status: 'success',
    executedAt: '2026-04-18T00:01:00.000Z',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('RemediationAuditObserver', () => {
  let repo: InMemoryRemediationAuditRepository;
  let observer: RemediationAuditObserver;

  beforeEach(() => {
    remediationAuditBus._reset();
    repo = new InMemoryRemediationAuditRepository();
    observer = new RemediationAuditObserver(repo);
  });

  it('should persist planned entries when started', async () => {
    observer.start();

    emitPlanCreated(makePlan());

    // logEntry is async but fire-and-forget — wait a tick
    await vi.waitFor(async () => {
      expect(repo._size()).toBe(1);
    });

    const entries = await repo.getEntries();
    expect(entries[0].phase).toBe('planned');
    expect(entries[0].planId).toBe('plan-obs-1');
  });

  it('should persist executed entries when started', async () => {
    observer.start();

    emitExecutionCompleted(makePlan(), makeResult());

    await vi.waitFor(async () => {
      expect(repo._size()).toBe(1);
    });

    const entries = await repo.getEntries();
    expect(entries[0].phase).toBe('executed');
    expect(entries[0].executionStatus).toBe('success');
  });

  it('should persist full plan→execute lifecycle', async () => {
    observer.start();

    const plan = makePlan();
    emitPlanCreated(plan);
    emitExecutionCompleted(plan, makeResult());

    await vi.waitFor(async () => {
      expect(repo._size()).toBe(2);
    });

    const entries = await repo.getEntries();
    // newest first
    expect(entries[0].phase).toBe('executed');
    expect(entries[1].phase).toBe('planned');
  });

  it('should not persist entries before start', () => {
    emitPlanCreated(makePlan());
    expect(repo._size()).toBe(0);
  });

  it('should not persist entries after stop', async () => {
    observer.start();

    emitPlanCreated(makePlan({ id: 'before-stop' }));
    await vi.waitFor(async () => {
      expect(repo._size()).toBe(1);
    });

    observer.stop();

    emitPlanCreated(makePlan({ id: 'after-stop' }));
    // Give time for any stray async
    await new Promise(r => setTimeout(r, 10));
    expect(repo._size()).toBe(1);
  });

  it('should be idempotent on multiple start calls', async () => {
    observer.start();
    observer.start(); // second call should be no-op

    emitPlanCreated(makePlan());

    await vi.waitFor(async () => {
      expect(repo._size()).toBe(1);
    });

    // Only 1 entry, not 2 (which would happen with double subscription)
    expect(repo._size()).toBe(1);
  });

  it('should survive repository errors (fail-open)', async () => {
    const failingRepo: InMemoryRemediationAuditRepository = {
      ...repo,
      logEntry: vi.fn().mockRejectedValue(new Error('DB down')),
      getEntries: repo.getEntries.bind(repo),
      _size: repo._size.bind(repo),
      _clear: repo._clear.bind(repo),
    } as unknown as InMemoryRemediationAuditRepository;

    const failObserver = new RemediationAuditObserver(failingRepo);
    failObserver.start();

    // Should not throw
    emitPlanCreated(makePlan());

    // Wait for the rejected promise to settle
    await new Promise(r => setTimeout(r, 10));

    expect(failingRepo.logEntry).toHaveBeenCalledTimes(1);

    failObserver.stop();
  });
});

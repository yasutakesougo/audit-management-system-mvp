import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRemediationAuditRepository } from '../RemediationAuditRepository';
import type { RemediationAuditEntry } from '../audit';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<RemediationAuditEntry> = {}): RemediationAuditEntry {
  return {
    planId: 'plan-1',
    phase: 'planned',
    listKey: 'TestList',
    fieldName: 'FieldA',
    action: 'delete_index',
    risk: 'safe',
    autoExecutable: true,
    requiresApproval: false,
    reason: 'test reason',
    source: 'realtime',
    timestamp: '2026-04-18T00:00:00.000Z',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('InMemoryRemediationAuditRepository', () => {
  let repo: InMemoryRemediationAuditRepository;

  beforeEach(() => {
    repo = new InMemoryRemediationAuditRepository();
  });

  it('should store and retrieve entries', async () => {
    await repo.logEntry(makeEntry());
    const entries = await repo.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].planId).toBe('plan-1');
  });

  it('should return entries in reverse chronological order', async () => {
    await repo.logEntry(makeEntry({ planId: 'first', timestamp: '2026-04-18T00:00:00.000Z' }));
    await repo.logEntry(makeEntry({ planId: 'second', timestamp: '2026-04-18T01:00:00.000Z' }));

    const entries = await repo.getEntries();
    expect(entries[0].planId).toBe('second');
    expect(entries[1].planId).toBe('first');
  });

  // ── Filters ──────────────────────────────────────────────────────────────

  it('should filter by planId', async () => {
    await repo.logEntry(makeEntry({ planId: 'p1' }));
    await repo.logEntry(makeEntry({ planId: 'p2' }));

    const entries = await repo.getEntries({ planId: 'p1' });
    expect(entries).toHaveLength(1);
    expect(entries[0].planId).toBe('p1');
  });

  it('should filter by phase', async () => {
    await repo.logEntry(makeEntry({ phase: 'planned' }));
    await repo.logEntry(makeEntry({ phase: 'executed', planId: 'p2' }));

    const planned = await repo.getEntries({ phase: 'planned' });
    expect(planned).toHaveLength(1);

    const executed = await repo.getEntries({ phase: 'executed' });
    expect(executed).toHaveLength(1);
    expect(executed[0].planId).toBe('p2');
  });

  it('should filter by listKey', async () => {
    await repo.logEntry(makeEntry({ listKey: 'ListA' }));
    await repo.logEntry(makeEntry({ listKey: 'ListB', planId: 'p2' }));

    const entries = await repo.getEntries({ listKey: 'ListA' });
    expect(entries).toHaveLength(1);
  });

  it('should filter by since', async () => {
    await repo.logEntry(makeEntry({ timestamp: '2026-04-17T00:00:00.000Z', planId: 'old' }));
    await repo.logEntry(makeEntry({ timestamp: '2026-04-18T12:00:00.000Z', planId: 'new' }));

    const entries = await repo.getEntries({ since: '2026-04-18T00:00:00.000Z' });
    expect(entries).toHaveLength(1);
    expect(entries[0].planId).toBe('new');
  });

  it('should apply limit', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.logEntry(makeEntry({ planId: `p${i}` }));
    }

    const entries = await repo.getEntries({ limit: 3 });
    expect(entries).toHaveLength(3);
  });

  it('should combine multiple filters', async () => {
    await repo.logEntry(makeEntry({ planId: 'p1', phase: 'planned', listKey: 'A' }));
    await repo.logEntry(makeEntry({ planId: 'p2', phase: 'executed', listKey: 'A' }));
    await repo.logEntry(makeEntry({ planId: 'p3', phase: 'executed', listKey: 'B' }));

    const entries = await repo.getEntries({ phase: 'executed', listKey: 'A' });
    expect(entries).toHaveLength(1);
    expect(entries[0].planId).toBe('p2');
  });

  // ── Capacity ─────────────────────────────────────────────────────────────

  it('should evict oldest entries when exceeding maxEntries', async () => {
    const smallRepo = new InMemoryRemediationAuditRepository({ maxEntries: 3 });

    for (let i = 0; i < 5; i++) {
      await smallRepo.logEntry(makeEntry({ planId: `p${i}` }));
    }

    expect(smallRepo._size()).toBe(3);

    const entries = await smallRepo.getEntries();
    // oldest (p0, p1) should be evicted, newest (p4, p3, p2) remain
    const planIds = entries.map(e => e.planId);
    expect(planIds).toEqual(['p4', 'p3', 'p2']);
  });

  // ── Reset ────────────────────────────────────────────────────────────────

  it('should clear all entries', async () => {
    await repo.logEntry(makeEntry());
    expect(repo._size()).toBe(1);

    repo._clear();
    expect(repo._size()).toBe(0);

    const entries = await repo.getEntries();
    expect(entries).toEqual([]);
  });
});

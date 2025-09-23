import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import AuditPanel from '../../src/features/audit/AuditPanel';

// Mocks
vi.mock('../../src/features/audit/useAuditSync', () => ({ useAuditSync: () => ({ syncAll: vi.fn() }) }));

// We'll override per test the return shape of syncAllBatch
const syncAllBatchMock = vi.fn();
vi.mock('../../src/features/audit/useAuditSyncBatch', () => ({ useAuditSyncBatch: () => ({ syncAllBatch: syncAllBatchMock }) }));

// Mutable audit log data store for tests
let _logs: any[] = [];
vi.mock('../../src/lib/audit', async () => {
  return {
    readAudit: () => _logs,
    getAuditLogs: () => _logs,
    clearAudit: () => { _logs = []; },
    retainAuditWhere: (pred: (l: any, idx: number) => boolean) => { _logs = _logs.filter(pred); },
  } as any;
});

// Hash util computeEntryHash is invoked indirectly; provide fast stable mock
vi.mock('../../src/lib/hashUtil', () => ({
  canonicalJSONStringify: (o: any) => JSON.stringify(o),
  computeEntryHash: async () => 'hash',
}));

// Silence debug logger side-effects
vi.mock('../../src/lib/debugLogger', () => ({ auditLog: { debug: () => {}, error: () => {}, enabled: false } }));

function seedLogs(n: number) {
  const now = Date.now();
  _logs = Array.from({ length: n }).map((_, i) => ({
    ts: new Date(now - i * 1000).toISOString(),
    actor: 'tester',
    action: 'CREATE',
    entity: 'Record',
    entity_id: String(100 + i),
    channel: 'UI',
    after: { idx: i }
  }));
}

async function expectMetrics({ newItems, duplicates, failed }: { newItems: number; duplicates: number; failed: number; }) {
  // Wait until the metrics container appears (state set after async handler resolves)
  const container = await screen.findByTestId('audit-metrics');
  await waitFor(() => {
    expect(container.getAttribute('data-new')).toBe(String(newItems));
    expect(container.getAttribute('data-duplicates')).toBe(String(duplicates));
    expect(container.getAttribute('data-failed')).toBe(String(failed));
  });
}

describe('AuditPanel metrics attributes', () => {
  beforeEach(() => {
    _logs = [];
    syncAllBatchMock.mockReset();
  });
  afterEach(() => {
    // Ensure DOM from previous test is unmounted to avoid duplicate buttons / panels
    cleanup();
    _logs = [];
  });

  test('no logs -> no metrics container', () => {
    render(<AuditPanel />);
    expect(screen.queryByTestId('audit-metrics')).toBeNull();
  });

  test('mixed results (new + duplicates + failed)', async () => {
    seedLogs(6); // total
    syncAllBatchMock.mockResolvedValueOnce({ total: 6, success: 5, duplicates: 2, failed: 1, durationMs: 10 });
    render(<AuditPanel />);
    fireEvent.click(screen.getByRole('button', { name: /一括同期/ }));
    await expectMetrics({ newItems: 3, duplicates: 2, failed: 1 });
  });

  test('all duplicates (no new failures)', async () => {
    seedLogs(3);
    syncAllBatchMock.mockResolvedValueOnce({ total: 3, success: 3, duplicates: 3, failed: 0 });
    render(<AuditPanel />);
    fireEvent.click(screen.getByRole('button', { name: /一括同期/ }));
    await expectMetrics({ newItems: 0, duplicates: 3, failed: 0 });
  });

  test('all failed', async () => {
    seedLogs(4);
    // success=0 failed=4
    syncAllBatchMock.mockResolvedValueOnce({ total: 4, success: 0, failed: 4 });
    render(<AuditPanel />);
    fireEvent.click(screen.getByRole('button', { name: /一括同期/ }));
    const container = await screen.findByTestId('audit-metrics');
    await waitFor(() => {
      expect(container.getAttribute('data-new')).toBe('0');
      expect(container.getAttribute('data-duplicates')).toBe('0');
      expect(container.getAttribute('data-failed')).toBe('4');
    });
  });
});

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuditPanel from '../../src/features/audit/AuditPanel';

type AuditLogEntry = {
  ts: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  channel: string;
  after: Record<string, unknown>;
};

vi.mock('../../src/features/audit/exportCsv', () => ({
  buildAuditCsv: vi.fn(() => 'csv'),
  downloadCsv: vi.fn(),
}));

const syncAllMock = vi.fn();
const syncAllBatchMock = vi.fn();

vi.mock('../../src/features/audit/useAuditSync', () => ({
  useAuditSync: () => ({ syncAll: syncAllMock }),
}));

vi.mock('../../src/features/audit/useAuditSyncBatch', () => ({
  useAuditSyncBatch: () => ({ syncAllBatch: syncAllBatchMock }),
}));

vi.mock('../../src/lib/env', () => ({
  isDevMode: () => true,
}));

let logs: AuditLogEntry[] = [];

vi.mock('../../src/lib/audit', () => ({
  readAudit: () => logs,
  getAuditLogs: () => logs,
  clearAudit: () => {
    logs = [];
  },
  retainAuditWhere: (predicate: (entry: AuditLogEntry) => boolean) => {
    logs = logs.filter(predicate);
  },
}));

vi.mock('../../src/lib/hashUtil', () => ({
  canonicalJSONStringify: (value: unknown) => JSON.stringify(value),
  computeEntryHash: async () => 'hash',
}));

vi.mock('../../src/lib/debugLogger', () => ({
  auditLog: { debug: () => undefined, error: () => undefined, enabled: false },
}));

describe('AuditPanel dev mode interactions', () => {
  beforeEach(() => {
    logs = [
      {
        ts: new Date().toISOString(),
        actor: 'tester',
        action: 'CREATE',
        entity: 'Record',
        entity_id: '1',
        channel: 'UI',
        after: {},
      },
    ];
    window.__AUDIT_BATCH_METRICS__ = {
      total: 0,
      success: 0,
      duplicates: 0,
      newItems: 0,
      failed: 0,
      retryMax: 0,
      categories: {},
      durationMs: 0,
      timestamp: new Date().toISOString(),
      parserFallbackCount: 1,
    };
    syncAllMock.mockReset();
    syncAllBatchMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.__AUDIT_BATCH_METRICS__ = undefined;
  });

  it('exposes dev metrics overlay and debug attributes', async () => {
    syncAllBatchMock.mockResolvedValueOnce({
      total: 2,
      success: 2,
      duplicates: 1,
      failed: 1,
      durationMs: 5,
      categories: { conflict: 1 },
    });

    render(<AuditPanel />);
    fireEvent.click(screen.getByRole('button', { name: /一括同期/ }));

    const metrics = await screen.findByTestId('audit-metrics');
    await waitFor(() => {
      expect(metrics.getAttribute('data-debug-failed')).toBe('1');
      expect(metrics.getAttribute('data-debug-duplicates')).toBe('1');
    });

    const infoButton = screen.getByRole('button', { name: 'batch metrics' });
    fireEvent.click(infoButton);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Batch Metrics');

    const overlay = document.querySelector('[role="button"][tabindex="0"]') as HTMLElement;
    expect(overlay).toBeTruthy();

    fireEvent.keyDown(overlay, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    fireEvent.click(infoButton);
    await screen.findByRole('dialog');
    const reopenedOverlay = document.querySelector('[role="button"][tabindex="0"]') as HTMLElement;
    expect(reopenedOverlay).toBeTruthy();
    fireEvent.click(reopenedOverlay);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});

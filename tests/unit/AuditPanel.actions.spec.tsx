import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { renderWithRouter } from './_helpers/renderWithRouter';
import AuditPanel from '../../src/features/audit/AuditPanel';

// Mocks for hooks
const syncAllMock = vi.fn();
const syncAllBatchMock = vi.fn();

vi.mock('../../src/features/audit/useAuditSync', () => ({ useAuditSync: () => ({ syncAll: syncAllMock }) }));
vi.mock('../../src/features/audit/useAuditSyncBatch', () => ({ useAuditSyncBatch: () => ({ syncAllBatch: syncAllBatchMock }) }));

// Mutable audit store
let _logs: any[] = [];
vi.mock('../../src/lib/audit', () => ({
  readAudit: () => _logs,
  getAuditLogs: () => _logs,
  clearAudit: () => { _logs = []; },
  retainAuditWhere: (pred: (l: any) => boolean) => { _logs = _logs.filter(pred); }
}));

// hash util minimal mock
vi.mock('../../src/lib/hashUtil', () => ({
  canonicalJSONStringify: (o: any) => JSON.stringify(o),
  computeEntryHash: async () => 'hash'
}));

// logger silent
vi.mock('../../src/lib/debugLogger', () => ({ auditLog: { debug: () => {}, error: () => {}, enabled: false } }));

// Silence jsdom navigation warning (anchor clicks) that surfaces from implicit a.click()
beforeAll(() => {
  if (!(HTMLAnchorElement.prototype as any)._origClick) {
    (HTMLAnchorElement.prototype as any)._origClick = HTMLAnchorElement.prototype.click;
  }
  HTMLAnchorElement.prototype.click = function() { /* no-op in tests */ } as any;
});

afterAll(() => {
  if ((HTMLAnchorElement.prototype as any)._origClick) {
    HTMLAnchorElement.prototype.click = (HTMLAnchorElement.prototype as any)._origClick;
  }
});

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

describe('AuditPanel action handlers', () => {
  let createUrlSpy: any;
  beforeEach(() => {
    _logs = [];
    syncAllMock.mockReset();
    syncAllBatchMock.mockReset();
    // jsdom may not implement createObjectURL; provide stub if absent
    if (!(URL as any).createObjectURL) {
      (URL as any).createObjectURL = () => 'blob://stub';
    }
    if (!(URL as any).revokeObjectURL) {
      (URL as any).revokeObjectURL = () => {};
    }
    createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://x');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('CSV export enabled when logs exist and triggers createObjectURL', () => {
    seedLogs(2);
    renderWithRouter(<AuditPanel />);
    const exportBtn = screen.getByRole('button', { name: 'CSVエクスポート' });
  // Using attribute check instead of jest-dom matcher to avoid type issues in TS context
  expect(exportBtn.getAttribute('disabled')).toBeNull();
  expect(exportBtn.getAttribute('disabled')).toBeNull();
    fireEvent.click(exportBtn);
    expect(createUrlSpy).toHaveBeenCalledTimes(1);
  });

  it('syncAll success path sets message', async () => {
    seedLogs(1);
    syncAllMock.mockResolvedValueOnce({ total: 1, success: 1 });
    renderWithRouter(<AuditPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'SPOへ同期' }));
    await waitFor(() => {
      expect(screen.getByText(/同期完了/)).toBeTruthy();
    });
  });

  it('syncAll failure path shows error', async () => {
    seedLogs(1);
    syncAllMock.mockRejectedValueOnce(new Error('Boom'));
    renderWithRouter(<AuditPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'SPOへ同期' }));
    await waitFor(() => {
      expect(screen.getByText(/同期失敗/)).toBeTruthy();
    });
  });

  it('batch sync failure then resend failed path', async () => {
    seedLogs(3);
    // First batch: some failures
    syncAllBatchMock.mockResolvedValueOnce({ total: 3, success: 2, duplicates: 1, failed: 1, durationMs: 5 });
    // Resend batch call: all succeed
    syncAllBatchMock.mockResolvedValueOnce({ total: 1, success: 1, duplicates: 0, failed: 0, durationMs: 3 });
    renderWithRouter(<AuditPanel />);
    fireEvent.click(screen.getByRole('button', { name: /一括同期/ }));
    await waitFor(() => {
      expect(screen.getByText(/一括同期完了/)).toBeTruthy();
    });
    // Failed resend button should appear
    const resendBtn = screen.getByRole('button', { name: '失敗のみ再送' });
    fireEvent.click(resendBtn);
    await waitFor(() => {
      expect(screen.getByText(/失敗再送/)).toBeTruthy();
    });
    expect(syncAllBatchMock).toHaveBeenCalledTimes(2);
  });

  it('batch sync error catch path sets failure message', async () => {
    seedLogs(2);
    syncAllBatchMock.mockRejectedValueOnce(new Error('NetFail'));
    renderWithRouter(<AuditPanel />);
    fireEvent.click(screen.getByRole('button', { name: /一括同期/ }));
    await waitFor(() => {
      expect(screen.getByText(/一括同期失敗/)).toBeTruthy();
    });
  });

  it('action filter reduces visible rows', () => {
    const now = Date.now();
    _logs = [
      { ts: new Date(now).toISOString(), actor: 'tester', action: 'CREATE', entity: 'R', entity_id: '1', channel: 'UI', after: {} },
      { ts: new Date(now-1000).toISOString(), actor: 'tester', action: 'UPDATE', entity: 'R', entity_id: '2', channel: 'UI', after: {} }
    ];
    renderWithRouter(<AuditPanel />);
    // Initially ALL -> both actions present
    expect(screen.getAllByText(/CREATE|UPDATE/).length).toBeGreaterThan(1);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'CREATE' } });
    // Only CREATE rows now
    const rowsText = screen.getAllByRole('row').map(r => r.textContent || '').join('\n');
    expect(rowsText).toContain('CREATE');
    expect(rowsText).not.toContain('UPDATE');
  });
});

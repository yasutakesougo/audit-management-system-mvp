import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock hooks
vi.mock('../../src/features/audit/useAuditSync', () => ({ useAuditSync: () => ({ syncAll: vi.fn() }) }));
vi.mock('../../src/features/audit/useAuditSyncBatch', () => ({ useAuditSyncBatch: () => ({ syncAllBatch: vi.fn() }) }));
vi.mock('../../src/lib/audit', () => ({
  readAudit: () => [],
  getAuditLogs: () => [],
  clearAudit: () => {},
  retainAuditWhere: () => {}
}));
vi.mock('../../src/lib/hashUtil', () => ({
  canonicalJSONStringify: (o: Record<string, unknown>) => JSON.stringify(o),
  computeEntryHash: async () => 'h'
}));
vi.mock('../../src/lib/debugLogger', () => ({ auditLog: { debug: () => {}, error: () => {}, enabled: false } }));

describe('AuditPanel metrics overlay (DEV button)', () => {
  beforeEach(() => {
    // Ensure DEV flag so the info button renders
    vi.resetModules();
  const meta = import.meta as ImportMeta & { env: { MODE?: string; DEV?: boolean } };
  meta.env.MODE = 'development';
  meta.env.DEV = true;
  });

  it('opens and closes overlay', async () => {
    const { default: AuditPanel } = await import('../../src/features/audit/AuditPanel');
    render(<AuditPanel />);
    const btn = screen.getByRole('button', { name: 'batch metrics' });
    fireEvent.click(btn);
    // Overlay contains heading
    expect(screen.getByText('Batch Metrics')).toBeTruthy();
    const closeBtn = screen.getByRole('button', { name: '閉じる' });
    fireEvent.click(closeBtn);
    // After closing, heading disappears
    expect(screen.queryByText('Batch Metrics')).toBeNull();
  });
});

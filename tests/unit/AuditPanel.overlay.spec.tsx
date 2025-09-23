import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuditPanel from '../../src/features/audit/AuditPanel';

// Mock hooks
vi.mock('../../src/features/audit/useAuditSync', () => ({ useAuditSync: () => ({ syncAll: vi.fn() }) }));
vi.mock('../../src/features/audit/useAuditSyncBatch', () => ({ useAuditSyncBatch: () => ({ syncAllBatch: vi.fn() }) }));
vi.mock('../../src/lib/audit', () => ({
  readAudit: () => [],
  getAuditLogs: () => [],
  clearAudit: () => {},
  retainAuditWhere: () => {}
}));
vi.mock('../../src/lib/hashUtil', () => ({ canonicalJSONStringify: (o: any) => JSON.stringify(o), computeEntryHash: async () => 'h' }));
vi.mock('../../src/lib/debugLogger', () => ({ auditLog: { debug: () => {}, error: () => {}, enabled: false } }));

describe('AuditPanel metrics overlay (DEV button)', () => {
  beforeEach(() => {
    // Ensure DEV flag so the info button renders
    (import.meta as any).env.DEV = true;
  });

  it('opens and closes overlay', () => {
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

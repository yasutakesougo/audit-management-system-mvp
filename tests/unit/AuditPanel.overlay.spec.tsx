import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithRouter } from './_helpers/renderWithRouter';

// Mock isDevMode to return true so the DEV-only button renders
vi.mock('../../src/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/env')>();
  return {
    ...actual,
    isDevMode: () => true,
  };
});

vi.mock('../../src/features/audit/useAuditSync', () => ({ useAuditSync: () => ({ syncAll: vi.fn() }) }));
vi.mock('../../src/features/audit/useAuditSyncBatch', () => ({ useAuditSyncBatch: () => ({ syncAllBatch: vi.fn() }) }));
vi.mock('../../src/lib/audit', () => ({
  readAudit: () => [],
  getAuditLogs: () => [],
  clearAudit: () => {},
  retainAuditWhere: () => {}
}));
vi.mock('../../src/lib/hashUtil', () => ({ canonicalJSONStringify: (o: unknown) => JSON.stringify(o), computeEntryHash: async () => 'h' }));
vi.mock('../../src/lib/debugLogger', () => ({ auditLog: { debug: () => {}, error: () => {}, enabled: false } }));

import AuditPanel from '../../src/features/audit/AuditPanel';

describe('AuditPanel metrics overlay (DEV button)', () => {
  it('opens and closes overlay', () => {
    renderWithRouter(<AuditPanel />);
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

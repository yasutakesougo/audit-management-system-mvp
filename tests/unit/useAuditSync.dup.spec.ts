import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock react hooks so that useCallback is a pass-through and no real React renderer context is needed
vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  return {
    ...actual,
    useCallback: (fn: any) => fn
  };
});

// Mock spClient.useSP before importing the hook module
vi.mock('../../src/lib/spClient', () => ({
  useSP: () => ({
    addListItemByTitle: vi.fn().mockRejectedValue(new Error('conflict duplicate key'))
  })
}));

// Mock audit library functions
vi.mock('../../src/lib/audit', () => ({
  getAuditLogs: () => ([{ ts: new Date().toISOString(), actor: 'u', action: 'ACT', entity: 'E', channel: 'UI', after: { a: 1 } }]),
  clearAudit: () => {}
}));

import { useAuditSync } from '../../src/features/audit/useAuditSync';

describe('useAuditSync duplicate conflict path', () => {
  beforeEach(() => { /* mocks already set */ });
  afterEach(() => { vi.restoreAllMocks(); });

  it('treats conflict error as success', async () => {
    const { syncAll } = useAuditSync();
    const res = await syncAll();
    expect(res.total).toBe(1);
    expect(res.success).toBe(1);
  });
});

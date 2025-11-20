import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AuditLog = {
  ts: number | string;
  actor: string;
  action: string;
  entity: string;
  entity_id?: string;
  channel: string;
  after?: unknown;
};

type AddListItemFn = (listTitle: string, body: unknown) => Promise<unknown>;

const mocks = vi.hoisted(() => {
  return {
    addListItemMock: vi.fn<AddListItemFn>(),
    getAuditLogsMock: vi.fn<() => AuditLog[]>(),
    clearAuditMock: vi.fn(),
    canonicalJSONStringifyMock: vi.fn<(input: unknown) => string>(),
    computeEntryHashMock: vi.fn<(input: Record<string, unknown>) => Promise<string>>(),
  };
});

// Mock react hooks so that useCallback is a pass-through and no real React renderer context is needed.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useCallback: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  };
});

// Mock SharePoint client hook.
vi.mock('../../src/lib/spClient', () => ({
  useSP: () => ({
    addListItemByTitle: mocks.addListItemMock,
  }),
}));

// Mock audit helpers.
vi.mock('../../src/lib/audit', () => ({
  getAuditLogs: mocks.getAuditLogsMock,
  clearAudit: mocks.clearAuditMock,
}));

// Mock hash utilities used by the hook.
vi.mock('../../src/lib/hashUtil', async () => {
  const actual = await vi.importActual<typeof import('../../src/lib/hashUtil')>('../../src/lib/hashUtil');
  return {
    ...actual,
    canonicalJSONStringify: mocks.canonicalJSONStringifyMock,
    computeEntryHash: mocks.computeEntryHashMock,
  };
});

import { useAuditSync } from '../../src/features/audit/useAuditSync';

describe('useAuditSync', () => {
  beforeEach(() => {
    mocks.addListItemMock.mockReset();
    mocks.getAuditLogsMock.mockReset();
    mocks.clearAuditMock.mockReset();
    mocks.canonicalJSONStringifyMock.mockReset();
    mocks.computeEntryHashMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero totals when there are no audit logs', async () => {
  mocks.getAuditLogsMock.mockReturnValue([]);
    const { syncAll } = useAuditSync();

    const result = await syncAll();

    expect(result).toEqual({ total: 0, success: 0, failed: 0 });
  expect(mocks.addListItemMock).not.toHaveBeenCalled();
  expect(mocks.clearAuditMock).not.toHaveBeenCalled();
  });

  it('syncs all logs and clears audit state when SharePoint writes succeed', async () => {
    const ts = new Date('2025-01-02T03:04:05.000Z').valueOf();
  mocks.getAuditLogsMock.mockReturnValue([
      { ts, actor: 'alice', action: 'CREATE', entity: 'Schedule', entity_id: '42', channel: 'UI', after: { foo: 'bar' } },
      { ts: ts + 1000, actor: 'bob', action: 'DELETE', entity: 'Task', channel: 'API' },
    ]);
  mocks.canonicalJSONStringifyMock.mockReturnValueOnce('{"foo":"bar"}');
  mocks.computeEntryHashMock.mockResolvedValueOnce('hash-1');
  mocks.computeEntryHashMock.mockResolvedValueOnce('hash-2');
  mocks.addListItemMock.mockResolvedValue(undefined);

    const { syncAll } = useAuditSync();
    const result = await syncAll();

    expect(result).toEqual({ total: 2, success: 2, failed: 0 });
    expect(mocks.addListItemMock).toHaveBeenCalledTimes(2);
    expect(mocks.addListItemMock).toHaveBeenCalledWith(
      'Audit_Events',
      expect.objectContaining({ Title: 'CREATE Schedule #42', entry_hash: 'hash-1', after_json: '{"foo":"bar"}' })
    );
    expect(mocks.addListItemMock).toHaveBeenCalledWith(
      'Audit_Events',
      expect.objectContaining({ Title: 'DELETE Task', entry_hash: 'hash-2', after_json: null })
    );
    expect(mocks.canonicalJSONStringifyMock).toHaveBeenCalledTimes(1);
    expect(mocks.clearAuditMock).toHaveBeenCalledTimes(1);
  });

  it('treats duplicate errors as success and still clears audit logs', async () => {
  mocks.getAuditLogsMock.mockReturnValue([
      { ts: Date.now(), actor: 'u', action: 'UPDATE', entity: 'Entity', channel: 'UI' },
    ]);
  mocks.computeEntryHashMock.mockResolvedValue('hash-dupe');
  mocks.addListItemMock.mockRejectedValue(new Error('conflict duplicate key'));

    const { syncAll } = useAuditSync();
    const result = await syncAll();

    expect(result).toEqual({ total: 1, success: 1, failed: 0 });
  expect(mocks.addListItemMock).toHaveBeenCalledTimes(1);
  expect(mocks.clearAuditMock).toHaveBeenCalledTimes(1);
  });

  it('logs unexpected errors and keeps audit data for retry', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.getAuditLogsMock.mockReturnValue([
      { ts: Date.now(), actor: 'u', action: 'UPDATE', entity: 'Entity', channel: 'UI' },
    ]);
  mocks.computeEntryHashMock.mockResolvedValue('hash-error');
  mocks.addListItemMock.mockRejectedValue(new Error('network down'));

    const { syncAll } = useAuditSync();
    const result = await syncAll();

    expect(result).toEqual({ total: 1, success: 0, failed: 1 });
  expect(mocks.clearAuditMock).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Audit sync failed for item',
      expect.any(Object),
      expect.any(Error)
    );

    consoleSpy.mockRestore();
  });
});

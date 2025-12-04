import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuditLogEntry = {
  ts: string;
  action: string;
  entity: string;
  entity_id?: number;
  actor: string;
  channel: string;
  after?: unknown;
};

type AppConfig = {
  isDev?: boolean;
  VITE_AUDIT_BATCH_SIZE?: string;
  VITE_AUDIT_RETRY_MAX?: string;
  VITE_AUDIT_RETRY_BASE?: string;
};

const mockGetAuditLogs = vi.fn<() => AuditLogEntry[]>();
const mockClearAudit = vi.fn();
const mockRetainAuditWhere = vi.fn();
const mockPostBatch = vi.fn();
const mockBuildBatchInsertBody = vi.fn();
const mockParseBatchInsertResponse = vi.fn();
const mockAuditLog = {
  debug: vi.fn(),
  error: vi.fn(),
  enabled: true,
};
let currentConfig: AppConfig = {};
const mockGetAppConfig = vi.fn(() => currentConfig);

vi.mock('@/lib/audit', () => ({
  getAuditLogs: () => mockGetAuditLogs(),
  clearAudit: () => mockClearAudit(),
  retainAuditWhere: (predicate: (log: AuditLogEntry, index: number) => boolean) =>
    mockRetainAuditWhere(predicate),
}));

vi.mock('@/lib/spClient', () => ({
  useSP: () => ({
    postBatch: (...args: unknown[]) => mockPostBatch(...args),
  }),
}));

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    getAppConfig: () => mockGetAppConfig(),
  };
});

vi.mock('@/features/audit/batchUtil', () => ({
  buildBatchInsertBody: (...args: unknown[]) => mockBuildBatchInsertBody(...args),
  parseBatchInsertResponse: (...args: unknown[]) => mockParseBatchInsertResponse(...args),
}));

vi.mock('@/lib/debugLogger', () => ({
  auditLog: mockAuditLog,
}));

const importHook = async () => {
  vi.resetModules();
  const mod = await import('@/features/audit/useAuditSyncBatch');
  return mod.useAuditSyncBatch;
};

beforeEach(() => {
  currentConfig = { isDev: false };
  mockGetAuditLogs.mockReset();
  mockClearAudit.mockReset();
  mockRetainAuditWhere.mockReset();
  mockPostBatch.mockReset();
  mockBuildBatchInsertBody.mockReset();
  mockParseBatchInsertResponse.mockReset();
  mockAuditLog.debug.mockReset();
  mockAuditLog.error.mockReset();
  mockAuditLog.enabled = true;
  mockGetAppConfig.mockClear();
  delete (window as { __AUDIT_BATCH_METRICS__?: unknown }).__AUDIT_BATCH_METRICS__;
  delete (window as { __E2E_INVOKE_SYNC_BATCH__?: unknown }).__E2E_INVOKE_SYNC_BATCH__;
});

describe('useAuditSyncBatch syncAllBatch', () => {
  it('returns zero result when no audit logs exist', async () => {
    mockGetAuditLogs.mockReturnValue([]);

    const useAuditSyncBatch = await importHook();
    const { result } = renderHook(() => useAuditSyncBatch());

    let response: unknown;
    await act(async () => {
      response = await result.current.syncAllBatch();
    });

    expect(response).toEqual({ total: 0, success: 0 });
    expect(mockPostBatch).not.toHaveBeenCalled();
    expect(mockClearAudit).not.toHaveBeenCalled();
  });

  it('flushes all logs and exposes metrics with retry on transient failures', async () => {
    const logs: AuditLogEntry[] = [
      { ts: '2024-01-01T00:00:00Z', action: 'Create', entity: 'Record', entity_id: 1, actor: 'A', channel: 'web' },
      { ts: '2024-01-02T00:00:00Z', action: 'Update', entity: 'Record', entity_id: 2, actor: 'B', channel: 'web' },
      { ts: '2024-01-03T00:00:00Z', action: 'Delete', entity: 'Record', entity_id: 3, actor: 'C', channel: 'api' },
    ];
    mockGetAuditLogs.mockReturnValue(logs);

    currentConfig = {
      isDev: true,
      VITE_AUDIT_BATCH_SIZE: '2',
      VITE_AUDIT_RETRY_MAX: '3',
      VITE_AUDIT_RETRY_BASE: '50',
    };

    mockBuildBatchInsertBody.mockImplementation(() => ({ body: 'body', boundary: 'boundary' }));

    const responses = [
      { success: 1, failed: 1, duplicates: 0, errors: [{ contentId: 2, status: 429, statusText: 'Too Many' }], categories: { transient: 1 } },
      { success: 2, failed: 0, duplicates: 1, errors: [], categories: {} },
      { success: 1, failed: 0, duplicates: 0, errors: [], categories: {} },
    ];
    mockParseBatchInsertResponse.mockImplementation(() => responses.shift());

    const stubResponse = { clone: () => stubResponse } as unknown as Response;
    mockPostBatch.mockResolvedValue(stubResponse);

    const useAuditSyncBatch = await importHook();
    const { result } = renderHook(() => useAuditSyncBatch());

    let syncResult: unknown;
    await act(async () => {
      syncResult = await result.current.syncAllBatch();
    });

    expect(mockPostBatch).toHaveBeenCalledTimes(3);
    expect(mockParseBatchInsertResponse).toHaveBeenCalledTimes(3);
    expect(syncResult).toMatchObject({ total: logs.length, success: logs.length, duplicates: 1 });
    expect(mockClearAudit).toHaveBeenCalled();
    expect(mockRetainAuditWhere).not.toHaveBeenCalled();
    expect(mockAuditLog.debug).toHaveBeenCalled();
    expect((window as { __AUDIT_BATCH_METRICS__?: unknown }).__AUDIT_BATCH_METRICS__).toMatchObject({
      total: logs.length,
      success: logs.length,
      duplicates: 1,
    });
  });

  it('retains failed entries when SharePoint returns hard errors', async () => {
    const logs: AuditLogEntry[] = [
      { ts: '2024-01-01T00:00:00Z', action: 'Create', entity: 'Record', entity_id: 1, actor: 'A', channel: 'web' },
      { ts: '2024-01-02T00:00:00Z', action: 'Update', entity: 'Record', entity_id: 2, actor: 'B', channel: 'web' },
    ];
    mockGetAuditLogs.mockReturnValue(logs);

    currentConfig = {
      isDev: false,
      VITE_AUDIT_BATCH_SIZE: '5',
      VITE_AUDIT_RETRY_MAX: '2',
      VITE_AUDIT_RETRY_BASE: '10',
    };

    mockBuildBatchInsertBody.mockReturnValue({ body: 'body', boundary: 'boundary' });

    mockParseBatchInsertResponse.mockReturnValue({
      success: 0,
      failed: 2,
      duplicates: 0,
      errors: [
        { contentId: 1, status: 500, statusText: 'Internal' },
        { contentId: 2, status: 400, statusText: 'BadRequest' },
      ],
      categories: { server: 1 },
    });

    const stubResponse = { clone: () => stubResponse } as unknown as Response;
    mockPostBatch.mockResolvedValue(stubResponse);

    const useAuditSyncBatch = await importHook();
    const { result } = renderHook(() => useAuditSyncBatch());

    let syncResult: unknown;
    await act(async () => {
      syncResult = await result.current.syncAllBatch();
    });

    expect(syncResult).toMatchObject({ total: logs.length, success: 0, failed: 2, errors: expect.any(Array) });
    expect(mockClearAudit).not.toHaveBeenCalled();
    expect(mockRetainAuditWhere).toHaveBeenCalled();
    const predicate = mockRetainAuditWhere.mock.calls[0][0];
    expect(predicate(logs[0], 0)).toBe(true);
    expect(predicate(logs[1], 1)).toBe(true);
    expect(mockAuditLog.error).not.toHaveBeenCalled();
  });
});

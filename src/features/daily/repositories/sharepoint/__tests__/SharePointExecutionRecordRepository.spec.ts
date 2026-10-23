import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AMBIGUOUS_EXECUTION_RECORD,
  AmbiguousExecutionRecordError,
  ExecutionTargetMismatchError,
  SharePointExecutionRecordRepository,
} from '../SharePointExecutionRecordRepository';
import { EXECUTION_RECORD_FIELDS } from '../constants';
import type { ExecutionRecord } from '../../../domain/executionRecordTypes';

function pagedValue<T extends { Id?: unknown }>(url: string, items: T[]): { value: T[] } {
  const decoded = decodeURIComponent(url);
  const match = decoded.match(/ID gt (\d+)/);
  if (!match) return { value: items };
  const lastId = Number(match[1]);
  return {
    value: items.filter((item) => typeof item.Id === 'number' && item.Id > lastId),
  };
}

describe('SharePointExecutionRecordRepository', () => {
  const mockSpFetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ value: [] }),
  });
  
  const mockGetFields = vi.fn().mockResolvedValue(new Set([
    'Title',
    'RecordDate',
    'UserId',
    EXECUTION_RECORD_FIELDS.rowKey,
    EXECUTION_RECORD_FIELDS.status,
    EXECUTION_RECORD_FIELDS.parentId,
    EXECUTION_RECORD_FIELDS.userId,
    EXECUTION_RECORD_FIELDS.rowNo,
    EXECUTION_RECORD_FIELDS.recordedAt,
    EXECUTION_RECORD_FIELDS.bipsJSON,
    // Note: StaffName is intentionally missing in this mock schema to test filtering
  ]));

  const repo = new SharePointExecutionRecordRepository({
    spFetch: mockSpFetch,
    getListFieldInternalNames: mockGetFields,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks for list resolution probes
    mockSpFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ value: [] }), // Default empty response
    });
  });

  it('filters out non-existent fields from the payload', async () => {
    const record: ExecutionRecord = {
      id: 'R001',
      date: '2024-01-01',
      userId: 'U001',
      scheduleItemId: 'S001',
      status: 'completed',
      memo: 'Test memo',
      recordedAt: '2024-01-01T10:00:00Z',
      recordedBy: 'Staff A',
      triggeredBipIds: [],
    };

    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('SupportRecord_Daily') && url.includes('/items?$filter=')) {
        return { ok: true, json: async () => pagedValue(url, [{ Id: 123, Title: '2024-01-01-U001' }]) };
      }
      if (url.includes('DailyRecordRows') && url.includes('/items?$filter=')) {
        return { ok: true, json: async () => ({ value: [] }) };
      }
      if (url.includes('DailyRecordRows') && url.includes('/items') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ d: { Id: 456 } }) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });

    await repo.upsertRecord(record);

    // Verify fields in the POST request to child list
    const createCall = mockSpFetch.mock.calls.find(call => 
      call[0].includes('DailyRecordRows') && call[1]?.method === 'POST'
    );
    
    expect(createCall).toBeDefined();
    const body = JSON.parse(createCall![1]!.body as string);
    
    expect(body.Title).toBe('R001');
    expect(body[EXECUTION_RECORD_FIELDS.status]).toBe('completed');
    // StaffName should be filtered out as it was not in the mockGetFields set
    expect(body[EXECUTION_RECORD_FIELDS.staffName]).toBeUndefined();
  });

  it('falls back to full payload if getListFieldInternalNames is not provided', async () => {
    const repoNoFields = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
    });

    const record: ExecutionRecord = {
      id: 'R001',
      date: '2024-01-01',
      userId: 'U001',
      scheduleItemId: 'S001',
      status: 'completed',
      memo: 'Test memo',
      recordedAt: '2024-01-01T10:00:00Z',
      recordedBy: 'Staff A',
      triggeredBipIds: [],
    };

    mockSpFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('/fields')) {
        return { ok: true, json: async () => ({ value: [{ InternalName: 'Title' }] }) };
      }
      if (url.includes('SupportRecord_Daily') && url.includes('/items?$filter=')) {
        return { ok: true, json: async () => pagedValue(url, [{ Id: 123, Title: '2024-01-01-U001' }]) };
      }
      if (url.includes('DailyRecordRows') && url.includes('/items') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ Id: 456 }) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });

    await repoNoFields.upsertRecord(record);

    const createCall = mockSpFetch.mock.calls.find(call => 
      call[0].includes('DailyRecordRows') && call[1]?.method === 'POST'
    );
    
    expect(createCall).toBeDefined();
    const body = JSON.parse(createCall![1]!.body as string);
    // Should NOT include StaffName as it was not in the physical schema probe (strict filtering)
    expect(body[EXECUTION_RECORD_FIELDS.staffName]).toBeUndefined();
  });

  it('parses flat parent ID (no .d wrapper)', async () => {
    const record: ExecutionRecord = {
      id: 'R999',
      date: '2024-01-01',
      userId: 'U999',
      scheduleItemId: 'S999',
      status: 'completed',
      memo: 'Resilience test',
      recordedAt: '2024-01-01T11:00:00Z',
      recordedBy: 'Staff B',
      triggeredBipIds: [],
    };

    // Reset mocks for sequence-independent URL-based implementation mock
    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('items') && init?.method === 'POST') {
        if (url.includes('SupportRecord_Daily') || url.includes('DailyRecords')) {
          return {
            ok: true,
            json: async () => ({ Id: 777 }) // flat response JSON
          };
        }
        return {
          ok: true,
          json: async () => ({ Id: 888 })
        };
      }
      // Default empty responses for probe paths
      return {
        ok: true,
        json: async () => ({ value: [] })
      };
    });

    await repo.upsertRecord(record);

    // Verify child creation payload has parentId set to the parsed flat ID (777)
    const childCreateCall = mockSpFetch.mock.calls.find(call =>
      call[0].includes('DailyRecordRows') && call[1]?.method === 'POST'
    );
    expect(childCreateCall).toBeDefined();
    const childBody = JSON.parse(childCreateCall![1]!.body as string);
    expect(childBody[EXECUTION_RECORD_FIELDS.parentId]).toBe(777);
  });

  it('throws when child row create fails', async () => {
    const record: ExecutionRecord = {
      id: 'R500',
      date: '2024-01-01',
      userId: 'U500',
      scheduleItemId: 'S500',
      status: 'completed',
      memo: 'create fail test',
      recordedAt: '2024-01-01T11:00:00Z',
      recordedBy: 'Staff C',
      triggeredBipIds: [],
    };

    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      // Ensure parent lookup returns existing parent
      if (url.includes('SupportRecord_Daily') && url.includes('/items?$filter=')) {
        return { ok: true, json: async () => pagedValue(url, [{ Id: 123, Title: '2024-01-01-U500' }]) };
      }
      // Existing child row lookup returns empty so repo goes to create
      if (url.includes('DailyRecordRows') && url.includes('/items?$filter=')) {
        return { ok: true, json: async () => ({ value: [] }) };
      }
      // Child create fails
      if (url.includes('DailyRecordRows') && url.includes('/items') && init?.method === 'POST') {
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: { message: 'failed' } }),
        };
      }
      // Default for resolver probes
      return { ok: true, json: async () => ({ value: [] }) };
    });

    await expect(repo.upsertRecord(record)).rejects.toThrow('row create failed');
  });

  it('syncs merged memo to the local store after SharePoint upsert', async () => {
    const mockGetFieldsWithMemo = vi.fn().mockResolvedValue(new Set([
      'Title',
      'RecordDate',
      EXECUTION_RECORD_FIELDS.rowKey,
      EXECUTION_RECORD_FIELDS.status,
      EXECUTION_RECORD_FIELDS.parentId,
      EXECUTION_RECORD_FIELDS.userId,
      EXECUTION_RECORD_FIELDS.rowNo,
      EXECUTION_RECORD_FIELDS.memo,
      EXECUTION_RECORD_FIELDS.recordedAt,
      EXECUTION_RECORD_FIELDS.bipsJSON,
      'Payload',
    ]));
    const store = {
      getRecords: vi.fn(() => []),
      upsertRecord: vi.fn(),
      deleteRecord: vi.fn(),
    };
    const repoWithStore = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
      getListFieldInternalNames: mockGetFieldsWithMemo,
      store,
    });
    const record: ExecutionRecord = {
      id: '2024-01-01-U001-S001',
      date: '2024-01-01',
      userId: 'U001',
      scheduleItemId: 'S001',
      status: 'completed',
      memo: 'new memo',
      recordedAt: '2024-01-01T10:00:00Z',
      recordedBy: 'Staff A',
      triggeredBipIds: [],
    };

    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('SupportRecord_Daily') && url.includes('/items?$filter=')) {
        return { ok: true, json: async () => pagedValue(url, [{ Id: 123, Title: '2024-01-01-U001' }]) };
      }
      if (url.includes('DailyRecordRows') && url.includes('/items?$filter=')) {
        return {
          ok: true,
          json: async () => pagedValue(url, [
            {
              Id: 456,
              Title: '2024-01-01-U001-S001',
              User_x0020_ID: 'U001',
              RowNo: 'S001',
              Status: 'completed',
              Memo: 'existing memo',
              Recorded_x0020_At: '2024-01-01T09:00:00Z',
            },
          ]),
        };
      }
      if (url.includes('DailyRecordRows') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ Id: 456 }) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });

    await repoWithStore.upsertRecord(record);

    expect(store.upsertRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        memo: expect.stringContaining('existing memo'),
      }),
      undefined,
    );
    expect(store.upsertRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        memo: expect.stringContaining('new memo'),
      }),
      undefined,
    );
  });

  it('overwrites an existing memo when upsert requests overwrite mode', async () => {
    const mockGetFieldsWithMemo = vi.fn().mockResolvedValue(new Set([
      'Title',
      'RecordDate',
      EXECUTION_RECORD_FIELDS.rowKey,
      EXECUTION_RECORD_FIELDS.status,
      EXECUTION_RECORD_FIELDS.parentId,
      EXECUTION_RECORD_FIELDS.userId,
      EXECUTION_RECORD_FIELDS.rowNo,
      EXECUTION_RECORD_FIELDS.memo,
      EXECUTION_RECORD_FIELDS.recordedAt,
      EXECUTION_RECORD_FIELDS.bipsJSON,
      'Payload',
    ]));
    const store = {
      getRecords: vi.fn(() => []),
      upsertRecord: vi.fn(),
      deleteRecord: vi.fn(),
    };
    const repoWithStore = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
      getListFieldInternalNames: mockGetFieldsWithMemo,
      store,
    });
    const record: ExecutionRecord = {
      id: '2024-01-01-U001-S001',
      date: '2024-01-01',
      userId: 'U001',
      scheduleItemId: 'S001',
      status: 'completed',
      memo: 'new memo',
      recordedAt: '2024-01-01T10:00:00Z',
      recordedBy: 'Staff A',
      triggeredBipIds: [],
    };

    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('SupportRecord_Daily') && url.includes('/items?$filter=')) {
        return { ok: true, json: async () => pagedValue(url, [{ Id: 123, Title: '2024-01-01-U001' }]) };
      }
      if (url.includes('DailyRecordRows') && url.includes('/items?$filter=')) {
        return {
          ok: true,
          json: async () => pagedValue(url, [
            {
              Id: 456,
              Title: '2024-01-01-U001-S001',
              User_x0020_ID: 'U001',
              RowNo: 'S001',
              Status: 'completed',
              Memo: 'existing memo',
              Recorded_x0020_At: '2024-01-01T09:00:00Z',
            },
          ]),
        };
      }
      if (url.includes('DailyRecordRows') && url.includes('/items(456)') && init?.method === 'POST') {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });

    await repoWithStore.upsertRecord(record, { memoMode: 'overwrite' });

    const updateCall = mockSpFetch.mock.calls.find((call) =>
      String(call[0]).includes('DailyRecordRows') && String(call[0]).includes('/items(456)'),
    );
    expect(updateCall).toBeDefined();
    const body = JSON.parse(updateCall![1]!.body as string);
    expect(body[EXECUTION_RECORD_FIELDS.memo]).toBe('new memo');
    expect(body.Payload).toBe('new memo');
    expect(store.upsertRecord).toHaveBeenCalledWith(
      expect.objectContaining({ memo: 'new memo' }),
      { memoMode: 'overwrite' },
    );
  });

  it('updates an existing row without repeating the row-key lookup', async () => {
    const repoWithFreshFields = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
      getListFieldInternalNames: mockGetFields,
    });
    const record: ExecutionRecord = {
      id: '2024-01-01-U001-S001',
      date: '2024-01-01',
      userId: 'U001',
      scheduleItemId: 'S001',
      status: 'completed',
      memo: 'updated memo',
      recordedAt: '2024-01-01T10:00:00Z',
      recordedBy: 'Staff A',
      triggeredBipIds: [],
    };

    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('SupportRecord_Daily') && url.includes('/items?$filter=')) {
        return { ok: true, json: async () => pagedValue(url, [{ Id: 123, Title: '2024-01-01-U001' }]) };
      }
      if (url.includes('DailyRecordRows') && url.includes('/items?$filter=')) {
        return {
          ok: true,
          json: async () => pagedValue(url, [
            {
              Id: 456,
              Title: '2024-01-01-U001-S001',
              User_x0020_ID: 'U001',
              RowNo: 'S001',
              Status: 'completed',
              Memo: 'existing memo',
              Recorded_x0020_At: '2024-01-01T09:00:00Z',
            },
          ]),
        };
      }
      if (url.includes('DailyRecordRows') && url.includes('/items(456)') && init?.method === 'POST') {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });

    await repoWithFreshFields.upsertRecord(record);

    const rowLookupCalls = mockSpFetch.mock.calls.filter((call) =>
      String(call[0]).includes('DailyRecordRows') && String(call[0]).includes('/items?$filter='),
    );
    const updateCall = mockSpFetch.mock.calls.find((call) =>
      String(call[0]).includes('DailyRecordRows') && String(call[0]).includes('/items(456)'),
    );

    const decodedRowLookups = rowLookupCalls.map((call) => decodeURIComponent(String(call[0])));
    expect(decodedRowLookups.filter((url) => url.includes('ID gt 0'))).toHaveLength(1);
    expect(decodedRowLookups.filter((url) => url.includes('ID gt 456'))).toHaveLength(1);
    expect(updateCall).toBeDefined();
  });

  it('caches parent record lookup by daily key across row saves', async () => {
    const repoWithFreshFields = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
      getListFieldInternalNames: mockGetFields,
    });
    const makeRecord = (scheduleItemId: string): ExecutionRecord => ({
      id: `2024-01-01-U001-${scheduleItemId}`,
      date: '2024-01-01',
      userId: 'U001',
      scheduleItemId,
      status: 'completed',
      memo: 'memo',
      recordedAt: '2024-01-01T10:00:00Z',
      recordedBy: 'Staff A',
      triggeredBipIds: [],
    });

    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes('SupportRecord_Daily') && url.includes('/items?$filter=')) {
        return { ok: true, json: async () => pagedValue(url, [{ Id: 123, Title: '2024-01-01-U001' }]) };
      }
      if (url.includes('DailyRecordRows') && url.includes('/items?$filter=')) {
        return { ok: true, json: async () => ({ value: [] }) };
      }
      if (url.includes('DailyRecordRows') && url.includes('/items') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ Id: 456 }) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });

    await repoWithFreshFields.upsertRecord(makeRecord('S001'));
    await repoWithFreshFields.upsertRecord(makeRecord('S002'));

    const parentLookupCalls = mockSpFetch.mock.calls.filter((call) =>
      String(call[0]).includes('SupportRecord_Daily') &&
      String(call[0]).includes('/items?$filter=') &&
      decodeURIComponent(String(call[0])).includes('Title eq'),
    );

    expect(parentLookupCalls).toHaveLength(1);
  });

  it('retrieves records through the indexed parent date range and separate numeric ParentID queries', async () => {
    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string) => {
      const decoded = decodeURIComponent(url);
      if (decoded.includes('SupportRecord_Daily') && decoded.includes('$filter=')) {
        return {
          ok: true,
          json: async () => pagedValue(url, [
            { Id: 123, Title: '2026-05-25-17', RecordDate: '2026-05-25T00:00:00Z' },
            { Id: 456, Title: '2026-05-25-U017', RecordDate: '2026-05-25T00:00:00Z' },
          ]),
        };
      }
      if (decoded.includes('DailyRecordRows') && decoded.includes('Parent_x0020_ID eq 123')) {
        return {
          ok: true,
          json: async () => pagedValue(url, [{ Id: 1, Title: '2026-05-25-17-0', User_x0020_ID: '17', RowNo: '0', Status: 'completed' }]),
        };
      }
      if (decoded.includes('DailyRecordRows') && decoded.includes('Parent_x0020_ID eq 456')) {
        return {
          ok: true,
          json: async () => pagedValue(url, [{ Id: 2, Title: '2026-05-25-U017-0', User_x0020_ID: 'U017', RowNo: '0', Status: 'completed' }]),
        };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });

    const repoWithFreshFields = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
      getListFieldInternalNames: mockGetFields,
    });

    const records = await repoWithFreshFields.getRecords('2026-05-25', '17');
    const decodedUrls = mockSpFetch.mock.calls.map(([requestUrl]) => decodeURIComponent(String(requestUrl)));
    const parentUrl = decodedUrls.find((url) => url.includes('SupportRecord_Daily') && url.includes('$filter='));
    const childUrls = decodedUrls.filter((url) => url.includes('DailyRecordRows') && url.includes('$filter='));

    expect(parentUrl).toContain("RecordDate ge '2026-05-25'");
    expect(parentUrl).toContain("RecordDate lt '2026-05-26'");
    expect(parentUrl).not.toContain("RecordDate eq '2026-05-25'");
    expect(parentUrl).toContain('ID gt 0');
    expect(parentUrl).toContain('$orderby=ID asc');
    expect(parentUrl).toContain('$top=500');
    const childDataPages = childUrls.filter((url) => url.includes('ID gt 0'));
    expect(childDataPages).toHaveLength(2);
    expect(childUrls.some((url) => url.includes('Parent_x0020_ID eq 123'))).toBe(true);
    expect(childUrls.some((url) => url.includes('Parent_x0020_ID eq 456'))).toBe(true);
    expect(childUrls.every((url) => !url.includes("Parent_x0020_ID eq '"))).toBe(true);
    expect(childUrls.every((url) => !url.includes(' or '))).toBe(true);
    expect(childUrls.every((url) => !url.includes('startswith('))).toBe(true);
    expect(records).toHaveLength(1);
  });

  it('resolves an existing record by ParentID and client-side row identity without a Title filter', async () => {
    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string) => {
      const decoded = decodeURIComponent(url);
      if (decoded.includes('SupportRecord_Daily') && decoded.includes('$filter=')) {
        return { ok: true, json: async () => pagedValue(url, [{ Id: 123, Title: '2026-05-20-6' }]) };
      }
      if (decoded.includes('DailyRecordRows') && decoded.includes('Parent_x0020_ID eq 123')) {
        return {
          ok: true,
          json: async () => pagedValue(url, [{
            Id: 1,
            Title: '2026-05-20-6-0',
            User_x0020_ID: 'U006',
            RowNo: '0',
            Status: 'completed',
            Memo: 'legacy memo',
            Payload: 'legacy memo',
            Recorded_x0020_At: '2026-05-20T12:00:00Z',
          }]),
        };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });

    const record = await repo.getRecord('2026-05-20', '6', '0');
    const childUrls = mockSpFetch.mock.calls
      .map(([requestUrl]) => decodeURIComponent(String(requestUrl)))
      .filter((url) => url.includes('DailyRecordRows') && url.includes('$filter='));

    expect(record).toEqual(expect.objectContaining({
      date: '2026-05-20',
      userId: '6',
      scheduleItemId: '0',
      memo: 'legacy memo',
    }));
    const childDataPages = childUrls.filter((url) => url.includes('ID gt 0'));
    expect(childDataPages).toHaveLength(1);
    expect(childDataPages[0]).toContain('Parent_x0020_ID eq 123');
    expect(childUrls[0]).not.toContain('Title eq');
  });

  it('matches canonical procedure-N lookups to legacy raw schedule identities', async () => {
    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string) => {
      const decoded = decodeURIComponent(url);
      if (decoded.includes('SupportRecord_Daily') && decoded.includes('$filter=')) {
        return { ok: true, json: async () => pagedValue(url, [{ Id: 321, Title: '2026-05-21-U001' }]) };
      }
      if (decoded.includes('DailyRecordRows') && decoded.includes('Parent_x0020_ID eq 321')) {
        return {
          ok: true,
          json: async () => pagedValue(url, [{
            Id: 77,
            Title: '2026-05-21-U001-1',
            User_x0020_ID: 'U001',
            RowNo: '1',
            Status: 'completed',
            Memo: 'legacy procedure row',
            Payload: 'legacy procedure row',
            Recorded_x0020_At: '2026-05-21T09:00:00Z',
          }]),
        };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });

    const record = await repo.getRecord('2026-05-21', 'U001', 'procedure-1');
    expect(record).toEqual(expect.objectContaining({
      date: '2026-05-21',
      userId: 'U001',
      scheduleItemId: '1',
      memo: 'legacy procedure row',
    }));
  });

  it('deletes through parent-first lookup instead of Title eq filters', async () => {
    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const decoded = decodeURIComponent(url);
      if (decoded.includes('SupportRecord_Daily') && decoded.includes('$filter=')) {
        return { ok: true, json: async () => pagedValue(url, [{ Id: 321, Title: '2026-05-21-U001' }]) };
      }
      if (decoded.includes('DailyRecordRows') && decoded.includes('Parent_x0020_ID eq 321')) {
        return {
          ok: true,
          json: async () => pagedValue(url, [{
            Id: 77,
            Title: '2026-05-21-U001-1',
            User_x0020_ID: 'U001',
            RowNo: '1',
            Status: 'completed',
            Memo: 'to delete',
            Payload: 'to delete',
            Recorded_x0020_At: '2026-05-21T09:00:00Z',
          }]),
        };
      }
      if (decoded.includes('/items(77)') && init?.method === 'POST') {
        return { ok: true, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });

    await repo.deleteRecord('2026-05-21', 'U001', 'procedure-1');

    const decodedCalls = mockSpFetch.mock.calls.map(([requestUrl, init]) => ({
      url: decodeURIComponent(String(requestUrl)),
      method: init?.method,
      headers: init?.headers,
    }));
    expect(decodedCalls.some((call) => call.url.includes('Title eq'))).toBe(false);
    expect(decodedCalls.some((call) => (
      call.url.includes('/items(77)') &&
      call.method === 'POST' &&
      Boolean(call.headers && (call.headers as Record<string, string>)['X-HTTP-Method'] === 'DELETE')
    ))).toBe(true);
  });

  it('keeps a no-parent read empty and never creates a parent', async () => {
    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string) => {
      if (url.includes('SupportRecord_Daily') && url.includes('$filter=')) {
        return { ok: true, json: async () => ({ value: [] }) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });

    const repoWithFreshFields = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
      getListFieldInternalNames: mockGetFields,
    });

    await expect(repoWithFreshFields.getRecords('2026-05-25', '17')).resolves.toEqual([]);
    expect(mockSpFetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('propagates parent retrieval failures instead of treating them as zero records', async () => {
    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string) => {
      if (url.includes('SupportRecord_Daily') && url.includes('$filter=')) {
        return { ok: false, status: 500, statusText: 'List View Threshold', json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });

    const repoWithFreshFields = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
      getListFieldInternalNames: mockGetFields,
    });

    await expect(repoWithFreshFields.getRecords('2026-05-25', '17')).rejects.toThrow('Parent lookup failed');
  });

  it('fails closed when the resolved RecordDate field is not present in the parent schema', async () => {
    mockSpFetch.mockReset();
    mockSpFetch.mockResolvedValue({ ok: true, json: async () => ({ value: [] }) });
    const getFields = vi.fn(async (listTitle: string) => (
      listTitle === 'SupportRecord_Daily'
        ? new Set(['Title'])
        : new Set(['Title', EXECUTION_RECORD_FIELDS.parentId, EXECUTION_RECORD_FIELDS.rowKey])
    ));
    const repoWithInvalidParentSchema = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
      getListFieldInternalNames: getFields,
    });

    await expect(repoWithInvalidParentSchema.getRecords('2026-05-25', '17'))
      .rejects.toThrow('Recovery schema fields');
  });

  it('fails closed when the resolved ParentID field is not present in the child schema', async () => {
    mockSpFetch.mockReset();
    mockSpFetch.mockResolvedValue({ ok: true, json: async () => ({ value: [] }) });
    const getFields = vi.fn(async (listTitle: string) => (
      listTitle === 'SupportRecord_Daily'
        ? new Set(['Title', 'RecordDate'])
        : new Set(['Title'])
    ));
    const repoWithInvalidChildSchema = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
      getListFieldInternalNames: getFields,
    });

    await expect(repoWithInvalidChildSchema.getRecords('2026-05-25', '17'))
      .rejects.toThrow('Recovery schema fields');
  });

  it('rejects a non-numeric parent ID instead of emitting a quoted or unsafe child query', async () => {
    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string) => {
      const decoded = decodeURIComponent(url);
      if (decoded.includes('SupportRecord_Daily') && decoded.includes('$filter=')) {
        return { ok: true, json: async () => ({ value: [{ Id: '123', Title: '2026-05-25-17' }] }) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });
    const repoWithInvalidParentId = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
      getListFieldInternalNames: mockGetFields,
    });

    await expect(repoWithInvalidParentId.getRecords('2026-05-25', '17'))
      .rejects.toThrow('parent ID is not numeric');
    expect(mockSpFetch.mock.calls.some(([url]) => String(url).includes('DailyRecordRows'))).toBe(false);
  });

  it('fails closed when a matched parent has no numeric identity', async () => {
    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string) => {
      const decoded = decodeURIComponent(url);
      if (decoded.includes('SupportRecord_Daily') && decoded.includes('$filter=')) {
        return { ok: true, json: async () => ({ value: [{ Title: '2026-05-25-17' }] }) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });
    const repoWithUnresolvedParent = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
      getListFieldInternalNames: mockGetFields,
    });

    await expect(repoWithUnresolvedParent.getRecords('2026-05-25', '17'))
      .rejects.toThrow('parent ID is not numeric');
  });

  it('propagates child retrieval failures after a valid parent is resolved', async () => {
    mockSpFetch.mockReset();
    mockSpFetch.mockImplementation(async (url: string) => {
      const decoded = decodeURIComponent(url);
      if (decoded.includes('SupportRecord_Daily') && decoded.includes('$filter=')) {
        return { ok: true, json: async () => pagedValue(url, [{ Id: 123, Title: '2026-05-25-17' }]) };
      }
      if (decoded.includes('DailyRecordRows') && decoded.includes('Parent_x0020_ID eq 123')) {
        return { ok: false, status: 500, statusText: 'List View Threshold', json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ value: [] }) };
    });
    const repoWithChildFailure = new SharePointExecutionRecordRepository({
      spFetch: mockSpFetch,
      getListFieldInternalNames: mockGetFields,
    });

    await expect(repoWithChildFailure.getRecords('2026-05-25', '17'))
      .rejects.toThrow('Child lookup failed');
  });

  it('uses the existing half-open date contract across month and year boundaries', async () => {
    for (const [date, nextDate] of [['2024-01-31', '2024-02-01'], ['2024-12-31', '2025-01-01']]) {
      mockSpFetch.mockReset();
      mockSpFetch.mockImplementation(async (url: string) => {
        const decoded = decodeURIComponent(url);
        if (decoded.includes('SupportRecord_Daily') && decoded.includes('$filter=')) {
          return { ok: true, json: async () => ({ value: [] }) };
        }
        return { ok: true, json: async () => ({ value: [] }) };
      });
      const boundaryRepo = new SharePointExecutionRecordRepository({
        spFetch: mockSpFetch,
        getListFieldInternalNames: mockGetFields,
      });

      await boundaryRepo.getRecords(date, '17');
      const parentUrl = mockSpFetch.mock.calls
        .map(([requestUrl]) => decodeURIComponent(String(requestUrl)))
        .find((url) => url.includes('SupportRecord_Daily') && url.includes('$filter='));
      expect(parentUrl).toContain(`RecordDate ge '${date}'`);
      expect(parentUrl).toContain(`RecordDate lt '${nextDate}'`);
      expect(parentUrl).not.toContain('RecordDate eq');
    }
  });

  describe('mapToDomain fallback', () => {
    it('correctly falls back to parsing scheduleItemId from Title if RowNo is missing', () => {
      const mockItem = {
        Title: '2026-05-08-4-1',
        User_x0020_ID: '4',
        Status: 'completed',
        Memo: 'Test memo',
        Recorded_x0020_At: '2026-05-08T12:00:00Z',
      };
      
      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };

      // Call the private mapToDomain method using prototype/any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (repo as any).mapToDomain(mockItem, rf);
      
      expect(mapped.scheduleItemId).toBe('1');
      expect(mapped.userId).toBe('4');
      expect(mapped.date).toBe('2026-05-08');
    });

    it('correctly falls back to parsing scheduleItemId from RowKey if Title is not matched', () => {
      const mockItem = {
        Title: 'SomeCustomID',
        RowKey: '2026-05-08-4-15',
        User_x0020_ID: '4',
        Status: 'completed',
        Memo: 'Test memo',
        Recorded_x0020_At: '2026-05-08T12:00:00Z',
      };
      
      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'RowKey',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (repo as any).mapToDomain(mockItem, rf);
      
      expect(mapped.scheduleItemId).toBe('15');
      expect(mapped.userId).toBe('4');
      expect(mapped.date).toBe('2026-05-08');
    });

    it('correctly parses date and scheduleItemId when userId is mismatched (e.g. U006 in userId but 6 in key/title)', () => {
      const mockItem = {
        Title: '2026-05-20-6-0', // Old/migrated format has '6'
        User_x0020_ID: 'U006',    // Current userId is 'U006'
        Status: 'completed',
        Memo: 'Test memo',
        Recorded_x0020_At: '2026-05-20T12:00:00Z',
      };

      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (repo as any).mapToDomain(mockItem, rf);

      expect(mapped.scheduleItemId).toBe('0');
      expect(mapped.userId).toBe('U006');
      expect(mapped.date).toBe('2026-05-20');
    });

    it('correctly falls back to regex-based parsing from Title when userId is empty/unresolved', () => {
      const mockItem = {
        Title: '2026-05-26-U-017-2',
        User_x0020_ID: '', // empty userId
        Status: 'completed',
        Memo: 'Test memo',
        Recorded_x0020_At: '2026-05-26T12:00:00Z',
      };

      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (repo as any).mapToDomain(mockItem, rf);

      expect(mapped.scheduleItemId).toBe('2');
      expect(mapped.date).toBe('2026-05-26');
    });

    it('correctly falls back to regex-based parsing from Title containing base-prefix when userId is empty/unresolved', () => {
      const mockItem = {
        Title: '2026-05-26-U-017-base-2',
        User_x0020_ID: undefined, // undefined userId
        Status: 'completed',
        Memo: 'Test memo',
        Recorded_x0020_At: '2026-05-26T12:00:00Z',
      };

      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (repo as any).mapToDomain(mockItem, rf);

      expect(mapped.scheduleItemId).toBe('base-2');
      expect(mapped.date).toBe('2026-05-26');
    });

    it('correctly parses canonical prefixed scheduleItemId with hyphenated userId U-023', () => {
      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };

      const testCases = [
        { title: '2026-05-30-U-023-procedure-2', expected: 'procedure-2' },
        { title: '2026-05-30-U-023-slot-2', expected: 'slot-2' },
        { title: '2026-05-30-U-023-slot_2', expected: 'slot_2' },
        { title: '2026-05-30-U-023-step-2', expected: 'step-2' },
        { title: '2026-05-30-U-023-2', expected: '2' },
      ];

      for (const tc of testCases) {
        const mockItem = {
          Title: tc.title,
          User_x0020_ID: 'U-023',
          Status: 'completed',
          Memo: 'Test memo',
          Recorded_x0020_At: '2026-05-30T12:00:00Z',
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapped = (repo as any).mapToDomain(mockItem, rf);
        expect(mapped.scheduleItemId).toBe(tc.expected);
      }
    });

    it('prevents prefix hijacking in mapToDomain by trying longer matches first (e.g. matching "U-023" before "U" when title contains U-023)', () => {
      const mockItem = {
        Title: '2026-05-30-U-023-procedure-1',
        User_x0020_ID: 'U-023',
        Status: 'completed',
        Memo: 'Test memo',
        Recorded_x0020_At: '2026-05-30T12:00:00Z',
      };

      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (repo as any).mapToDomain(mockItem, rf);

      expect(mapped.scheduleItemId).toBe('procedure-1');
      expect(mapped.userId).toBe('U-023');
    });

    it('uses Memo when Memo has content', () => {
      const mockItem = {
        Title: '2026-05-08-4-1',
        User_x0020_ID: '4',
        Status: 'completed',
        Memo: 'memo-value',
        Payload: 'payload-value',
        Observation: 'observation-value',
        Recorded_x0020_At: '2026-05-08T12:00:00Z',
      };
      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (repo as any).mapToDomain(mockItem, rf);
      expect(mapped.memo).toBe('memo-value');
    });

    it('uses Payload when Memo is empty', () => {
      const mockItem = {
        Title: '2026-05-08-4-2',
        User_x0020_ID: '4',
        Status: 'completed',
        Memo: '   ',
        Payload: 'payload-value',
        Observation: 'observation-value',
        Recorded_x0020_At: '2026-05-08T12:00:00Z',
      };
      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (repo as any).mapToDomain(mockItem, rf);
      expect(mapped.memo).toBe('payload-value');
    });

    it('uses Observation when Memo and Payload are empty', () => {
      const mockItem = {
        Title: '2026-05-08-4-3',
        User_x0020_ID: '4',
        Status: 'completed',
        Memo: '',
        Payload: '   ',
        Observation: 'observation-value',
        Recorded_x0020_At: '2026-05-08T12:00:00Z',
      };
      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (repo as any).mapToDomain(mockItem, rf);
      expect(mapped.memo).toBe('observation-value');
    });

    it('skips empty strings and returns empty when all candidates are empty', () => {
      const mockItem = {
        Title: '2026-05-08-4-4',
        User_x0020_ID: '4',
        Status: 'completed',
        Memo: '   ',
        Payload: '',
        Observation: '\n\t',
        Recorded_x0020_At: '2026-05-08T12:00:00Z',
      };
      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (repo as any).mapToDomain(mockItem, rf);
      expect(mapped.memo).toBe('');
    });

    it('maps "done" and "committed" to "completed"', () => {
      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };

      const itemDone = {
        Title: '2026-05-08-4-1',
        User_x0020_ID: '4',
        Status: 'done',
        Recorded_x0020_At: '2026-05-08T12:00:00Z',
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedDone = (repo as any).mapToDomain(itemDone, rf);
      expect(mappedDone.status).toBe('completed');

      const itemCommitted = {
        Title: '2026-05-08-4-1',
        User_x0020_ID: '4',
        Status: 'committed',
        Recorded_x0020_At: '2026-05-08T12:00:00Z',
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedCommitted = (repo as any).mapToDomain(itemCommitted, rf);
      expect(mappedCommitted.status).toBe('completed');

      // English case variations
      const itemDoneUpper = { ...itemDone, Status: 'Done' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedDoneUpper = (repo as any).mapToDomain(itemDoneUpper, rf);
      expect(mappedDoneUpper.status).toBe('completed');

      const itemCompletedUpper = { ...itemDone, Status: 'COMPLETED' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedCompletedUpper = (repo as any).mapToDomain(itemCompletedUpper, rf);
      expect(mappedCompletedUpper.status).toBe('completed');

      // Japanese statuses
      const itemKanryo = { ...itemDone, Status: '完了' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedKanryo = (repo as any).mapToDomain(itemKanryo, rf);
      expect(mappedKanryo.status).toBe('completed');

      const itemSai = { ...itemDone, Status: '済' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedSai = (repo as any).mapToDomain(itemSai, rf);
      expect(mappedSai.status).toBe('completed');

      const itemTriggeredJp = { ...itemDone, Status: '行動発生' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedTriggeredJp = (repo as any).mapToDomain(itemTriggeredJp, rf);
      expect(mappedTriggeredJp.status).toBe('triggered');

      const itemSkippedJp = { ...itemDone, Status: 'スキップ' };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mappedSkippedJp = (repo as any).mapToDomain(itemSkippedJp, rf);
      expect(mappedSkippedJp.status).toBe('skipped');

    });

    it('handles SP Lookup objects in userId and rowNo fields without [object Object] corruption', () => {
      const mockItem = {
        Title: '2026-05-08-4-1',
        User_x0020_ID: { Title: '4', Id: 4 },   // SP Lookup型
        RowNo: { Title: '1', Id: 1 },             // SP Lookup型
        Status: 'completed',
        Memo: 'SP Lookup test',
        Recorded_x0020_At: '2026-05-08T12:00:00Z',
      };

      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (repo as any).mapToDomain(mockItem, rf);
      expect(mapped.userId).toBe('4');
      expect(mapped.scheduleItemId).toBe('1');
      expect(mapped.date).toBe('2026-05-08');
      expect(mapped.status).toBe('completed');
      // Ensure no [object Object] contamination
      expect(mapped.userId).not.toContain('[object');
      expect(mapped.scheduleItemId).not.toContain('[object');
    });

    it('handles SP Person object in userId field', () => {
      const mockItem = {
        Title: '2026-05-10-U004-3',
        User_x0020_ID: { Title: 'U004', EMail: 'u004@example.com', Id: 4 },
        RowNo: '3',
        Status: 'completed',
        Recorded_x0020_At: '2026-05-10T09:00:00Z',
      };

      const rf = {
        parentId: 'Parent_x0020_ID',
        userId: 'User_x0020_ID',
        version: 'Version',
        commitId: 'CommitId',
        status: 'Status',
        payload: 'Payload',
        recordedAt: 'Recorded_x0020_At',
        rowKey: 'Title',
        rowNo: 'RowNo',
        memo: 'Memo',
        staffName: 'StaffName',
        bipsJSON: 'BipsJSON',
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (repo as any).mapToDomain(mockItem, rf);
      expect(mapped.userId).toBe('U004');
      expect(mapped.scheduleItemId).toBe('3');
    });

  });

  describe('Strict Field Filtering Regressions', () => {
    it('retries historical query with numeric RowNo when text comparison returns empty', async () => {
      mockSpFetch.mockReset();
      mockSpFetch.mockImplementation(async (url: string) => {
        if (url.includes('/items?$select=') && url.includes('$orderby=')) {
          const decoded = decodeURIComponent(url);
          if (decoded.includes("RowNo eq '1'")) {
            return { ok: true, json: async () => ({ value: [] }) };
          }
          if (decoded.includes('RowNo eq 1')) {
            return {
              ok: true,
              json: async () => ({
                value: [
                  {
                    Id: 1,
                    Title: '2026-05-10-U010-1',
                    UserId: 'U010',
                    RowNo: 1,
                    Status: 'completed',
                    Payload: 'memo',
                    RecordedAt: '2026-05-10T09:00:00Z',
                    Created: '2026-05-10T09:00:00Z',
                  },
                ],
              }),
            };
          }
        }
        return { ok: true, json: async () => ({ value: [] }) };
      });

      const records = await repo.getHistoricalRecords('U010', '1');
      expect(records.length).toBe(1);

      const calls = mockSpFetch.mock.calls.map((call) => decodeURIComponent(String(call[0])));
      expect(calls.some((u) => u.includes("RowNo eq '1'"))).toBe(true);
      expect(calls.some((u) => u.includes('RowNo eq 1'))).toBe(true);
    });

    it('excludes RowNo from historical query URL when unresolved', async () => {
      mockSpFetch.mockReset();
      mockSpFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ value: [] }),
      });

      // Mock field resolution to NOT include RowNo
      const mockGetFieldsNoRowNo = vi.fn().mockResolvedValue(new Set(['Title', 'UserId', 'Status', 'Payload']));
      const repoStrict = new SharePointExecutionRecordRepository({
        spFetch: mockSpFetch,
        getListFieldInternalNames: mockGetFieldsNoRowNo,
      });

      await repoStrict.getHistoricalRecords('U001', 'S001');

      const lastCall = mockSpFetch.mock.calls[mockSpFetch.mock.calls.length - 1];
      const url = lastCall[0];
      
      expect(url).not.toContain('RowNo');
      expect(url).not.toContain('$select=undefined');
      expect(url).not.toContain('$filter=undefined');
    });

    it('does not include "undefined" keys in upsert payload when fields are unresolved', async () => {
      mockSpFetch.mockReset();
      mockSpFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ value: [] }),
      });

      // Mock field resolution to be empty (all drift-prone fields missing)
      const mockGetFieldsEmpty = vi.fn().mockResolvedValue(new Set(['Title', 'Parent_x0020_ID', 'User_x0020_ID', 'Status', 'Payload']));
      const repoStrict = new SharePointExecutionRecordRepository({
        spFetch: mockSpFetch,
        getListFieldInternalNames: mockGetFieldsEmpty,
      });

      const record: ExecutionRecord = {
        id: 'R001',
        date: '2024-01-01',
        userId: 'U001',
        scheduleItemId: 'S001',
        status: 'completed',
        memo: 'Test',
        recordedAt: '2024-01-01T10:00:00Z',
        recordedBy: 'Staff A',
        triggeredBipIds: [],
      };

      await expect(repoStrict.upsertRecord(record)).rejects.toThrow('Recovery schema fields');
      expect(mockSpFetch.mock.calls.some(call => call[1]?.method === 'POST')).toBe(false);
    });

    it('ensureParentRecord uses resolved parent date field (Date) when RecordDate is missing', async () => {
      const mockSpFetchDate = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        if (url.includes('SupportRecord_Daily') && init?.method === 'POST') {
          return { ok: true, json: async () => ({ d: { Id: 999 } }) };
        }
        if (url.includes('DailyRecordRows') && init?.method === 'POST') {
          return { ok: true, json: async () => ({ d: { Id: 1000 } }) };
        }
        if (url.includes('items?$top=1')) {
          if (url.includes('SupportRecord_Daily')) {
            return { ok: true, json: async () => ({ value: [{ Title: 'key', Date: '2026-05-14' }] }) };
          }
        }
        return { ok: true, json: async () => ({ value: [] }) };
      });

      const mockGetFieldsDate = vi.fn().mockResolvedValue(new Set([
        'Title',
        'Date', // Uses Date instead of RecordDate
        'UserId',
        EXECUTION_RECORD_FIELDS.rowKey,
        EXECUTION_RECORD_FIELDS.status,
        EXECUTION_RECORD_FIELDS.parentId,
        EXECUTION_RECORD_FIELDS.userId,
        EXECUTION_RECORD_FIELDS.rowNo,
        EXECUTION_RECORD_FIELDS.recordedAt,
      ]));

      const repoDate = new SharePointExecutionRecordRepository({
        spFetch: mockSpFetchDate,
        getListFieldInternalNames: mockGetFieldsDate,
      });

      const record: ExecutionRecord = {
        id: 'R001',
        date: '2024-01-01',
        userId: 'U001',
        scheduleItemId: 'S001',
        status: 'completed',
        memo: 'Test',
        recordedAt: '2024-01-01T10:00:00Z',
        recordedBy: 'Staff A',
        triggeredBipIds: [],
      };

      await repoDate.upsertRecord(record);

      const parentCreateCall = mockSpFetchDate.mock.calls.find(call =>
        call[0].includes('SupportRecord_Daily') && call[1]?.method === 'POST'
      );
      expect(parentCreateCall).toBeDefined();
      const body = JSON.parse(parentCreateCall![1]!.body as string);

      expect(body.Date).toBe('2024-01-01');
      expect(body.RecordDate).toBeUndefined();
    });
  });

  describe('hotfix C keyset paging', () => {
    const DATE = '2026-05-07';

    type Item = { Id: number; Title: string; [key: string]: unknown };
    type MockBody = { ok: boolean; status: number; statusText: string; json: () => Promise<unknown> };

    const okBody = (body: unknown): MockBody => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => body,
    });

    const lastIdOf = (url: string): number => Number(url.match(/ID gt (\d+)/)?.[1] ?? 0);

    const pageItems = (url: string, items: Item[]): Item[] => {
      const lastId = lastIdOf(url);
      return items.filter((item) => item.Id > lastId).sort((left, right) => left.Id - right.Id);
    };

    const childRow = (
      id: number,
      userId: string,
      scheduleItemId: string,
      memo: string,
    ): Item => ({
      Id: id,
      Title: `${DATE}-${userId}-${scheduleItemId}`,
      User_x0020_ID: userId,
      RowNo: scheduleItemId,
      Status: 'completed',
      Memo: memo,
      Payload: memo,
      Recorded_x0020_At: `${DATE}T09:00:00.000Z`,
    });

    const parentRow = (id: number, userId: string): Item => ({
      Id: id,
      Title: `${DATE}-${userId}`,
      RecordDate: DATE,
    });

    const draft = (userId: string, scheduleItemId: string, memo = 'edited'): ExecutionRecord => ({
      id: `${DATE}-${userId}-${scheduleItemId}`,
      date: DATE,
      userId,
      scheduleItemId,
      status: 'completed',
      memo,
      recordedAt: `${DATE}T10:00:00.000Z`,
      recordedBy: 'Staff A',
      triggeredBipIds: [],
    });

    const createRepo = (spFetch: ReturnType<typeof vi.fn>) => new SharePointExecutionRecordRepository({
      spFetch,
      getListFieldInternalNames: mockGetFields,
    });

    const urlsOf = (spFetch: ReturnType<typeof vi.fn>): string[] =>
      spFetch.mock.calls.map((call) => decodeURIComponent(String(call[0])));

    const postCount = (spFetch: ReturnType<typeof vi.fn>): number =>
      spFetch.mock.calls.filter((call) => call[1]?.method === 'POST').length;

    const headerCount = (spFetch: ReturnType<typeof vi.fn>, headerValue: string): number =>
      spFetch.mock.calls.filter((call) => {
        const headers = call[1]?.headers as Record<string, string> | undefined;
        return headers?.['X-HTTP-Method'] === headerValue;
      }).length;

    const installListServer = (
      parents: Item[],
      childrenByParent: Map<number, Item[]>,
      options?: {
        parentPage?: (url: string) => MockBody;
        childPage?: (url: string, parentId: number) => MockBody;
        shape?: 'value' | 'verbose';
      },
    ) => {
      const shape = options?.shape ?? 'value';
      const spFetch = vi.fn(async (url: string, init?: RequestInit) => {
        const decoded = decodeURIComponent(String(url));
        if (init?.method === 'POST') return okBody({});
        if (decoded.includes('SupportRecord_Daily') && decoded.includes('Title eq')) {
          const title = decoded.match(/Title eq '([^']+)'/)?.[1] ?? '';
          return okBody({ value: parents.filter((parent) => parent.Title === title) });
        }
        if (decoded.includes('SupportRecord_Daily') && decoded.includes('$filter=')) {
          if (options?.parentPage) return options.parentPage(decoded);
          const page = pageItems(decoded, parents);
          return okBody(shape === 'verbose' ? { d: { results: page } } : { value: page });
        }
        const parentMatch = decoded.match(/Parent_x0020_ID eq (\d+)/);
        if (decoded.includes('DailyRecordRows') && parentMatch) {
          const parentId = Number(parentMatch[1]);
          if (options?.childPage) return options.childPage(decoded, parentId);
          const page = pageItems(decoded, childrenByParent.get(parentId) ?? []);
          return okBody(shape === 'verbose' ? { d: { results: page } } : { value: page });
        }
        return okBody({ value: [] });
      });
      return spFetch;
    };

    it('matches the serial lookup on a normal single-page success and keeps candidate order', async () => {
      const parents = [parentRow(2, 'person-a'), parentRow(3, 'person-b'), parentRow(4, 'person-c')];
      const children = new Map<number, Item[]>([
        [2, [childRow(1, 'person-a', 'zz', 'later-user')]],
        [3, [childRow(50, 'person-b', 'aa', 'first-pair')]],
        [4, [childRow(2, 'person-c', 'aa', 'other-user')]],
      ]);
      const users = ['person-b', 'person-a'];
      const schedules = ['zz', 'aa'];
      const serialFetch = installListServer(parents, children);
      const serialRepo = createRepo(serialFetch);
      let serial: ExecutionRecord | undefined;
      for (const userId of users) {
        for (const scheduleItemId of schedules) {
          const found = await serialRepo.getRecord(DATE, userId, scheduleItemId);
          if (found) {
            serial = found;
            break;
          }
        }
        if (serial) break;
      }

      const batchedFetch = installListServer(parents, children);
      const batchedRepo = createRepo(batchedFetch);
      const batched = await batchedRepo.getRecordForCandidates(DATE, users, schedules);

      expect(batched).toEqual(serial);
      expect(batched).toEqual(expect.objectContaining({
        userId: 'person-b',
        scheduleItemId: 'aa',
        memo: 'first-pair',
      }));
      const childData = urlsOf(batchedFetch).filter((url) =>
        url.includes('DailyRecordRows') && url.includes('ID gt 0'));
      expect(childData).toHaveLength(1);
      expect(childData[0]).toContain('Parent_x0020_ID eq 3');
      expect(urlsOf(batchedFetch).some((url) => url.includes('Parent_x0020_ID eq 2'))).toBe(false);
      expect(urlsOf(batchedFetch).some((url) => url.includes('Parent_x0020_ID eq 4'))).toBe(false);
    });

    it('keeps legacy raw, row-N, and procedure-N identities as the save target', async () => {
      const parents = [parentRow(321, 'U001')];
      const children = new Map<number, Item[]>([
        [321, [
          childRow(77, 'U001', '1', 'legacy-raw'),
          childRow(78, 'U001', 'row-4', 'legacy-row'),
          childRow(79, 'U001', 'procedure-5', 'legacy-procedure'),
        ]],
      ]);
      const spFetch = installListServer(parents, children);
      const repo = createRepo(spFetch);

      await expect(repo.getRecord(DATE, 'U001', 'procedure-1')).resolves.toEqual(expect.objectContaining({
        scheduleItemId: '1',
        memo: 'legacy-raw',
      }));
      await expect(repo.getRecord(DATE, 'U001', 'procedure-4')).resolves.toEqual(expect.objectContaining({
        scheduleItemId: 'row-4',
        memo: 'legacy-row',
      }));
      await expect(repo.getRecord(DATE, 'U001', 'procedure-5')).resolves.toEqual(expect.objectContaining({
        scheduleItemId: 'procedure-5',
        memo: 'legacy-procedure',
      }));
      await expect(repo.getRecord(DATE, 'U001', 'procedure-11')).resolves.toBeUndefined();
      await expect(repo.getRecord(DATE, 'person-c', 'procedure-1')).resolves.toBeUndefined();

      await repo.upsertRecord(draft('U001', 'procedure-1', 'updated legacy'));
      expect(headerCount(spFetch, 'MERGE')).toBe(1);
      expect(urlsOf(spFetch).some((url) => url.includes('/items(77)'))).toBe(true);
      expect(urlsOf(spFetch).filter((url) => url.includes('DailyRecordRows') && url.endsWith('/items'))).toHaveLength(0);
      expect(postCount(spFetch)).toBe(1);
    });

    it('finds a child row that exists only after a 100-row page and after a 500-row page', async () => {
      for (const boundary of [100, 500]) {
        const spFetch = installListServer(
          [parentRow(9, 'person-a')],
          new Map(),
          {
            childPage: (url) => {
              const lastId = lastIdOf(url);
              if (lastId === 0) {
                return okBody({
                  value: Array.from({ length: boundary }, (_, index) => childRow(index + 1, 'person-a', 'zz', 'filler')),
                });
              }
              if (lastId === boundary) return okBody({ value: [childRow(boundary + 1, 'person-a', 'aa', 'later-child')] });
              return okBody({ value: [] });
            },
          },
        );
        const repo = createRepo(spFetch);
        await expect(repo.getRecord(DATE, 'person-a', 'aa')).resolves.toEqual(expect.objectContaining({
          memo: 'later-child',
          scheduleItemId: 'aa',
        }));
        expect(urlsOf(spFetch).some((url) => url.includes(`ID gt ${boundary}`))).toBe(true);
        expect(urlsOf(spFetch).some((url) => url.includes('odata.nextLink') || url.startsWith('http'))).toBe(false);
      }
    });

    it('finds a parent that exists only after a 100-row page and after a 500-row page', async () => {
      for (const boundary of [100, 500]) {
        const matchingId = boundary + 1;
        const spFetch = installListServer(
          [],
          new Map([[matchingId, [childRow(8, 'person-a', 'aa', 'later-parent')]]]),
          {
            parentPage: (url) => {
              const lastId = lastIdOf(url);
              if (lastId === 0) {
                return okBody({
                  value: Array.from({ length: boundary }, (_, index) => parentRow(index + 1, `other-${index + 1}`)),
                });
              }
              if (lastId === boundary) return okBody({ value: [parentRow(matchingId, 'person-a')] });
              return okBody({ value: [] });
            },
          },
        );
        const repo = createRepo(spFetch);
        await expect(repo.getRecord(DATE, 'person-a', 'aa')).resolves.toEqual(expect.objectContaining({
          memo: 'later-parent',
        }));
        const childUrls = urlsOf(spFetch).filter((url) => url.includes('DailyRecordRows') && url.includes('$filter='));
        expect(childUrls.every((url) => url.includes(`Parent_x0020_ID eq ${matchingId}`))).toBe(true);
        expect(childUrls.length).toBeGreaterThan(0);
      }
    });

    it('updates a later-page row once and does not create a parent or child', async () => {
      const spFetch = installListServer(
        [parentRow(9, 'person-a')],
        new Map(),
        {
          childPage: (url) => {
            const lastId = lastIdOf(url);
            if (lastId === 0) {
              return okBody({
                value: Array.from({ length: 500 }, (_, index) => childRow(index + 1, 'person-a', 'zz', 'filler')),
              });
            }
            if (lastId === 500) return okBody({ value: [childRow(501, 'person-a', 'aa', 'saved')] });
            return okBody({ value: [] });
          },
        },
      );
      const repo = createRepo(spFetch);
      await repo.upsertRecord(draft('person-a', 'aa', 'updated'));
      expect(headerCount(spFetch, 'MERGE')).toBe(1);
      expect(urlsOf(spFetch).filter((url) => url.includes('/items(501)'))).toHaveLength(1);
      expect(headerCount(spFetch, 'DELETE')).toBe(0);
      expect(urlsOf(spFetch).some((url) => url.includes('DailyRecordRows') && url.endsWith('/items') && !url.includes('$filter='))).toBe(false);
      expect(urlsOf(spFetch).some((url) => url.includes('SupportRecord_Daily') && url.endsWith('/items'))).toBe(false);

      await repo.deleteRecord(DATE, 'person-a', 'aa');
      expect(headerCount(spFetch, 'DELETE')).toBe(1);
      expect(headerCount(spFetch, 'MERGE')).toBe(1);
    });

    it('updates a row whose parent exists only on a later page and creates nothing', async () => {
      const spFetch = installListServer(
        [parentRow(101, 'person-a')],
        new Map([[101, [childRow(7, 'person-a', 'aa', 'saved')]]]),
        {
          parentPage: (url) => {
            const lastId = lastIdOf(url);
            if (url.includes('Title eq')) return okBody({ value: [parentRow(101, 'person-a')] });
            if (lastId === 0) {
              return okBody({
                value: Array.from({ length: 100 }, (_, index) => parentRow(index + 1, `other-${index + 1}`)),
              });
            }
            if (lastId === 100) return okBody({ value: [parentRow(101, 'person-a')] });
            return okBody({ value: [] });
          },
        },
      );
      const repo = createRepo(spFetch);
      await repo.upsertRecord(draft('person-a', 'aa', 'updated'));
      expect(headerCount(spFetch, 'MERGE')).toBe(1);
      expect(urlsOf(spFetch).some((url) => url.includes('/items(7)'))).toBe(true);
      expect(postCount(spFetch)).toBe(1);
    });

    it('reads verbose d.results and ignores server nextLink values', async () => {
      const evil = 'https://evil.example/next';
      const spFetch = installListServer(
        [parentRow(9, 'person-a')],
        new Map([[9, [childRow(4, 'person-a', 'aa', 'verbose-hit')]]]),
        { shape: 'verbose' },
      );
      spFetch.mockImplementation(async (url: string, init?: RequestInit) => {
        const decoded = decodeURIComponent(String(url));
        if (init?.method === 'POST') return okBody({});
        if (decoded.includes('SupportRecord_Daily') && decoded.includes('$filter=')) {
          const page = pageItems(decoded, [parentRow(9, 'person-a')]);
          return okBody({ d: { results: page, __next: evil }, 'odata.nextLink': evil });
        }
        if (decoded.includes('DailyRecordRows') && decoded.includes('$filter=')) {
          const page = pageItems(decoded, [childRow(4, 'person-a', 'aa', 'verbose-hit')]);
          return okBody({ d: { results: page }, '@odata.nextLink': evil });
        }
        return okBody({ value: [] });
      });
      const repo = createRepo(spFetch);
      await expect(repo.getRecord(DATE, 'person-a', 'aa')).resolves.toEqual(expect.objectContaining({
        memo: 'verbose-hit',
      }));
      expect(urlsOf(spFetch).some((url) => url.includes('evil.example'))).toBe(false);
      expect(urlsOf(spFetch).every((url) => !/^[a-z][a-z+.-]*:/i.test(url))).toBe(true);
    });

    it('does not flag separate user candidates, and does flag two rows in the first pair', async () => {
      const separateFetch = installListServer(
        [parentRow(2, 'person-a'), parentRow(3, 'person-b')],
        new Map([
          [2, [childRow(1, 'person-a', 'aa', 'only-a')]],
          [3, [childRow(2, 'person-b', 'aa', 'only-b')]],
        ]),
      );
      const separateRepo = createRepo(separateFetch);
      await expect(separateRepo.getRecordForCandidates(DATE, ['person-a', 'person-b'], ['aa']))
        .resolves.toEqual(expect.objectContaining({ userId: 'person-a', memo: 'only-a' }));

      const ambiguousFetch = installListServer(
        [parentRow(2, 'person-a'), parentRow(3, 'PERSON-A')],
        new Map([
          [2, [childRow(10, 'person-a', 'aa', 'exact-a')]],
          [3, [childRow(11, 'person-a', 'aa', 'exact-b')]],
        ]),
      );
      const ambiguousRepo = createRepo(ambiguousFetch);
      await expect(ambiguousRepo.getRecord(DATE, 'person-a', 'aa')).rejects.toBeInstanceOf(AmbiguousExecutionRecordError);
      await expect(ambiguousRepo.upsertRecord(draft('person-a', 'aa'))).rejects.toMatchObject({
        code: AMBIGUOUS_EXECUTION_RECORD,
      });
      await expect(ambiguousRepo.deleteRecord(DATE, 'person-a', 'aa')).rejects.toMatchObject({
        code: AMBIGUOUS_EXECUTION_RECORD,
      });
      expect(postCount(ambiguousFetch)).toBe(0);
    });

    it('rejects exact-plus-procedure duplicates and a second match on a later page with zero writes', async () => {
      const mixedFetch = installListServer(
        [parentRow(9, 'person-a')],
        new Map([[9, [
          childRow(10, 'person-a', 'procedure-1', 'exact'),
          childRow(11, 'person-a', '1', 'procedure-row'),
        ]]]),
      );
      const mixedRepo = createRepo(mixedFetch);
      await expect(mixedRepo.getRecord(DATE, 'person-a', 'procedure-1')).rejects.toMatchObject({
        code: AMBIGUOUS_EXECUTION_RECORD,
      });
      await expect(mixedRepo.upsertRecord(draft('person-a', 'procedure-1'))).rejects.toMatchObject({
        code: AMBIGUOUS_EXECUTION_RECORD,
      });
      await expect(mixedRepo.deleteRecord(DATE, 'person-a', 'procedure-1')).rejects.toMatchObject({
        code: AMBIGUOUS_EXECUTION_RECORD,
      });
      expect(postCount(mixedFetch)).toBe(0);

      const laterFetch = installListServer(
        [parentRow(9, 'person-a')],
        new Map(),
        {
          childPage: (url) => {
            const lastId = lastIdOf(url);
            if (lastId === 0) return okBody({ value: [childRow(10, 'person-a', 'aa', 'first')] });
            if (lastId === 10) return okBody({ value: [childRow(11, 'person-a', 'aa', 'second')] });
            return okBody({ value: [] });
          },
        },
      );
      const laterRepo = createRepo(laterFetch);
      await expect(laterRepo.getRecord(DATE, 'person-a', 'aa')).rejects.toMatchObject({
        code: AMBIGUOUS_EXECUTION_RECORD,
      });
      await expect(laterRepo.upsertRecord(draft('person-a', 'aa'))).rejects.toMatchObject({
        code: AMBIGUOUS_EXECUTION_RECORD,
      });
      await expect(laterRepo.deleteRecord(DATE, 'person-a', 'aa')).rejects.toMatchObject({
        code: AMBIGUOUS_EXECUTION_RECORD,
      });
      expect(postCount(laterFetch)).toBe(0);
    });

    it('reduces U=20 S=15 serial parent/child reads from 600 to one paged pass', async () => {
      const users = Array.from({ length: 20 }, (_, index) => `person-${String.fromCharCode(97 + index)}`);
      const schedules = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'ii', 'jj', 'kk', 'll', 'mm', 'nn', 'oo'];
      const parents = users.map((userId, index) => parentRow(index + 1, userId));
      const children = new Map(parents.map((parent) => [
        parent.Id,
        [childRow(1000 + parent.Id, String(parent.Title).slice(DATE.length + 1), 'nomatch', 'unused')],
      ]));
      const parentsPerUser = 1;
      const legacySerialRequests = schedules.length * users.length * (1 + parentsPerUser);
      expect(legacySerialRequests).toBe(600);

      const spFetch = installListServer(parents, children);
      const repo = createRepo(spFetch);
      await expect(repo.getRecordForCandidates(DATE, users, schedules)).resolves.toBeUndefined();

      const itemReads = urlsOf(spFetch).filter((url) => url.includes('$filter=') && url.includes('ID gt'));
      const parentReads = itemReads.filter((url) => url.includes('SupportRecord_Daily') && !url.includes('Title eq'));
      const childReads = itemReads.filter((url) => url.includes('DailyRecordRows'));
      expect(itemReads).toHaveLength(42);
      expect(parentReads).toHaveLength(2);
      expect(childReads).toHaveLength(40);
      expect(itemReads).toHaveLength(legacySerialRequests === 600 ? 42 : -1);
      expect(parentReads.every((url) => url.includes("RecordDate ge '") && url.includes('ID gt') && !url.includes(' or '))).toBe(true);
      expect(childReads.every((url) => url.includes('Parent_x0020_ID eq') && url.includes('ID gt') && !url.includes(' or '))).toBe(true);
      expect(itemReads.every((url) => url.includes('$top=500') && url.includes('$orderby=ID asc'))).toBe(true);
      expect(itemReads.some((url) => /(?:^|[?&])\$filter=\(?ID gt/.test(url))).toBe(false);
    });

    it('fetches one shared parent once when several candidates alias it', async () => {
      const spFetch = installListServer(
        [{ Id: 6, Title: `${DATE}-6`, RecordDate: DATE }],
        new Map([[6, [childRow(1, '6', 'nomatch', 'unused')]]]),
      );
      const repo = createRepo(spFetch);
      await repo.getRecordForCandidates(DATE, ['6', '4'], ['aa', 'bb', 'cc', 'dd']);
      const childData = urlsOf(spFetch).filter((url) => url.includes('DailyRecordRows') && url.includes('ID gt 0'));
      expect(childData).toHaveLength(1);
    });
  });

  describe('hotfix C fail closed', () => {
    const DATE = '2026-05-07';

    const okBody = (body: unknown) => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => body,
    });

    const createRepo = (spFetch: ReturnType<typeof vi.fn>) => new SharePointExecutionRecordRepository({
      spFetch,
      getListFieldInternalNames: mockGetFields,
    });

    const urlsOf = (spFetch: ReturnType<typeof vi.fn>): string[] =>
      spFetch.mock.calls.map((call) => decodeURIComponent(String(call[0])));

    const postCount = (spFetch: ReturnType<typeof vi.fn>): number =>
      spFetch.mock.calls.filter((call) => call[1]?.method === 'POST').length;

    const parentItem = { Id: 9, Title: `${DATE}-person-a`, RecordDate: DATE };
    const childItem = {
      Id: 4,
      Title: `${DATE}-person-a-aa`,
      User_x0020_ID: 'person-a',
      RowNo: 'aa',
      Status: 'completed',
      Memo: 'saved',
      Payload: 'saved',
      Recorded_x0020_At: `${DATE}T09:00:00.000Z`,
    };

    const server = (options: {
      parentAt: (lastId: number) => unknown;
      childAt: (lastId: number) => unknown;
    }) => vi.fn(async (url: string, init?: RequestInit) => {
      const decoded = decodeURIComponent(String(url));
      if (init?.method === 'POST') return okBody({});
      if (decoded.includes('SupportRecord_Daily') && decoded.includes('Title eq')) {
        return okBody({ value: [parentItem] });
      }
      const lastId = Number(decoded.match(/ID gt (\d+)/)?.[1] ?? -1);
      if (decoded.includes('SupportRecord_Daily') && decoded.includes('$filter=')) {
        const body = options.parentAt(lastId);
        if (body && typeof body === 'object' && 'ok' in body) return body;
        return okBody(body);
      }
      if (decoded.includes('DailyRecordRows') && decoded.includes('$filter=')) {
        const body = options.childAt(lastId);
        if (body && typeof body === 'object' && 'ok' in body) return body;
        return okBody(body);
      }
      return okBody({ value: [] });
    });

    const refuseWrites = async (spFetch: ReturnType<typeof vi.fn>, repo: SharePointExecutionRecordRepository) => {
      const record = draftRecord();
      await expect(repo.getRecord(DATE, 'person-a', 'aa')).rejects.toThrow();
      await expect(repo.upsertRecord(record)).rejects.toThrow();
      await expect(repo.deleteRecord(DATE, 'person-a', 'aa')).rejects.toThrow();
      expect(postCount(spFetch)).toBe(0);
    };

    const draftRecord = (): ExecutionRecord => ({
      id: `${DATE}-person-a-aa`,
      date: DATE,
      userId: 'person-a',
      scheduleItemId: 'aa',
      status: 'completed',
      memo: 'edited',
      recordedAt: `${DATE}T10:00:00.000Z`,
      recordedBy: 'Staff A',
      triggeredBipIds: [],
    });

    it('rejects a later parent or child page failure instead of returning a partial row', async () => {
      const parentFailure = server({
        parentAt: (lastId) => {
          if (lastId === 0) return { value: [parentItem] };
          return { ok: false, status: 500, statusText: 'List View Threshold', json: async () => ({}) };
        },
        childAt: () => ({ value: [childItem] }),
      });
      const parentRepo = createRepo(parentFailure);
      await refuseWrites(parentFailure, parentRepo);
      expect(urlsOf(parentFailure).some((url) => url.includes('DailyRecordRows'))).toBe(false);

      const childFailure = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: (lastId) => {
          if (lastId === 0) return { value: [childItem] };
          return { ok: false, status: 429, statusText: 'Too Many Requests', json: async () => ({}) };
        },
      });
      const childRepo = createRepo(childFailure);
      await expect(childRepo.getRecord(DATE, 'person-a', 'aa')).rejects.toThrow('Child lookup failed');
      await expect(childRepo.upsertRecord(draftRecord())).rejects.toThrow('Child lookup failed');
      await expect(childRepo.deleteRecord(DATE, 'person-a', 'aa')).rejects.toThrow('Child lookup failed');
      expect(postCount(childFailure)).toBe(0);
    });

    it.each([
      { label: 'null payload', body: null },
      { label: 'array payload', body: [] },
      { label: 'null value', body: { value: null } },
      { label: 'object value', body: { value: {} } },
      { label: 'missing results', body: { d: {} } },
      { label: 'null results', body: { d: { results: null } } },
      { label: 'top-level results', body: { results: [] } },
      { label: 'empty object', body: {} },
    ])('treats $label as an error rather than zero records', async ({ body }) => {
      const spFetch = server({
        parentAt: () => body,
        childAt: () => ({ value: [] }),
      });
      const repo = createRepo(spFetch);
      await expect(repo.getRecords(DATE, 'person-a')).rejects.toThrow('unrecognized response shape');
      await expect(repo.getRecord(DATE, 'person-a', 'aa')).rejects.toThrow('unrecognized response shape');
      expect(postCount(spFetch)).toBe(0);
    });

    it('rejects unparseable JSON, non-monotonic IDs, and a 51st data page', async () => {
      const badJson = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: (lastId) => {
          if (lastId === 0) return { value: [childItem] };
          return {
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => {
              throw new SyntaxError('bad json');
            },
          };
        },
      });
      await expect(createRepo(badJson).getRecord(DATE, 'person-a', 'aa')).rejects.toThrow('unparseable JSON');
      expect(postCount(badJson)).toBe(0);

      const backwards = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: (lastId) => (lastId === 0 ? { value: [childItem, { ...childItem, Id: 3 }] } : { value: [] }),
      });
      await expect(createRepo(backwards).upsertRecord(draftRecord())).rejects.toThrow('non-monotonic ID');
      expect(postCount(backwards)).toBe(0);

      const overflow = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: (lastId) => {
          if (lastId >= 51) return { value: [] };
          return { value: [{ ...childItem, Id: lastId + 1, Title: `${DATE}-person-a-zz`, RowNo: 'zz', Memo: 'filler' }] };
        },
      });
      await expect(createRepo(overflow).getRecord(DATE, 'person-a', 'aa')).rejects.toThrow('page limit exceeded');
      expect(urlsOf(overflow).some((url) => url.includes('ID gt 51'))).toBe(false);
      expect(postCount(overflow)).toBe(0);

      const capped = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: (lastId) => {
          if (lastId >= 50) return { value: [] };
          const id = lastId + 1;
          const scheduleItemId = id === 50 ? 'aa' : 'zz';
            const memo = id === 50 ? 'page-50' : 'filler';
            return {
              value: [{
                ...childItem,
                Id: id,
                Title: `${DATE}-person-a-${scheduleItemId}`,
                RowNo: scheduleItemId,
                Memo: memo,
                Payload: memo,
              }],
            };
        },
      });
      await expect(createRepo(capped).getRecord(DATE, 'person-a', 'aa')).resolves.toEqual(expect.objectContaining({
        memo: 'page-50',
      }));
      expect(urlsOf(capped).some((url) => url.includes('ID gt 50'))).toBe(true);
      expect(urlsOf(capped).some((url) => url.includes('ID gt 51'))).toBe(false);

      const parentOverflow = server({
        parentAt: (lastId) => {
          if (lastId >= 51) return { value: [] };
          return { value: [{ ...parentItem, Id: lastId + 1, Title: `${DATE}-other-${lastId + 1}` }] };
        },
        childAt: () => ({ value: [childItem] }),
      });
      await expect(createRepo(parentOverflow).getRecords(DATE, 'person-a')).rejects.toThrow('page limit exceeded');
      expect(urlsOf(parentOverflow).some((url) => url.includes('DailyRecordRows'))).toBe(false);
      expect(urlsOf(parentOverflow).some((url) => url.includes('ID gt 51'))).toBe(false);
    });

    it('classifies absent as a create and a single pinned row as that item id', async () => {
      const absentFetch = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: () => ({ value: [] }),
      });
      const absentRepo = createRepo(absentFetch);
      await expect(absentRepo.classifyExecutionCandidates(DATE, ['person-a'], ['aa'])).resolves.toEqual({ kind: 'absent' });
      await absentRepo.upsertRecord(draftRecord());
      expect(postCount(absentFetch)).toBeGreaterThan(0);
      expect(urlsOf(absentFetch).some((url) => url.includes('DailyRecordRows') && url.endsWith('/items') && !url.includes('items('))).toBe(true);

      const uniqueFetch = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: (lastId) => (lastId === 0 ? { value: [childItem] } : { value: [] }),
      });
      const uniqueRepo = createRepo(uniqueFetch);
      await expect(uniqueRepo.classifyExecutionCandidates(DATE, ['person-a'], ['aa'])).resolves.toMatchObject({
        kind: 'unique',
        internalId: 4,
      });
      await uniqueRepo.upsertRecord(draftRecord());
      expect(urlsOf(uniqueFetch).filter((url) => url.includes('/items(4)'))).toHaveLength(1);
      expect(urlsOf(uniqueFetch).some((url) => url.includes('DailyRecordRows') && url.endsWith('/items') && !url.includes('items('))).toBe(false);
    });

    it('treats the same item id seen through two parent aliases as one row', async () => {
      const shared = { ...childItem, Id: 10 };
      const spFetch = server({
        parentAt: (lastId) => {
          if (lastId === 0) {
            return { value: [parentItem, { ...parentItem, Id: 10, Title: `${DATE}-PERSON-A` }] };
          }
          return { value: [] };
        },
        childAt: (lastId) => (lastId === 0 ? { value: [shared] } : { value: [] }),
      });
      const repo = createRepo(spFetch);
      await expect(repo.classifyExecutionCandidates(DATE, ['person-a'], ['aa'])).resolves.toMatchObject({
        kind: 'unique',
        internalId: 10,
      });
      await repo.upsertRecord(draftRecord());
      await repo.deleteRecord(DATE, 'person-a', 'aa');
      expect(urlsOf(spFetch).filter((url) => url.includes('/items(10)'))).toHaveLength(2);
    });

    it('blocks writes when two item ids match or the pinned row disagrees with the target', async () => {
      const duplicateFetch = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: (lastId) => (lastId === 0
          ? { value: [childItem, { ...childItem, Id: 8, Memo: 'other' }] }
          : { value: [] }),
      });
      const duplicateRepo = createRepo(duplicateFetch);
      await expect(duplicateRepo.classifyExecutionCandidates(DATE, ['person-a'], ['aa'])).resolves.toEqual({ kind: 'duplicate' });
      await expect(duplicateRepo.upsertRecord(draftRecord())).rejects.toMatchObject({ code: AMBIGUOUS_EXECUTION_RECORD });
      await expect(duplicateRepo.deleteRecord(DATE, 'person-a', 'aa')).rejects.toMatchObject({ code: AMBIGUOUS_EXECUTION_RECORD });
      expect(postCount(duplicateFetch)).toBe(0);

      const mismatchedFetch = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: (lastId) => (lastId === 0
          ? { value: [{ ...childItem, User_x0020_ID: 'other-user', Title: `1999-01-01-person-a-aa` }] }
          : { value: [] }),
      });
      const mismatchedRepo = createRepo(mismatchedFetch);
      await expect(mismatchedRepo.classifyExecutionCandidates(DATE, ['person-a'], ['aa'])).resolves.toEqual({ kind: 'mismatch' });
      await expect(mismatchedRepo.upsertRecord(draftRecord())).rejects.toBeInstanceOf(ExecutionTargetMismatchError);
      await expect(mismatchedRepo.deleteRecord(DATE, 'person-a', 'aa')).rejects.toBeInstanceOf(ExecutionTargetMismatchError);
      expect(postCount(mismatchedFetch)).toBe(0);
    });

    const writeCount = (spFetch: ReturnType<typeof vi.fn>): number =>
      spFetch.mock.calls.filter((call) => {
        const method = String(call[1]?.method ?? 'GET').toUpperCase();
        const headers = call[1]?.headers as Record<string, string> | undefined;
        const override = String(headers?.['X-HTTP-Method'] ?? '').toUpperCase();
        return method === 'POST' || method === 'MERGE' || method === 'DELETE'
          || override === 'MERGE' || override === 'DELETE';
      }).length;

    const expectMismatchStaysBlocked = async (
      spFetch: ReturnType<typeof vi.fn>,
      repo: SharePointExecutionRecordRepository,
    ) => {
      await expect(repo.classifyExecutionCandidates(DATE, ['person-a'], ['aa'])).resolves.toEqual({ kind: 'mismatch' });
      await expect(repo.upsertRecord(draftRecord())).rejects.toMatchObject({ code: 'EXECUTION_TARGET_MISMATCH' });
      await expect(repo.deleteRecord(DATE, 'person-a', 'aa')).rejects.toBeInstanceOf(ExecutionTargetMismatchError);
      await expect(repo.upsertRecord(draftRecord())).rejects.toMatchObject({ code: 'EXECUTION_TARGET_MISMATCH' });
      await expect(repo.deleteRecord(DATE, 'person-a', 'aa')).rejects.toBeInstanceOf(ExecutionTargetMismatchError);
      expect(writeCount(spFetch)).toBe(0);
    };

    it('forbids update and delete when only the stored date mismatches', async () => {
      const spFetch = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: (lastId) => (lastId === 0
          ? { value: [{ ...childItem, Title: '1999-01-01-person-a-aa', User_x0020_ID: 'person-a', RowNo: 'aa' }] }
          : { value: [] }),
      });
      await expectMismatchStaysBlocked(spFetch, createRepo(spFetch));
    });

    it('forbids update and delete when only the stored user mismatches', async () => {
      const spFetch = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: (lastId) => (lastId === 0
          ? {
              value: [{
                ...childItem,
                Title: `${DATE}-person-a-aa`,
                UserId: 'other-user',
                User_x0020_ID: 'other-user',
                RowNo: 'aa',
              }],
            }
          : { value: [] }),
      });
      await expectMismatchStaysBlocked(spFetch, createRepo(spFetch));
    });

    it('fails closed on a 51st data page and completes when page 50 is followed by an empty page', async () => {
      const overflow = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: (lastId) => {
          if (lastId >= 51) return { value: [] };
          return { value: [{ ...childItem, Id: lastId + 1, Title: `${DATE}-person-a-zz`, RowNo: 'zz' }] };
        },
      });
      const overflowRepo = createRepo(overflow);
      await expect(overflowRepo.classifyExecutionCandidates(DATE, ['person-a'], ['aa'])).rejects.toThrow('page limit exceeded');
      await expect(overflowRepo.upsertRecord(draftRecord())).rejects.toThrow('page limit exceeded');
      expect(postCount(overflow)).toBe(0);

      const capped = server({
        parentAt: (lastId) => (lastId === 0 ? { value: [parentItem] } : { value: [] }),
        childAt: (lastId) => {
          if (lastId >= 50) return { value: [] };
          const id = lastId + 1;
          const scheduleItemId = id === 50 ? 'aa' : 'zz';
          return {
            value: [{
              ...childItem,
              Id: id,
              Title: `${DATE}-person-a-${scheduleItemId}`,
              RowNo: scheduleItemId,
              Memo: id === 50 ? 'page-50' : 'filler',
              Payload: id === 50 ? 'page-50' : 'filler',
            }],
          };
        },
      });
      await expect(createRepo(capped).classifyExecutionCandidates(DATE, ['person-a'], ['aa'])).resolves.toMatchObject({
        kind: 'unique',
        internalId: 50,
        record: expect.objectContaining({ memo: 'page-50' }),
      });
    });
  });
});

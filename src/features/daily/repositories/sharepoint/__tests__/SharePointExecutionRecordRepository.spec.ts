import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SharePointExecutionRecordRepository } from '../SharePointExecutionRecordRepository';
import { EXECUTION_RECORD_FIELDS } from '../constants';
import type { ExecutionRecord } from '../../../domain/executionRecordTypes';

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

    // 1. resolveParentPath probe
    mockSpFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) });
    // 2. resolveRowsPath probe
    mockSpFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) });
    // 3. resolveRowsFields -> getListFieldNames (if getListFieldInternalNames is provided, it might skip this or use it)
    
    // 4. ensureParentRecord lookup
    mockSpFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [{ Id: 123 }] }),
    });
    
    // 5. getRecord (checks if exists)
    mockSpFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [] }),
    });

    // 6. Final call to createItem (the one we want to check)
    mockSpFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ d: { Id: 456 } }),
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

    // resolveParentPath probe
    mockSpFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) });
    // resolveRowsPath probe
    mockSpFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ value: [] }) });
    // getListFieldNames call (since no getListFieldInternalNames provided)
    mockSpFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ value: [{ InternalName: 'Title' }] }) });

    mockSpFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ value: [{ Id: 123 }] }),
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
        return { ok: true, json: async () => ({ value: [{ Id: 123 }] }) };
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

      await repoStrict.upsertRecord(record);

      const upsertCall = mockSpFetch.mock.calls.find(call => call[1]?.method === 'POST');
      const body = JSON.parse(upsertCall![1]!.body as string);
      
      expect(Object.keys(body)).not.toContain('undefined');
      expect(body.RowNo).toBeUndefined();
      expect(body.StaffName).toBeUndefined();
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
});

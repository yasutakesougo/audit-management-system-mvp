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
    // Should include StaffName as filtering was skipped (fallback to full payload)
    expect(body[EXECUTION_RECORD_FIELDS.staffName]).toBe('Staff A');
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
});

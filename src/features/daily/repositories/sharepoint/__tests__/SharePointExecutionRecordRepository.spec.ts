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

    // First call to ensureParentRecord
    mockSpFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [{ Id: 123 }] }),
    });
    
    // Call to getRecord (checks if exists)
    mockSpFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ value: [] }),
    });

    // Final call to createItem (the one we want to check)
    mockSpFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ d: { Id: 456 } }),
    });

    await repo.upsertRecord(record);

    // Verify fields in the POST request to child list
    const createCall = mockSpFetch.mock.calls.find(call => 
      call[0].includes('SupportRecord_DailyRows') && call[1]?.method === 'POST'
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

    mockSpFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ value: [{ Id: 123 }] }),
    });

    await repoNoFields.upsertRecord(record);

    const createCall = mockSpFetch.mock.calls.find(call => 
      call[0].includes('SupportRecord_DailyRows') && call[1]?.method === 'POST'
    );
    
    const body = JSON.parse(createCall![1]!.body as string);
    // Should include StaffName as filtering was skipped
    expect(body[EXECUTION_RECORD_FIELDS.staffName]).toBe('Staff A');
  });
});

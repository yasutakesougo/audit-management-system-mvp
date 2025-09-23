import { describe, it, expect } from 'vitest';
import { summarizeBatchStatuses, selectForRetry, BatchItemStatus } from '@/features/audit/useAuditSyncBatch';

describe('useAuditSyncBatch summarizers', () => {
  it('summarizeBatchStatuses counts success/duplicate/failed', () => {
    const items: BatchItemStatus[] = [
      { id: 'a', status: 201 },
      { id: 'b', status: 201 },
      { id: 'c', status: 409 },
      { id: 'd', status: 500 },
      { id: 'e', status: 429 },
      { id: 'f', status: 201 }
    ];
    const s = summarizeBatchStatuses(items);
    expect(s.total).toBe(6);
    expect(s.success).toBe(4); // 201 x3 + 409 (treated success)
    expect(s.duplicate).toBe(1);
    expect(s.failed).toBe(2); // 500 + 429
  });

  it('selectForRetry returns only non-success and non-409 ids', () => {
    const items: BatchItemStatus[] = [
      { id: 'a', status: 201 },
      { id: 'b', status: 201 },
      { id: 'c', status: 409 },
      { id: 'd', status: 500 },
      { id: 'e', status: 429 },
      { id: 'f', status: 201 }
    ];
    const retryIds = selectForRetry(items);
    expect(retryIds).toEqual(['d', 'e']);
  });
});

import { describe, it, expect } from 'vitest';
import { summarizeBatchStatuses, selectForRetry, BatchItemStatus } from './useAuditSyncBatch';

describe('resend-only-failed logic', () => {
  it('retries only failed, keeps duplicates/existing as non-targets', () => {
    const statuses: BatchItemStatus[] = [
      { id: '1', status: 201 }, // success
      { id: '2', status: 409 }, // duplicate treated as success
      { id: '3', status: 500 }, // failed
      { id: '4', status: 503 }, // failed (transient)
    ];
    const summary = summarizeBatchStatuses(statuses);
    expect(summary.success).toBe(2); // 201 + 409
    expect(summary.duplicate).toBe(1);
    expect(summary.failed).toBe(2);
    expect(summary.total).toBe(4);

    const retryIds = selectForRetry(statuses);
    expect(retryIds).toEqual(['3', '4']);
  });

  it('when all succeed, retry list is empty', () => {
    const statuses: BatchItemStatus[] = ['1','2','3'].map(id => ({ id, status: 201 }));
    expect(selectForRetry(statuses)).toEqual([]);
    const summary = summarizeBatchStatuses(statuses);
    expect(summary.success).toBe(3);
    expect(summary.failed).toBe(0);
    expect(summary.duplicate).toBe(0);
  });

  it('counts only 409 as duplicate', () => {
    const statuses: BatchItemStatus[] = [
      { id: 'a', status: 409 },
      { id: 'b', status: 409 },
      { id: 'c', status: 200 },
      { id: 'd', status: 404 },
    ];
    const summary = summarizeBatchStatuses(statuses);
    expect(summary.success).toBe(3); // 409 + 409 + 200
    expect(summary.duplicate).toBe(2);
    expect(summary.failed).toBe(1); // 404
    expect(selectForRetry(statuses)).toEqual(['d']);
  });
});

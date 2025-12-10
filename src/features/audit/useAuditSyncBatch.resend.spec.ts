import { describe, expect, it } from 'vitest';
import { BatchItemStatus, selectForRetry, summarizeBatchStatuses } from './useAuditSyncBatch';

/**
 * Tests for batch status summarization and retry selection logic
 *
 * Status Code Classification:
 * - 200-299: Success
 * - 409: Duplicate (counted as success + duplicate)
 * - Others: Failed (eligible for retry)
 *
 * Key Behaviors:
 * - summarizeBatchStatuses: Counts success, duplicate, failed, total
 * - selectForRetry: Returns IDs of failed items only (excludes 2xx and 409)
 */

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

  it('handles empty statuses array', () => {
    const summary = summarizeBatchStatuses([]);
    expect(summary).toEqual({ success: 0, duplicate: 0, failed: 0, total: 0 });
    expect(selectForRetry([])).toEqual([]);
  });

  it('tests boundary status codes', () => {
    const statuses: BatchItemStatus[] = [
      { id: 'boundary1', status: 199 }, // failed (< 200)
      { id: 'boundary2', status: 200 }, // success (>= 200)
      { id: 'boundary3', status: 299 }, // success (< 300)
      { id: 'boundary4', status: 300 }, // failed (>= 300)
      { id: 'boundary5', status: 409 }, // duplicate + success
    ];
    const summary = summarizeBatchStatuses(statuses);
    expect(summary.success).toBe(3); // 200 + 299 + 409
    expect(summary.duplicate).toBe(1); // 409
    expect(summary.failed).toBe(2); // 199 + 300
    expect(summary.total).toBe(5);

    const retryIds = selectForRetry(statuses);
    expect(retryIds).toEqual(['boundary1', 'boundary4']);
  });
});

import {
    createEmptyRecord,
    EXECUTION_RECORD_KEY,
} from '@/features/daily/domain/executionRecordTypes';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    __flushPersist,
    __resetStore,
    useExecutionStore,
} from '../executionStore';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('executionStore', () => {
  beforeEach(() => {
    localStorage.removeItem(EXECUTION_RECORD_KEY);
    __resetStore();
  });

  afterEach(() => {
    localStorage.removeItem(EXECUTION_RECORD_KEY);
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // getRecords
  // -----------------------------------------------------------------------

  it('returns empty array for unknown date/user', () => {
    const { result } = renderHook(() => useExecutionStore());
    expect(result.current.getRecords('2025-04-01', 'I001')).toEqual([]);
  });

  // -----------------------------------------------------------------------
  // upsertRecord (insert)
  // -----------------------------------------------------------------------

  it('inserts a new record', () => {
    const { result } = renderHook(() => useExecutionStore());
    const record = {
      ...createEmptyRecord('2025-04-01', 'I001', 'base-0900'),
      status: 'completed' as const,
      recordedAt: '2025-04-01T10:00:00Z',
    };

    act(() => {
      result.current.upsertRecord(record);
    });

    const records = result.current.getRecords('2025-04-01', 'I001');
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('completed');
  });

  // -----------------------------------------------------------------------
  // upsertRecord (update)
  // -----------------------------------------------------------------------

  it('updates an existing record by scheduleItemId', () => {
    const { result } = renderHook(() => useExecutionStore());
    const record = {
      ...createEmptyRecord('2025-04-01', 'I001', 'base-0900'),
      status: 'completed' as const,
      recordedAt: '2025-04-01T10:00:00Z',
    };

    act(() => {
      result.current.upsertRecord(record);
    });

    // Update to triggered
    act(() => {
      result.current.upsertRecord({
        ...record,
        status: 'triggered',
        triggeredBipIds: ['bip-1'],
        memo: 'パニック発生',
      });
    });

    const records = result.current.getRecords('2025-04-01', 'I001');
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe('triggered');
    expect(records[0].triggeredBipIds).toEqual(['bip-1']);
    expect(records[0].memo).toBe('パニック発生');
  });

  // -----------------------------------------------------------------------
  // getRecord (single)
  // -----------------------------------------------------------------------

  it('gets a single record by scheduleItemId', () => {
    const { result } = renderHook(() => useExecutionStore());
    const record = {
      ...createEmptyRecord('2025-04-01', 'I001', 'base-0900'),
      status: 'completed' as const,
      recordedAt: '2025-04-01T10:00:00Z',
    };

    act(() => {
      result.current.upsertRecord(record);
    });

    const found = result.current.getRecord('2025-04-01', 'I001', 'base-0900');
    expect(found?.status).toBe('completed');

    const notFound = result.current.getRecord('2025-04-01', 'I001', 'nonexistent');
    expect(notFound).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // getCompletionRate
  // -----------------------------------------------------------------------

  it('calculates completion rate correctly', () => {
    const { result } = renderHook(() => useExecutionStore());

    act(() => {
      result.current.upsertRecord({
        ...createEmptyRecord('2025-04-01', 'I001', 'slot-1'),
        status: 'completed',
        recordedAt: new Date().toISOString(),
      });
    });
    act(() => {
      result.current.upsertRecord({
        ...createEmptyRecord('2025-04-01', 'I001', 'slot-2'),
        status: 'triggered',
        triggeredBipIds: ['bip-1'],
        recordedAt: new Date().toISOString(),
      });
    });
    act(() => {
      result.current.upsertRecord({
        ...createEmptyRecord('2025-04-01', 'I001', 'slot-3'),
        status: 'skipped',
        recordedAt: new Date().toISOString(),
      });
    });

    const rate = result.current.getCompletionRate('2025-04-01', 'I001', 5);
    expect(rate.completed).toBe(1);
    expect(rate.triggered).toBe(1);
    expect(rate.rate).toBeCloseTo(3 / 5); // 3 recorded out of 5 total slots
  });

  it('returns 0 rate when totalSlots is 0', () => {
    const { result } = renderHook(() => useExecutionStore());
    const rate = result.current.getCompletionRate('2025-04-01', 'I001', 0);
    expect(rate.rate).toBe(0);
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  it('persists to localStorage after flush', () => {
    const { result } = renderHook(() => useExecutionStore());
    const record = {
      ...createEmptyRecord('2025-04-01', 'I001', 'base-0900'),
      status: 'completed' as const,
      recordedAt: '2025-04-01T10:00:00Z',
    };

    act(() => {
      result.current.upsertRecord(record);
    });

    __flushPersist();

    const raw = localStorage.getItem(EXECUTION_RECORD_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(1);
    expect(Object.keys(parsed.data)).toHaveLength(1);
  });

  it('recovers from corrupted localStorage', () => {
    localStorage.setItem(EXECUTION_RECORD_KEY, 'corrupted-data');
    __resetStore();

    const { result } = renderHook(() => useExecutionStore());
    expect(result.current.getRecords('2025-04-01', 'I001')).toEqual([]);
  });
});

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionRecord } from '../../domain/executionRecordTypes';
import { useExecutionRecord } from '../useExecutionRecord';

type GetRecordFn = (...args: unknown[]) => Promise<ExecutionRecord | undefined>;
type WriteRecordFn = (...args: unknown[]) => Promise<void>;

const mockGetRecord = vi.fn<GetRecordFn>();
const mockUpsertRecord = vi.fn<WriteRecordFn>();
const mockDeleteRecord = vi.fn<WriteRecordFn>();

let getRecordRefChanger: GetRecordFn = mockGetRecord;
let upsertRecordRefChanger: WriteRecordFn = mockUpsertRecord;
let deleteRecordRefChanger: WriteRecordFn = mockDeleteRecord;

vi.mock('../useExecutionData', () => ({
  useExecutionData: () => ({
    getRecord: (...args: unknown[]) => getRecordRefChanger(...args),
    upsertRecord: (...args: unknown[]) => upsertRecordRefChanger(...args),
    deleteRecord: (...args: unknown[]) => deleteRecordRefChanger(...args),
  }),
}));

const legacyRecord: ExecutionRecord = {
  id: '2026-05-07-legacy-user-legacy-slot',
  date: '2026-05-07',
  userId: 'legacy-user',
  scheduleItemId: 'legacy-slot',
  status: 'completed',
  triggeredBipIds: [],
  memo: 'old memo',
  recordedBy: 'Staff A',
  recordedAt: '2026-05-07T09:00:00.000Z',
};

describe('useExecutionRecord', () => {
  const fallbackScheduleItemIds = ['legacy-slot'];
  const fallbackUserIds = ['legacy-user'];

  beforeEach(() => {
    mockGetRecord.mockReset();
    mockUpsertRecord.mockReset();
    mockDeleteRecord.mockReset();
    mockUpsertRecord.mockResolvedValue(undefined);
    mockDeleteRecord.mockResolvedValue(undefined);
    getRecordRefChanger = mockGetRecord;
    upsertRecordRefChanger = mockUpsertRecord;
    deleteRecordRefChanger = mockDeleteRecord;
  });

  it('updates the concrete record key found through fallback lookup', async () => {
    mockGetRecord.mockImplementation(async (_date, userId, scheduleItemId) => {
      if (userId === 'legacy-user' && scheduleItemId === 'legacy-slot') {
        return legacyRecord;
      }
      return undefined;
    });

    const { result } = renderHook(() =>
      useExecutionRecord(
        '2026-05-07',
        'canonical-user',
        'canonical-slot',
        fallbackScheduleItemIds,
        fallbackUserIds,
      ),
    );

    await waitFor(() => {
      expect(result.current.record).toEqual(legacyRecord);
    });

    await act(async () => {
      await result.current.saveRecord('completed', 'new memo');
    });

    expect(mockUpsertRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: legacyRecord.id,
        date: legacyRecord.date,
        userId: legacyRecord.userId,
        scheduleItemId: legacyRecord.scheduleItemId,
        memo: 'new memo',
      }),
      { memoMode: 'overwrite' },
    );
  });

  it('deletes the concrete record key found through fallback lookup', async () => {
    mockGetRecord.mockImplementation(async (_date, userId, scheduleItemId) => {
      if (userId === 'legacy-user' && scheduleItemId === 'legacy-slot') {
        return legacyRecord;
      }
      return undefined;
    });

    const { result } = renderHook(() =>
      useExecutionRecord(
        '2026-05-07',
        'canonical-user',
        'canonical-slot',
        fallbackScheduleItemIds,
        fallbackUserIds,
      ),
    );

    await waitFor(() => {
      expect(result.current.record).toEqual(legacyRecord);
    });

    await act(async () => {
      await result.current.deleteRecord();
    });

    expect(mockDeleteRecord).toHaveBeenCalledWith('2026-05-07', 'legacy-user', 'legacy-slot');
  });

  it('does not re-fetch when new arrays with identical values are passed for fallbacks', async () => {
    mockGetRecord.mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ fallbackSchedules, fallbackUsers }) =>
        useExecutionRecord('2026-05-07', 'user-1', 'slot-1', fallbackSchedules, fallbackUsers),
      {
        initialProps: {
          fallbackSchedules: ['slot-2'],
          fallbackUsers: ['user-2'],
        },
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(mockGetRecord).toHaveBeenCalledTimes(4); // 2 users * 2 slots
    mockGetRecord.mockClear();

    // Rerender with new array instances containing identical values
    rerender({
      fallbackSchedules: ['slot-2'],
      fallbackUsers: ['user-2'],
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockGetRecord).not.toHaveBeenCalled();
  });

  it('does not trigger infinite fetch loop when function references from useExecutionData change', async () => {
    mockGetRecord.mockResolvedValue(undefined);

    const { result, rerender } = renderHook(() =>
      useExecutionRecord('2026-05-07', 'user-1', 'slot-1', ['slot-2'], ['user-2']),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(mockGetRecord).toHaveBeenCalledTimes(4);
    mockGetRecord.mockClear();

    // Force hook to get new function wrapper instances by triggering rerender
    getRecordRefChanger = (...args: unknown[]) => mockGetRecord(...args);
    upsertRecordRefChanger = (...args: unknown[]) => mockUpsertRecord(...args);
    deleteRecordRefChanger = (...args: unknown[]) => mockDeleteRecord(...args);
    rerender();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockGetRecord).not.toHaveBeenCalled();
  });

  it('discards stale fetch results if parameters change mid-flight', async () => {
    let resolveFirstFetch: (value: ExecutionRecord | undefined) => void = () => {};
    const firstFetchPromise = new Promise<ExecutionRecord | undefined>((resolve) => {
      resolveFirstFetch = resolve;
    });

    mockGetRecord.mockImplementation(async (date, userId, scheduleItemId) => {
      if (userId === 'user-1' && scheduleItemId === 'slot-1') {
        return firstFetchPromise;
      }
      if (userId === 'user-2' && scheduleItemId === 'slot-2') {
        return {
          id: 'record-2',
          date: '2026-05-07',
          userId: 'user-2',
          scheduleItemId: 'slot-2',
          status: 'completed',
          triggeredBipIds: [],
          memo: 'second memo',
          recordedBy: 'Staff A',
          recordedAt: '2026-05-07T09:00:00.000Z',
        };
      }
      return undefined;
    });

    const { result, rerender } = renderHook(
      ({ userId, scheduleItemId }) =>
        useExecutionRecord('2026-05-07', userId, scheduleItemId),
      {
        initialProps: { userId: 'user-1', scheduleItemId: 'slot-1' },
      },
    );

    // Props change mid-flight
    rerender({ userId: 'user-2', scheduleItemId: 'slot-2' });

    await waitFor(() => {
      expect(result.current.record?.id).toBe('record-2');
    });

    // Resolve the first fetch
    resolveFirstFetch({
      id: 'record-1',
      date: '2026-05-07',
      userId: 'user-1',
      scheduleItemId: 'slot-1',
      status: 'completed',
      triggeredBipIds: [],
      memo: 'first memo',
      recordedBy: 'Staff A',
      recordedAt: '2026-05-07T09:00:00.000Z',
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.record?.id).toBe('record-2');
  });

  it('clears record and increments sequence when parameters become empty mid-flight', async () => {
    let resolveFirstFetch: (value: ExecutionRecord | undefined) => void = () => {};
    const firstFetchPromise = new Promise<ExecutionRecord | undefined>((resolve) => {
      resolveFirstFetch = resolve;
    });

    mockGetRecord.mockImplementation(async (date, userId, scheduleItemId) => {
      if (userId === 'user-1' && scheduleItemId === 'slot-1') {
        return firstFetchPromise;
      }
      return undefined;
    });

    const { result, rerender } = renderHook(
      ({ userId, scheduleItemId }) =>
        useExecutionRecord('2026-05-07', userId, scheduleItemId),
      {
        initialProps: { userId: 'user-1', scheduleItemId: 'slot-1' },
      },
    );

    // Empty parameters mid-flight
    rerender({ userId: '', scheduleItemId: '' });

    expect(result.current.record).toBeUndefined();
    expect(result.current.isLoading).toBe(false);

    resolveFirstFetch({
      id: 'record-1',
      date: '2026-05-07',
      userId: 'user-1',
      scheduleItemId: 'slot-1',
      status: 'completed',
      triggeredBipIds: [],
      memo: 'first memo',
      recordedBy: 'Staff A',
      recordedAt: '2026-05-07T09:00:00.000Z',
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.record).toBeUndefined();
  });

  it('sets error and sets isLoading to false when getRecord rejects, without infinite looping', async () => {
    const errorInstance = new Error('Database connection failed');
    mockGetRecord.mockRejectedValue(errorInstance);

    const { result } = renderHook(() =>
      useExecutionRecord('2026-05-07', 'user-1', 'slot-1'),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBe(errorInstance);
    expect(mockGetRecord).toHaveBeenCalledTimes(1);

    mockGetRecord.mockClear();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockGetRecord).not.toHaveBeenCalled();
  });
});

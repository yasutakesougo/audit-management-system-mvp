import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionRecord } from '../../domain/executionRecordTypes';
import type { ExecutionCandidateClassification } from '../../domain/ExecutionRecordRepository';
import { EXECUTION_POST_SAVE_CHECK_FAILED, useExecutionRecord } from '../useExecutionRecord';

type GetRecordFn = (...args: unknown[]) => Promise<ExecutionRecord | undefined>;
type WriteRecordFn = (...args: unknown[]) => Promise<void>;

const mockGetRecord = vi.fn<GetRecordFn>();
const mockUpsertRecord = vi.fn<WriteRecordFn>();
const mockDeleteRecord = vi.fn<WriteRecordFn>();

let getRecordRefChanger: GetRecordFn = mockGetRecord;
let upsertRecordRefChanger: WriteRecordFn = mockUpsertRecord;
let deleteRecordRefChanger: WriteRecordFn = mockDeleteRecord;
type BatchedLookup = (
  date: string,
  userIds: readonly string[],
  scheduleItemIds: readonly string[],
) => Promise<ExecutionRecord | undefined>;
let batchedLookup: BatchedLookup | undefined;
type ClassifyLookup = (
  date: string,
  userIds: readonly string[],
  scheduleItemIds: readonly string[],
) => Promise<ExecutionCandidateClassification>;
let classifyLookup: ClassifyLookup | undefined;

vi.mock('../useExecutionData', () => ({
  useExecutionData: () => ({
    getRecord: (...args: unknown[]) => getRecordRefChanger(...args),
    upsertRecord: (...args: unknown[]) => upsertRecordRefChanger(...args),
    deleteRecord: (...args: unknown[]) => deleteRecordRefChanger(...args),
    getRecordForCandidates: batchedLookup,
    classifyExecutionCandidates: classifyLookup,
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
    batchedLookup = undefined;
    classifyLookup = undefined;
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
      expect.objectContaining({
        memoMode: 'overwrite',
        candidateUserIds: ['canonical-user', 'legacy-user'],
      }),
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

    expect(mockDeleteRecord).toHaveBeenCalledWith(
      '2026-05-07',
      'legacy-user',
      'legacy-slot',
      {
        candidateUserIds: ['canonical-user', 'legacy-user'],
      },
    );
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

  it('continues fallback candidates when an earlier getRecord rejects', async () => {
    mockGetRecord.mockImplementation(async (_date, userId, scheduleItemId) => {
      if (userId === 'canonical-user' && scheduleItemId === 'canonical-slot') {
        throw new Error('List View Threshold');
      }
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
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.record).toEqual(legacyRecord);
  });

  it('keeps fail-closed error when every candidate getRecord rejects', async () => {
    mockGetRecord.mockRejectedValue(new Error('List View Threshold'));

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
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.record).toBeUndefined();
    expect(result.current.error).toEqual(expect.objectContaining({ message: 'List View Threshold' }));
    expect(mockGetRecord.mock.calls.length).toBeGreaterThan(1);
  });

  it('keeps an unresolved lookup error when later candidates return no record', async () => {
    mockGetRecord.mockRejectedValueOnce(new Error('Unconfirmed canonical lookup'));
    mockGetRecord.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useExecutionRecord(
        '2026-05-07',
        'canonical-user',
        'canonical-slot',
        fallbackScheduleItemIds,
        fallbackUserIds,
      ),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.record).toBeUndefined();
    expect(result.current.error?.message).toBe('Unconfirmed canonical lookup');
  });

  it.each([
    {
      changedField: 'user',
      nextIdentity: { date: '2026-05-07', userId: 'user-2', scheduleItemId: 'slot-1' },
    },
    {
      changedField: 'date',
      nextIdentity: { date: '2026-05-08', userId: 'user-1', scheduleItemId: 'slot-1' },
    },
    {
      changedField: 'procedure',
      nextIdentity: { date: '2026-05-07', userId: 'user-1', scheduleItemId: 'slot-2' },
    },
  ])('rejects stale and pending saves after the $changedField identity changes', async ({ nextIdentity }) => {
    const initialIdentity = { date: '2026-05-07', userId: 'user-1', scheduleItemId: 'slot-1' };
    const initialRecord: ExecutionRecord = {
      id: '2026-05-07-user-1-slot-1',
      ...initialIdentity,
      status: 'completed',
      triggeredBipIds: [],
      memo: 'existing record',
      recordedBy: 'Staff A',
      recordedAt: '2026-05-07T09:00:00.000Z',
    };
    let resolveNextLookup: (record: ExecutionRecord | undefined) => void = () => {};
    const nextLookup = new Promise<ExecutionRecord | undefined>((resolve) => {
      resolveNextLookup = resolve;
    });
    const toLookupKey = (date: unknown, userId: unknown, scheduleItemId: unknown) =>
      `${String(date)}\u0000${String(userId)}\u0000${String(scheduleItemId)}`;
    const initialLookupKey = toLookupKey(
      initialIdentity.date,
      initialIdentity.userId,
      initialIdentity.scheduleItemId,
    );
    const nextLookupKey = toLookupKey(
      nextIdentity.date,
      nextIdentity.userId,
      nextIdentity.scheduleItemId,
    );

    mockGetRecord.mockImplementation(async (date, userId, scheduleItemId) => {
      const key = toLookupKey(date, userId, scheduleItemId);
      if (key === initialLookupKey) return initialRecord;
      if (key === nextLookupKey) return nextLookup;
      return undefined;
    });

    const { result, rerender } = renderHook(
      ({ identity }) => useExecutionRecord(identity.date, identity.userId, identity.scheduleItemId),
      { initialProps: { identity: initialIdentity } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callbackCapturedForInitialIdentity = result.current.saveRecord;

    rerender({ identity: nextIdentity });
    await waitFor(() => expect(result.current.isLoading).toBe(true));

    await expect(callbackCapturedForInitialIdentity('completed', 'stale memo'))
      .rejects.toThrow('Execution record identity is not ready for mutation');
    await expect(result.current.saveRecord('completed', 'early memo'))
      .rejects.toThrow('Execution record identity is not ready for mutation');
    expect(mockUpsertRecord).not.toHaveBeenCalled();

    await act(async () => {
      resolveNextLookup(undefined);
      await nextLookup;
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(callbackCapturedForInitialIdentity('completed', 'late stale memo'))
      .rejects.toThrow('Execution record identity is not ready for mutation');
    expect(mockUpsertRecord).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.saveRecord('completed', 'new identity memo');
    });

    expect(mockUpsertRecord).toHaveBeenCalledTimes(1);
    expect(mockUpsertRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        date: nextIdentity.date,
        userId: nextIdentity.userId,
        scheduleItemId: nextIdentity.scheduleItemId,
        memo: 'new identity memo',
      }),
      expect.objectContaining({ memoMode: 'overwrite' }),
    );
  });

  it('keeps the per-candidate loop when the repository has no batched lookup', async () => {
    mockGetRecord.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useExecutionRecord('2026-05-07', 'user-1', 'slot-1', ['slot-2'], ['user-2']),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.record).toBeUndefined();
    expect(result.current.error).toBeNull();
    expect(mockGetRecord).toHaveBeenCalledTimes(4);
  });

  it('asks the batched lookup once, in candidate order, for twenty users and fifteen procedures', async () => {
    const users = Array.from({ length: 20 }, (_, index) => `person-${String.fromCharCode(97 + index)}`);
    const slots = ['aa', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg', 'hh', 'ii', 'jj', 'kk', 'll', 'mm', 'nn', 'oo'];
    mockGetRecord.mockResolvedValue(undefined);

    const fallbackHook = renderHook(() =>
      useExecutionRecord('2026-05-07', users[0], slots[0], slots.slice(1), users.slice(1)),
    );
    await waitFor(() => expect(fallbackHook.result.current.isLoading).toBe(false));
    expect(mockGetRecord).toHaveBeenCalledTimes(users.length * slots.length);

    fallbackHook.unmount();
    mockGetRecord.mockClear();
    const batch = vi.fn<BatchedLookup>(async () => undefined);
    batchedLookup = batch;

    const batchedHook = renderHook(() =>
      useExecutionRecord('2026-05-07', users[0], slots[0], slots.slice(1), users.slice(1)),
    );
    await waitFor(() => expect(batchedHook.result.current.isLoading).toBe(false));
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0]?.[1]).toEqual(users);
    expect(batch.mock.calls[0]?.[2]).toEqual(slots);
    expect(mockGetRecord).not.toHaveBeenCalled();
    expect(batchedHook.result.current.record).toBeUndefined();
    expect(batchedHook.result.current.error).toBeNull();
  });

  it('keeps a batched failure as an error and refuses save and cancel', async () => {
    const failure = new Error('List View Threshold');
    batchedLookup = async () => {
      throw failure;
    };

    const { result } = renderHook(() =>
      useExecutionRecord('2026-05-07', 'canonical-user', 'canonical-slot', fallbackScheduleItemIds, fallbackUserIds),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.record).toBeUndefined();
    expect(result.current.error).toBe(failure);
    await expect(result.current.saveRecord('completed', 'blocked')).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    await expect(result.current.deleteRecord()).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    expect(mockUpsertRecord).not.toHaveBeenCalled();
    expect(mockDeleteRecord).not.toHaveBeenCalled();
    expect(mockGetRecord).not.toHaveBeenCalled();
  });

  it('exposes AMBIGUOUS_EXECUTION_RECORD on the hook error and blocks save and cancel', async () => {
    const ambiguous = Object.assign(new Error('AMBIGUOUS_EXECUTION_RECORD'), {
      code: 'AMBIGUOUS_EXECUTION_RECORD',
    });
    batchedLookup = async () => {
      throw ambiguous;
    };

    const { result } = renderHook(() =>
      useExecutionRecord('2026-05-07', 'canonical-user', 'canonical-slot'),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.record).toBeUndefined();
    expect(result.current.error).toMatchObject({ code: 'AMBIGUOUS_EXECUTION_RECORD' });
    await expect(result.current.saveRecord('completed', 'blocked')).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    await expect(result.current.deleteRecord()).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    expect(mockUpsertRecord).not.toHaveBeenCalled();
    expect(mockDeleteRecord).not.toHaveBeenCalled();
  });

  it('ignores a stale batched response after the identity changes', async () => {
    let rejectFirst: (error: Error) => void = () => {};
    const first = new Promise<ExecutionRecord | undefined>((_resolve, reject) => {
      rejectFirst = reject;
    });
    batchedLookup = async (_date, userIds) => {
      if (userIds[0] === 'user-1') return first;
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
    };

    const { result, rerender } = renderHook(
      ({ userId, scheduleItemId }) => useExecutionRecord('2026-05-07', userId, scheduleItemId),
      { initialProps: { userId: 'user-1', scheduleItemId: 'slot-1' } },
    );

    rerender({ userId: 'user-2', scheduleItemId: 'slot-2' });
    await waitFor(() => expect(result.current.record?.id).toBe('record-2'));

    rejectFirst(new Error('stale failure'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.record?.id).toBe('record-2');
    expect(result.current.error).toBeNull();
  });

  const savedRecord: ExecutionRecord = {
    id: '2026-05-07-user-1-slot-1',
    date: '2026-05-07',
    userId: 'user-1',
    scheduleItemId: 'slot-1',
    status: 'completed',
    triggeredBipIds: [],
    memo: 'existing record',
    recordedBy: 'Staff A',
    recordedAt: '2026-05-07T09:00:00.000Z',
  };

  it('keeps the loaded record and blocks another save until a recheck classifies a thrown save', async () => {
    let classification: ExecutionCandidateClassification = { kind: 'unique', internalId: 4, record: savedRecord };
    classifyLookup = async () => classification;
    mockUpsertRecord.mockRejectedValueOnce(new Error('save failed'));

    const { result } = renderHook(() => useExecutionRecord('2026-05-07', 'user-1', 'slot-1'));
    await waitFor(() => expect(result.current.record).toEqual(savedRecord));

    await act(async () => {
      await expect(result.current.saveRecord('completed', 'edited')).rejects.toThrow('save failed');
    });
    expect(result.current.record).toEqual(savedRecord);
    expect(result.current.mutationBlocked).toBe(true);
    await expect(result.current.saveRecord('completed', 'edited again')).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    await expect(result.current.deleteRecord()).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    expect(mockUpsertRecord).toHaveBeenCalledTimes(1);
    expect(mockDeleteRecord).not.toHaveBeenCalled();

    classification = { kind: 'absent' };
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.mutationBlocked).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.record).toBeUndefined();
  });

  it('keeps the draft and does not post again when save succeeds but the recheck fails', async () => {
    let calls = 0;
    classifyLookup = async () => {
      calls += 1;
      if (calls === 1) return { kind: 'unique', internalId: 4, record: savedRecord };
      throw new Error('refetch failed');
    };

    const { result } = renderHook(() => useExecutionRecord('2026-05-07', 'user-1', 'slot-1'));
    await waitFor(() => expect(result.current.record).toEqual(savedRecord));

    await act(async () => {
      await expect(result.current.saveRecord('completed', 'edited')).rejects.toMatchObject({
        code: EXECUTION_POST_SAVE_CHECK_FAILED,
      });
    });
    expect(result.current.record).toEqual(savedRecord);
    expect(result.current.mutationBlocked).toBe(true);
    await expect(result.current.saveRecord('completed', 'edited again')).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    expect(mockUpsertRecord).toHaveBeenCalledTimes(1);
  });

  it('does not delete again while a lost delete response is unclassified', async () => {
    let classification: ExecutionCandidateClassification = { kind: 'unique', internalId: 4, record: savedRecord };
    classifyLookup = async () => classification;
    mockDeleteRecord.mockRejectedValueOnce(new Error('delete failed'));

    const { result } = renderHook(() => useExecutionRecord('2026-05-07', 'user-1', 'slot-1'));
    await waitFor(() => expect(result.current.record).toEqual(savedRecord));

    await act(async () => {
      await expect(result.current.deleteRecord()).rejects.toThrow('delete failed');
    });
    expect(result.current.record).toEqual(savedRecord);
    await expect(result.current.deleteRecord()).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    expect(mockDeleteRecord).toHaveBeenCalledTimes(1);

    classification = { kind: 'absent' };
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.record).toBeUndefined());
    expect(result.current.mutationBlocked).toBe(false);
    expect(mockDeleteRecord).toHaveBeenCalledTimes(1);
  });

  it('keeps a row that is still present after a lost delete and does not delete it again', async () => {
    let phase: 'loaded' | 'still-there' = 'loaded';
    classifyLookup = async () => {
      if (phase === 'still-there') return { kind: 'unique', internalId: 9, record: { ...savedRecord, memo: 'still there' } };
      return { kind: 'unique', internalId: 4, record: savedRecord };
    };
    mockDeleteRecord.mockRejectedValueOnce(new Error('lost response'));

    const { result } = renderHook(() => useExecutionRecord('2026-05-07', 'user-1', 'slot-1'));
    await waitFor(() => expect(result.current.record).toEqual(savedRecord));
    await act(async () => {
      await expect(result.current.deleteRecord()).rejects.toThrow('lost response');
    });

    phase = 'still-there';
    await act(async () => {
      await result.current.refresh();
    });
    await waitFor(() => expect(result.current.record?.memo).toBe('still there'));
    expect(mockDeleteRecord).toHaveBeenCalledTimes(1);
    expect(result.current.mutationBlocked).toBe(false);
  });

  it('blocks save and cancel when the classified row does not match the target', async () => {
    classifyLookup = async () => ({ kind: 'mismatch' });

    const { result } = renderHook(() => useExecutionRecord('2026-05-07', 'user-1', 'slot-1'));
    await waitFor(() => expect(result.current.error).toMatchObject({ code: 'EXECUTION_TARGET_MISMATCH' }));
    await expect(result.current.saveRecord('completed', 'blocked')).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    await expect(result.current.deleteRecord()).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    expect(mockUpsertRecord).not.toHaveBeenCalled();
    expect(mockDeleteRecord).not.toHaveBeenCalled();
  });

  it('does not let a stale save recheck clear a newer target block', async () => {
    let resolveRecheck: (value: ExecutionCandidateClassification) => void = () => {};
    const recheck = new Promise<ExecutionCandidateClassification>((resolve) => {
      resolveRecheck = resolve;
    });
    let userOneCalls = 0;
    classifyLookup = async (_date, userIds) => {
      if (userIds[0] === 'user-2') throw new Error('user-2 blocked');
      userOneCalls += 1;
      if (userOneCalls === 1) return { kind: 'unique', internalId: 4, record: savedRecord };
      return recheck;
    };

    const { result, rerender } = renderHook(
      ({ userId }) => useExecutionRecord('2026-05-07', userId, 'slot-1'),
      { initialProps: { userId: 'user-1' } },
    );
    await waitFor(() => expect(result.current.record).toEqual(savedRecord));

    let saveSettled: Promise<unknown> = Promise.resolve();
    act(() => {
      saveSettled = result.current.saveRecord('completed', 'edited').catch((error: unknown) => error);
    });
    rerender({ userId: 'user-2' });
    await waitFor(() => expect(result.current.error?.message).toBe('user-2 blocked'));

    resolveRecheck({ kind: 'unique', internalId: 4, record: { ...savedRecord, memo: 'edited' } });
    await act(async () => {
      await saveSettled;
    });
    expect(result.current.error?.message).toBe('user-2 blocked');
    expect(result.current.record).toBeUndefined();
    expect(result.current.mutationBlocked).toBe(false);
    await expect(result.current.saveRecord('completed', 'should stay blocked')).rejects.toThrow(
      'Execution record identity is not ready for mutation',
    );
    expect(mockUpsertRecord).toHaveBeenCalledTimes(1);
  });

  it('resolves unique only after a classified unique save and does not advance the settled fetch', async () => {
    classifyLookup = async () => ({ kind: 'unique', internalId: 4, record: savedRecord });
    const { result } = renderHook(() => useExecutionRecord('2026-05-07', 'user-1', 'slot-1'));
    await waitFor(() => expect(result.current.record).toEqual(savedRecord));
    const settledAfterLoad = result.current.settledFetch;
    expect(settledAfterLoad).toEqual({
      seq: result.current.startedFetchSeq,
      identityKey: JSON.stringify(['2026-05-07', 'user-1', 'slot-1', '', '']),
      identityGeneration: 0,
    });
    expect(result.current.identityKey).toBe(settledAfterLoad?.identityKey);
    expect(result.current.identityGeneration).toBe(0);

    let confirmation: Awaited<ReturnType<typeof result.current.saveRecord>> | undefined;
    await act(async () => {
      confirmation = await result.current.saveRecord('completed', 'edited');
    });

    expect(confirmation?.outcome).toBe('unique');
    if (confirmation?.outcome !== 'unique') return;
    expect(confirmation.identityKey).toBe(result.current.identityKey);
    expect(confirmation.generation).toBe(result.current.identityGeneration);
    expect(confirmation.record.memo).toBe('edited');
    expect(result.current.settledFetch).toEqual(settledAfterLoad);
    expect(result.current.startedFetchSeq).toBe(settledAfterLoad?.seq);
    expect(result.current.record?.memo).toBe('edited');
  });

  it('resolves unclassified when the repository has no classifier', async () => {
    mockGetRecord.mockImplementation(async () => savedRecord);
    const { result } = renderHook(() => useExecutionRecord('2026-05-07', 'user-1', 'slot-1'));
    await waitFor(() => expect(result.current.record).toEqual(savedRecord));
    const settledAfterLoad = result.current.settledFetch;
    expect(settledAfterLoad).not.toBeNull();

    let confirmation: Awaited<ReturnType<typeof result.current.saveRecord>> | undefined;
    await act(async () => {
      confirmation = await result.current.saveRecord('completed', 'edited');
    });

    expect(confirmation?.outcome).toBe('unclassified');
    if (confirmation?.outcome !== 'unclassified') return;
    expect(confirmation.identityKey).toBe(result.current.identityKey);
    expect(confirmation.generation).toBe(result.current.identityGeneration);
    expect(confirmation.record.memo).toBe('edited');
    expect(result.current.settledFetch).toEqual(settledAfterLoad);
  });

  it('resolves skipped from setMemo when no record is loaded', async () => {
    mockGetRecord.mockResolvedValue(undefined);
    const { result } = renderHook(() => useExecutionRecord('2026-05-07', 'user-1', 'slot-1'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.record).toBeUndefined();
    expect(result.current.error).toBeNull();

    let confirmation: Awaited<ReturnType<typeof result.current.setMemo>> | undefined;
    await act(async () => {
      confirmation = await result.current.setMemo('unused');
    });
    expect(confirmation).toEqual({ outcome: 'skipped' });
    expect(mockUpsertRecord).not.toHaveBeenCalled();
  });

  it('does not advance settledFetch when a stale response is dropped', async () => {
    let rejectFirst: (error: Error) => void = () => {};
    const first = new Promise<ExecutionRecord | undefined>((_resolve, reject) => {
      rejectFirst = reject;
    });
    batchedLookup = async (_date, userIds) => {
      if (userIds[0] === 'user-1') return first;
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
    };

    const { result, rerender } = renderHook(
      ({ userId, scheduleItemId }) => useExecutionRecord('2026-05-07', userId, scheduleItemId),
      { initialProps: { userId: 'user-1', scheduleItemId: 'slot-1' } },
    );
    rerender({ userId: 'user-2', scheduleItemId: 'slot-2' });
    await waitFor(() => expect(result.current.record?.id).toBe('record-2'));
    const settledSeq = result.current.settledFetch?.seq;
    expect(settledSeq).toBe(result.current.startedFetchSeq);
    expect(result.current.settledFetch?.identityKey).toBe(result.current.identityKey);

    rejectFirst(new Error('stale failure'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.settledFetch?.seq).toBe(settledSeq);
    expect(result.current.record?.id).toBe('record-2');
    expect(result.current.error).toBeNull();
  });

  it('does not publish a settled fetch for the empty-candidate short-circuit', async () => {
    const { result } = renderHook(() => useExecutionRecord('', '', ''));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.startedFetchSeq).toBeGreaterThan(0);
    expect(result.current.settledFetch).toBeNull();
    expect(result.current.record).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it('does not leak new user candidates into inflight deletion when user switches mid-flight', async () => {
    let resolveDelete: () => void = () => {};
    const deletePromise = new Promise<void>((resolve) => {
      resolveDelete = resolve;
    });

    let capturedDeleteArgs: unknown[] = [];
    mockDeleteRecord.mockImplementation(async (...args) => {
      capturedDeleteArgs = args;
      await deletePromise;
    });

    const userARecord: ExecutionRecord = {
      id: 'rec-user-a',
      date: '2026-05-07',
      userId: 'user-A',
      scheduleItemId: 'slot-1',
      status: 'completed',
      triggeredBipIds: [],
    };
    mockGetRecord.mockResolvedValue(userARecord);

    const { result, rerender } = renderHook(
      ({ userId, fallbackUsers }) =>
        useExecutionRecord('2026-05-07', userId, 'slot-1', undefined, fallbackUsers),
      {
        initialProps: {
          userId: 'user-A',
          fallbackUsers: ['user-A-fallback'],
        },
      },
    );

    await waitFor(() => {
      expect(result.current.record?.id).toBe('rec-user-a');
    });

    let deletePromiseResult: Promise<void> | undefined;
    act(() => {
      deletePromiseResult = result.current.deleteRecord();
    });

    rerender({
      userId: 'user-B',
      fallbackUsers: ['user-B-fallback'],
    });

    await act(async () => {
      resolveDelete();
      await expect(deletePromiseResult).rejects.toThrow('Execution record identity is not ready for mutation');
    });

    expect(capturedDeleteArgs).toEqual([
      '2026-05-07',
      'user-A',
      'slot-1',
      {
        candidateUserIds: ['user-A', 'user-A-fallback'],
      },
    ]);

    const passedOptions = capturedDeleteArgs[3] as { candidateUserIds: string[] };
    expect(passedOptions.candidateUserIds).not.toContain('user-B');
    expect(passedOptions.candidateUserIds).not.toContain('user-B-fallback');
  });

  it('preserves whitespace-distinct user candidates through lookup and save', async () => {
    const observedUserCandidates: string[][] = [];
    const paddedRecord: ExecutionRecord = {
      id: '2026-05-07-padded-user-slot-1',
      date: '2026-05-07',
      userId: ' U001 ',
      scheduleItemId: 'slot-1',
      status: 'completed',
      triggeredBipIds: [],
      memo: 'stored',
    };
    let classifyCount = 0;
    classifyLookup = async (_date, userIds) => {
      observedUserCandidates.push([...userIds]);
      classifyCount += 1;
      return classifyCount === 1
        ? { kind: 'absent' }
        : { kind: 'unique', internalId: 901, record: paddedRecord };
    };

    const { result } = renderHook(() =>
      useExecutionRecord('2026-05-07', ' U001 ', 'slot-1', undefined, ['U001', '   ']),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(observedUserCandidates[0]).toEqual([' U001 ', 'U001']);

    await act(async () => {
      await result.current.saveRecord('completed', 'saved');
    });

    expect(mockUpsertRecord).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ' U001 ', memo: 'saved' }),
      expect.objectContaining({
        memoMode: 'overwrite',
        candidateUserIds: [' U001 ', 'U001'],
      }),
    );
    expect(observedUserCandidates).toEqual([
      [' U001 ', 'U001'],
      [' U001 ', 'U001'],
    ]);
  });

  it('keeps save candidates captured when the target switches during an upsert', async () => {
    let resolveUpsert: () => void = () => {};
    const upsertPromise = new Promise<void>((resolve) => {
      resolveUpsert = resolve;
    });
    let capturedUpsertArgs: unknown[] = [];
    mockUpsertRecord.mockImplementation(async (...args) => {
      capturedUpsertArgs = args;
      await upsertPromise;
    });

    const userARecord: ExecutionRecord = {
      id: 'record-user-A',
      date: '2026-05-07',
      userId: 'user-A',
      scheduleItemId: 'slot-1',
      status: 'completed',
      triggeredBipIds: [],
    };
    classifyLookup = async (_date, userIds) =>
      userIds[0] === 'user-A'
        ? { kind: 'unique', internalId: 901, record: userARecord }
        : { kind: 'absent' };

    const { result, rerender } = renderHook(
      ({ userId, fallbackUsers }) =>
        useExecutionRecord('2026-05-07', userId, 'slot-1', undefined, fallbackUsers),
      { initialProps: { userId: 'user-A', fallbackUsers: ['user-A-item'] } },
    );
    await waitFor(() => expect(result.current.record?.id).toBe('record-user-A'));

    let savePromise: Promise<unknown> = Promise.resolve();
    act(() => {
      savePromise = result.current.saveRecord('completed', 'edited');
    });
    rerender({ userId: 'user-B', fallbackUsers: ['user-B-item'] });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const capturedOptions = capturedUpsertArgs[1] as {
      memoMode: string;
      candidateUserIds: string[];
    };
    expect(capturedOptions).toEqual({
      memoMode: 'overwrite',
      candidateUserIds: ['user-A', 'user-A-item'],
    });

    resolveUpsert();
    await act(async () => {
      await expect(savePromise).rejects.toThrow('Execution record identity is not ready for mutation');
    });
    expect(capturedOptions.candidateUserIds).not.toContain('user-B');
    expect(capturedOptions.candidateUserIds).not.toContain('user-B-item');
  });
});

import { render, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { useDailyProcedureFlowPreview } from '../useDailyProcedureFlowPreview';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { useProcedureStore } from '@/features/daily/stores/procedureStore';
import { useUser } from '@/features/users/useUsers';
import { useExecutionStore } from '@/features/daily/stores/executionStore';
import type { ExecutionRecord } from '@/features/daily/domain/legacy/executionRecordTypes';

// Mock the hooks
vi.mock('@/features/daily/hooks/useExecutionData', () => ({
  useExecutionData: vi.fn(),
}));

vi.mock('@/features/daily/stores/procedureStore', () => ({
  useProcedureStore: vi.fn(),
}));

vi.mock('@/features/users/useUsers', () => ({
  useUser: vi.fn(),
}));

vi.mock('@/features/daily/stores/executionStore', () => ({
  useExecutionStore: vi.fn(),
}));

describe('useDailyProcedureFlowPreview', () => {
  const mockGetRecords = vi.fn();
  const mockGetByUser = vi.fn();
  const mockGetStoreRecords = vi.fn();
  const mockHasInitializedRecords = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock returns
    vi.mocked(useExecutionData).mockReturnValue({
      getRecords: mockGetRecords,
    } as unknown as ReturnType<typeof useExecutionData>);

    vi.mocked(useProcedureStore).mockReturnValue({
      getByUser: mockGetByUser,
    } as unknown as ReturnType<typeof useProcedureStore>);

    vi.mocked(useUser).mockReturnValue({
      data: { Id: 1, UserID: 'U001' },
      status: 'success',
    } as any);

    vi.mocked(useExecutionStore).mockReturnValue({
      getRecords: mockGetStoreRecords.mockReturnValue([]),
      hasInitializedRecords: mockHasInitializedRecords.mockReturnValue(false),
    } as any);
  });

  it('fetches records, matches them with slots, and returns merged daily steps', async () => {
    const mockSlots = [
      { id: '1', rowNo: 1, time: '09:30', activity: 'Morning Assembly', block: 'morning' },
    ];
    const mockRecords = [
      { date: '2026-05-11', userId: 'U001', scheduleItemId: '1', status: 'completed', memo: 'Participated', recordedAt: '2026-05-11T09:30:00Z', recordedBy: 'Staff X' },
    ];

    mockGetByUser.mockReturnValue(mockSlots);
    mockGetRecords.mockResolvedValue(mockRecords);

    const { result } = renderHook(() => useDailyProcedureFlowPreview('U001', '2026-05-11'));

    // Loading should be true initially
    expect(result.current.isLoading).toBe(true);

    // Wait for async fetch to finish
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0]).toEqual({
      rowNo: 1,
      time: '09:30',
      activity: 'Morning Assembly',
      activityDetail: undefined,
      instructionDetail: undefined,
      isKey: false,
      block: 'morning',
      record: {
        status: 'completed',
        memo: 'Participated',
        recordedAt: '2026-05-11T09:30:00Z',
        recordedBy: 'Staff X',
      },
    });

    expect(mockGetRecords).toHaveBeenCalledWith('2026-05-11', 'U001', ['U001', '1']);
    expect(mockGetByUser).toHaveBeenCalledWith('U001');
  });

  it('handles fetch errors gracefully and populates the error state', async () => {
    mockGetByUser.mockReturnValue([]);
    const fetchError = new Error('SharePoint 500 Failure');
    mockGetRecords.mockRejectedValue(fetchError);

    const { result } = renderHook(() => useDailyProcedureFlowPreview('U001', '2026-05-11'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toEqual(fetchError);
    expect(result.current.steps).toHaveLength(0);
  });

  it('does not expose empty-record steps when the repository reports an identity mismatch', async () => {
    mockGetByUser.mockReturnValue([
      { id: 'procedure-1', rowNo: 1, time: '10:00', activity: 'Training', block: 'morning' },
    ]);
    mockGetRecords.mockRejectedValue(Object.assign(
      new Error('EXECUTION_TARGET_MISMATCH'),
      { code: 'EXECUTION_TARGET_MISMATCH' },
    ));

    const { result } = renderHook(() => useDailyProcedureFlowPreview('U001', '2026-05-11'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error?.message).toBe('EXECUTION_TARGET_MISMATCH');
    expect(result.current.steps).toEqual([]);
  });

  it('reports the resolved target as loading in the first render before its fetch effect', () => {
    mockGetByUser.mockReturnValue([
      { id: 'procedure-1', rowNo: 1, time: '10:00', activity: 'Training', block: 'morning' },
    ]);
    mockGetRecords.mockReturnValue(new Promise(() => {}));
    const firstRenderLoading: boolean[] = [];
    const PreviewProbe = () => {
      const preview = useDailyProcedureFlowPreview('U001', '2026-05-11');
      firstRenderLoading.push(preview.isLoading);
      return null;
    };

    const { unmount } = render(createElement(PreviewProbe));
    expect(firstRenderLoading[0]).toBe(true);
    unmount();
  });

  it('uses the exact resolved master identity and passes its verified candidates', async () => {
    mockGetByUser.mockReturnValue([]);
    mockGetRecords.mockResolvedValue([]);

    // The route must identify the exact master row; padded or aliased route IDs are not identity matches.
    vi.mocked(useUser).mockReturnValue({
      data: { Id: 1, UserID: 'U-001' },
      status: 'success',
    } as any);

    const { result } = renderHook(() => useDailyProcedureFlowPreview('U-001', '2026-05-11'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetRecords).toHaveBeenCalledWith('2026-05-11', 'U-001', ['U-001', '1']);
    expect(mockGetByUser).toHaveBeenCalledWith('U-001');
  });

  it('merges reactive Zustand store records, overwriting stale repository records', async () => {
    const mockSlots = [
      { id: '1', rowNo: 1, time: '09:30', activity: 'Morning Assembly', block: 'morning' },
    ];
    const mockRepositoryRecords = [
      { scheduleItemId: '1', status: 'skipped', memo: 'Old skipped', date: '2026-05-11', userId: 'U001' },
    ];
    const mockStoreRecords = [
      { scheduleItemId: '1', status: 'completed', memo: 'Optimistic completed', date: '2026-05-11', userId: 'U001' },
    ];

    mockGetByUser.mockReturnValue(mockSlots);
    mockGetRecords.mockResolvedValue(mockRepositoryRecords);
    mockGetStoreRecords.mockReturnValue(mockStoreRecords);

    const { result } = renderHook(() => useDailyProcedureFlowPreview('U001', '2026-05-11'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].record).toEqual(expect.objectContaining({
      status: 'completed',
      memo: 'Optimistic completed',
    }));
  });

  it('does not revive stale repository records after the store initialized an empty user/date', async () => {
    const mockSlots = [
      { id: '1', rowNo: 1, time: '09:30', activity: 'Morning Assembly', block: 'morning' },
    ];
    const mockRepositoryRecords = [
      { scheduleItemId: '1', status: 'completed', memo: 'Deleted on client', date: '2026-05-11', userId: 'U001' },
    ];

    mockGetByUser.mockReturnValue(mockSlots);
    mockGetRecords.mockResolvedValue(mockRepositoryRecords);
    mockGetStoreRecords.mockReturnValue([]);
    mockHasInitializedRecords.mockReturnValue(true);

    const { result } = renderHook(() => useDailyProcedureFlowPreview('U001', '2026-05-11'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].record).toBeUndefined();
  });

  it('uses seeded history records when daily record fetch returns empty', async () => {
    const mockSlots = [
      { id: 'base-1', rowNo: 1, time: '09:30', activity: 'Morning Assembly', block: 'morning' },
    ];
    const seedRecords: ExecutionRecord[] = [
      {
        id: 'R-seed',
        date: '2026-05-22',
        userId: '6',
        scheduleItemId: 'procedure-1',
        status: 'completed',
        memo: 'History record memo',
        recordedAt: '2026-05-22T09:35:00Z',
        recordedBy: 'Staff Seed',
        triggeredBipIds: [],
      },
    ];

    mockGetByUser.mockReturnValue(mockSlots);
    mockGetRecords.mockResolvedValue([]);
    mockGetStoreRecords.mockReturnValue([]);
    vi.mocked(useUser).mockReturnValue({
      data: { Id: 6, UserID: '6' },
      status: 'success',
    } as any);

    const { result } = renderHook(() => (
      useDailyProcedureFlowPreview('6', '2026-05-22', seedRecords)
    ));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.steps).toHaveLength(1);
    expect(result.current.steps[0].record).toEqual(expect.objectContaining({
      status: 'completed',
      memo: 'History record memo',
      recordedBy: 'Staff Seed',
    }));
  });

  it('does not adopt or display misleading cache when master lookup is delayed/unresolved', async () => {
    // Setup misleading cache for raw URL id '6' in the Zustand store
    const misleadingCacheRecord: ExecutionRecord = {
      id: 'cache-misleading-6',
      date: '2026-10-24',
      userId: '6',
      scheduleItemId: 'procedure-1',
      status: 'completed',
      memo: 'Misleading cache from another user or raw id',
      recordedAt: '2026-10-24T10:00:00Z',
      recordedBy: 'Staff Other',
      triggeredBipIds: [],
    };
    mockGetStoreRecords.mockImplementation((_date: string, requestedUserId: string) => {
      if (requestedUserId === '6') {
        return [misleadingCacheRecord];
      }
      return [];
    });

    // Initially master lookup is unresolved / loading
    let currentMasterUser: any = { data: undefined, status: 'loading' };
    vi.mocked(useUser).mockImplementation(() => currentMasterUser);

    mockGetByUser.mockReturnValue([
      { id: 'procedure-1', rowNo: 1, time: '10:00', activity: 'Training', block: 'morning' },
    ]);
    mockGetRecords.mockResolvedValue([]);

    const { result, rerender } = renderHook(
      ({ userId, date }) => useDailyProcedureFlowPreview(userId, date),
      {
        initialProps: { userId: '6', date: '2026-10-24' },
      },
    );

    // While master is unresolved, records must be unknown (isLoading: true, steps: empty)
    expect(result.current.isLoading).toBe(true);
    expect(result.current.steps).toHaveLength(0);
    const initialStepsRef = result.current.steps;

    // Rerender while still unresolved: reference should remain stable
    rerender({ userId: '6', date: '2026-10-24' });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.steps).toBe(initialStepsRef); // Stable reference check
    // Ensure getStoreRecords was NEVER queried with raw '6' while master is unresolved
    expect(mockGetStoreRecords).not.toHaveBeenCalledWith('2026-10-24', '6');

    // Now master lookup resolves with canonical UserID 'I005'
    currentMasterUser = {
      data: { Id: 6, UserID: 'I005' },
      status: 'success',
    };
    rerender({ userId: '6', date: '2026-10-24' });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Now that master is resolved, getByUser is called with canonical UserID 'I005'
    expect(mockGetByUser).toHaveBeenCalledWith('I005');
  });

  it('drops prior-user seed and delayed repository responses after switching the resolved user', async () => {
    const slot = { id: 'procedure-1', rowNo: 1, time: '10:00', activity: 'Training', block: 'morning' };
    const recordForA: ExecutionRecord = {
      id: 'record-a', date: '2026-10-24', userId: 'U001', scheduleItemId: 'procedure-1',
      status: 'completed', memo: 'User A record', triggeredBipIds: [],
    };
    const recordForB: ExecutionRecord = {
      id: 'record-b', date: '2026-10-24', userId: 'U002', scheduleItemId: 'procedure-1',
      status: 'completed', memo: 'User B record', triggeredBipIds: [],
    };
    let resolveA!: (records: ExecutionRecord[]) => void;
    let resolveB!: (records: ExecutionRecord[]) => void;
    const delayedA = new Promise<ExecutionRecord[]>((resolve) => { resolveA = resolve; });
    const delayedB = new Promise<ExecutionRecord[]>((resolve) => { resolveB = resolve; });
    mockGetByUser.mockReturnValue([slot]);
    mockGetStoreRecords.mockReturnValue([recordForA]);
    mockHasInitializedRecords.mockReturnValue(false);
    mockGetRecords.mockImplementation((_date: string, userId: string) => (
      userId === 'U001' ? delayedA : delayedB
    ));
    vi.mocked(useUser).mockImplementation((id) => (
      String(id) === '1'
        ? { data: { Id: 1, UserID: 'U001' }, status: 'success' } as any
        : { data: { Id: 2, UserID: 'U002' }, status: 'success' } as any
    ));

    const { result, rerender } = renderHook(
      ({ userId, seeds }) => useDailyProcedureFlowPreview(userId, '2026-10-24', seeds),
      { initialProps: { userId: '1', seeds: [recordForA] } },
    );
    await waitFor(() => expect(mockGetRecords).toHaveBeenCalledWith('2026-10-24', 'U001', ['U001', '1']));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.steps).toEqual([]);

    rerender({ userId: '2', seeds: [recordForA] });
    await waitFor(() => expect(mockGetRecords).toHaveBeenCalledWith('2026-10-24', 'U002', ['U002', '2']));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.steps[0]?.record).toBeUndefined();

    resolveB([recordForB]);
    await waitFor(() => expect(result.current.steps[0]?.record?.memo).toBe('User B record'));
    resolveA([recordForA]);
    await waitFor(() => expect(result.current.steps[0]?.record?.memo).toBe('User B record'));
  });
});

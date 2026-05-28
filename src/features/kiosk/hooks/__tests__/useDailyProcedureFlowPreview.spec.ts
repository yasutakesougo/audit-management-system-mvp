import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDailyProcedureFlowPreview } from '../useDailyProcedureFlowPreview';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { useProcedureStore } from '@/features/daily/stores/procedureStore';
import { useUser } from '@/features/users/useUsers';
import { useExecutionStore } from '@/features/daily/stores/executionStore';

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
      data: undefined,
      status: 'idle',
    } as any);

    vi.mocked(useExecutionStore).mockReturnValue({
      getRecords: mockGetStoreRecords.mockReturnValue([]),
    } as any);
  });

  it('fetches records, matches them with slots, and returns merged daily steps', async () => {
    const mockSlots = [
      { id: '1', rowNo: 1, time: '09:30', activity: 'Morning Assembly', block: 'morning' },
    ];
    const mockRecords = [
      { scheduleItemId: '1', status: 'completed', memo: 'Participated', recordedAt: '2026-05-11T09:30:00Z', recordedBy: 'Staff X' },
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

    expect(mockGetRecords).toHaveBeenCalledWith('2026-05-11', 'U001');
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

  it('uses resolveProcedureUserQueryCandidates to resolve user ID consistently', async () => {
    mockGetByUser.mockReturnValue([]);
    mockGetRecords.mockResolvedValue([]);

    // We pass U001 but mock useUser to return U-001 (canonical UserID)
    vi.mocked(useUser).mockReturnValue({
      data: { UserID: 'U-001' },
      status: 'success',
    } as any);

    const { result } = renderHook(() => useDailyProcedureFlowPreview('U001', '2026-05-11'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // U-001 should be queried instead of raw U001
    expect(mockGetRecords).toHaveBeenCalledWith('2026-05-11', 'U-001');
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
});

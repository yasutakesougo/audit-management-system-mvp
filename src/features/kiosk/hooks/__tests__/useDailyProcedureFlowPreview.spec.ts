import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDailyProcedureFlowPreview } from '../useDailyProcedureFlowPreview';
import { useExecutionData } from '@/features/daily/hooks/useExecutionData';
import { useProcedureStore } from '@/features/daily/stores/procedureStore';

// Mock the hooks
vi.mock('@/features/daily/hooks/useExecutionData', () => ({
  useExecutionData: vi.fn(),
}));

vi.mock('@/features/daily/stores/procedureStore', () => ({
  useProcedureStore: vi.fn(),
}));

describe('useDailyProcedureFlowPreview', () => {
  const mockGetRecords = vi.fn();
  const mockGetByUser = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock returns
    vi.mocked(useExecutionData).mockReturnValue({
      getRecords: mockGetRecords,
    } as unknown as ReturnType<typeof useExecutionData>);

    vi.mocked(useProcedureStore).mockReturnValue({
      getByUser: mockGetByUser,
    } as unknown as ReturnType<typeof useProcedureStore>);
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
});

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionRecord } from '../../domain/executionRecordTypes';
import { useExecutionRecord } from '../useExecutionRecord';

const mockGetRecord = vi.fn<(...args: unknown[]) => Promise<ExecutionRecord | undefined>>();
const mockUpsertRecord = vi.fn<(...args: unknown[]) => Promise<void>>();
const mockDeleteRecord = vi.fn<(...args: unknown[]) => Promise<void>>();

vi.mock('../useExecutionData', () => ({
  useExecutionData: () => ({
    getRecord: mockGetRecord,
    upsertRecord: mockUpsertRecord,
    deleteRecord: mockDeleteRecord,
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
});

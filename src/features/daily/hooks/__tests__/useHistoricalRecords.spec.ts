import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useHistoricalRecords } from '../useHistoricalRecords';
import type { ExecutionRecord } from '../../domain/legacy/executionRecordTypes';

const mockGetHistoricalRecords = vi.fn<(...args: unknown[]) => Promise<ExecutionRecord[]>>();
const mockGetRecordsInRange = vi.fn<(...args: unknown[]) => Promise<ExecutionRecord[]>>();

vi.mock('../useExecutionData', () => ({
  useExecutionData: () => ({
    getHistoricalRecords: mockGetHistoricalRecords,
    getRecordsInRange: mockGetRecordsInRange,
  }),
}));

const record = (id: string, date: string, scheduleItemId: string): ExecutionRecord => ({
  id,
  date,
  userId: 'U001',
  scheduleItemId,
  status: 'completed',
  triggeredBipIds: [],
  memo: '',
  recordedBy: '',
  recordedAt: `${date}T09:00:00.000Z`,
});

describe('useHistoricalRecords', () => {
  beforeEach(() => {
    mockGetHistoricalRecords.mockReset();
    mockGetRecordsInRange.mockReset();
    mockGetRecordsInRange.mockResolvedValue([]);
  });

  it('merges results across schedule candidates instead of stopping at first hit', async () => {
    mockGetHistoricalRecords.mockImplementation(async (_userId, scheduleItemId) => {
      if (scheduleItemId === '0') return [record('r-2026-05-13', '2026-05-13', '0')];
      if (scheduleItemId === '1') return [record('r-2026-05-10', '2026-05-10', '1')];
      return [];
    });

    const scheduleFallbackIds = ['1'];
    const fallbackUserIds: string[] = [];
    const { result } = renderHook(() =>
      useHistoricalRecords('U001', '0', scheduleFallbackIds, fallbackUserIds),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.records.map((r) => r.id)).toEqual(['r-2026-05-13', 'r-2026-05-10']);
  });

  it('backfills from range query even when primary history already has hits', async () => {
    mockGetHistoricalRecords.mockResolvedValue([
      record('r-2026-05-13', '2026-05-13', '1'),
      record('r-2026-05-08', '2026-05-08', '1'),
    ]);
    mockGetRecordsInRange.mockResolvedValue([
      record('r-2026-05-06', '2026-05-06', '1'),
      record('r-2026-05-05', '2026-05-05', '1'),
    ]);

    const scheduleFallbackIds = ['1'];
    const fallbackUserIds: string[] = [];
    const { result } = renderHook(() =>
      useHistoricalRecords('U001', '1', scheduleFallbackIds, fallbackUserIds),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.records.map((r) => r.id)).toEqual([
      'r-2026-05-13',
      'r-2026-05-08',
      'r-2026-05-06',
      'r-2026-05-05',
    ]);
  });
});

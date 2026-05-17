import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock ABC Record Repository with stable object references to prevent infinite render loops
const mockGetAll = vi.fn();
const mockRepo = {
  getAll: mockGetAll,
};

vi.mock('@/infra/abc/useAbcRecordRepository', () => ({
  useAbcRecordRepository: () => mockRepo,
}));

import { useUserSelectionStepData } from '../wizard/hooks/useUserSelectionStepData';

describe('useUserSelectionStepData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('初期状態が正しく返されること', async () => {
    mockGetAll.mockResolvedValue([]);

    const { result } = renderHook(() => useUserSelectionStepData());

    // Wait for useEffect
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.abcSummary.todayCounts.size).toBe(0);
    expect(result.current.abcSummary.latestDates.size).toBe(0);
    expect(result.current.planningSheets.size).toBe(0);
  });

  it('今日の ABC 記録と最新記録日が正しく集計されること', async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const mockRecords = [
      { id: '1', userId: 'user-A', occurredAt: `${todayStr}T10:00:00Z` },
      { id: '2', userId: 'user-A', occurredAt: `${todayStr}T11:00:00Z` },
      { id: '3', userId: 'user-B', occurredAt: '2026-05-15T09:00:00Z' },
    ];
    mockGetAll.mockResolvedValue(mockRecords);

    const { result } = renderHook(() => useUserSelectionStepData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.abcSummary.todayCounts.get('user-A')).toBe(2);
    expect(result.current.abcSummary.todayCounts.get('user-B')).toBeUndefined();
    expect(result.current.abcSummary.latestDates.get('user-A')).toBe(`${todayStr}T11:00:00Z`);
    expect(result.current.abcSummary.latestDates.get('user-B')).toBe('2026-05-15T09:00:00Z');
  });

  it('支援計画シートのアクティブなバージョンが正しく解決されること', async () => {
    mockGetAll.mockResolvedValue([]);

    const mockSheets = [
      { userId: 'user-A', status: 'active', isCurrent: true, version: 1 },
      { userId: 'user-A', status: 'active', isCurrent: true, version: 2 }, // latest
      { userId: 'user-B', status: 'pending', isCurrent: true, version: 1 }, // inactive
    ];
    localStorage.setItem('planningSheet.versions.v1', JSON.stringify(mockSheets));

    const { result } = renderHook(() => useUserSelectionStepData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.planningSheets.size).toBe(1);
    expect(result.current.planningSheets.get('user-A')?.version).toBe(2);
    expect(result.current.planningSheets.get('user-B')).toBeUndefined();
  });
});

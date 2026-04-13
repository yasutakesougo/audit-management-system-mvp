import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ABCRecord } from '@/domain/behavior/abc';
import { useStrategyUsageTrend } from '../useStrategyUsageTrend';

const mockGetABCRecordsForUser = vi.fn<(userId: string) => ABCRecord[]>();

vi.mock('@/features/ibd/core/ibdStore', () => ({
  getABCRecordsForUser: (userId: string) => mockGetABCRecordsForUser(userId),
}));

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

let recordSeq = 0;

function makeRecord(userId: string, overrides: Partial<ABCRecord> = {}): ABCRecord {
  recordSeq += 1;
  return {
    id: `abc-${userId}-${recordSeq}`,
    userId,
    recordedAt: daysAgoIso(1),
    antecedent: '予定変更',
    antecedentTags: ['予定変更'],
    behavior: '離席',
    consequence: '声かけ',
    intensity: 3,
    ...overrides,
  };
}

describe('useStrategyUsageTrend', () => {
  beforeEach(() => {
    recordSeq = 0;
    vi.clearAllMocks();
    mockGetABCRecordsForUser.mockReturnValue([]);
  });

  it('B 正本（getABCRecordsForUser）を参照して current/previous トレンドを算出する', async () => {
    mockGetABCRecordsForUser.mockReturnValue([
      makeRecord('U-001', {
        recordedAt: daysAgoIso(1),
        referencedStrategies: [
          { strategyKey: 'teaching', strategyText: '選択提示', applied: true },
        ],
      }),
      makeRecord('U-001', {
        recordedAt: daysAgoIso(2),
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '予告提示', applied: true },
        ],
      }),
      makeRecord('U-001', {
        recordedAt: daysAgoIso(9),
        referencedStrategies: [
          { strategyKey: 'teaching', strategyText: '選択提示', applied: true },
        ],
      }),
      makeRecord('U-001', {
        recordedAt: daysAgoIso(20),
        referencedStrategies: [
          { strategyKey: 'consequence', strategyText: '環境調整', applied: true },
        ],
      }),
    ]);

    const { result } = renderHook(() => useStrategyUsageTrend('U-001', 7));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetABCRecordsForUser).toHaveBeenCalledWith('U-001');
    expect(result.current.error).toBeNull();
    expect(result.current.result).not.toBeNull();
    expect(result.current.result?.totals).toEqual({
      currentCount: 2,
      previousCount: 1,
      delta: 1,
      trend: 'up',
    });

    const teaching = result.current.result?.items.find(
      (item) => item.strategyKey === 'teaching' && item.strategyText === '選択提示',
    );
    expect(teaching).toMatchObject({
      currentCount: 1,
      previousCount: 1,
      delta: 0,
      trend: 'flat',
    });
  });

  it('days の変更で再取得する', async () => {
    mockGetABCRecordsForUser.mockReturnValue([]);

    const { result } = renderHook(() => useStrategyUsageTrend('U-001', 30));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(mockGetABCRecordsForUser).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setDays(7);
    });

    await waitFor(() => {
      expect(mockGetABCRecordsForUser).toHaveBeenCalledTimes(2);
    });
    expect(result.current.days).toBe(7);
  });

  it('B 読取失敗時は error を設定する', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetABCRecordsForUser.mockImplementation(() => {
      throw new Error('trend read failed');
    });

    const { result } = renderHook(() => useStrategyUsageTrend('U-001', 7));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetABCRecordsForUser).toHaveBeenCalledWith('U-001');
    expect(result.current.error?.message).toBe('trend read failed');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

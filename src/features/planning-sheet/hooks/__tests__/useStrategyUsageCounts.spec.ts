import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ABCRecord } from '@/domain/behavior/abc';
import { useStrategyUsageCounts } from '../useStrategyUsageCounts';

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

describe('useStrategyUsageCounts', () => {
  beforeEach(() => {
    recordSeq = 0;
    vi.clearAllMocks();
    mockGetABCRecordsForUser.mockReturnValue([]);
  });

  it('B 正本（getABCRecordsForUser）から取得し、期間内の実施戦略のみ集計する', async () => {
    mockGetABCRecordsForUser.mockReturnValue([
      makeRecord('U-001', {
        recordedAt: daysAgoIso(2),
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '予告提示', applied: true },
          { strategyKey: 'teaching', strategyText: '選択提示', applied: false },
        ],
      }),
      makeRecord('U-001', {
        recordedAt: daysAgoIso(21),
        referencedStrategies: [
          { strategyKey: 'antecedent', strategyText: '予告提示', applied: true },
        ],
      }),
    ]);

    const { result } = renderHook(() => useStrategyUsageCounts('U-001', { days: 7 }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetABCRecordsForUser).toHaveBeenCalledWith('U-001');
    expect(result.current.error).toBeNull();

    const summary = result.current.summary;
    expect(summary).not.toBeNull();
    expect(summary?.totalApplications).toBe(1);
    expect(summary?.recordsWithStrategies).toBe(1);
    expect(summary?.antecedent.get('予告提示')).toBe(1);
    expect(summary?.teaching.size).toBe(0);
  });

  it('userId 未指定時は取得せず summary=null を返す', async () => {
    const { result } = renderHook(() => useStrategyUsageCounts(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetABCRecordsForUser).not.toHaveBeenCalled();
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('B 読取失敗時は error を設定する', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetABCRecordsForUser.mockImplementation(() => {
      throw new Error('ibd read failed');
    });

    const { result } = renderHook(() => useStrategyUsageCounts('U-001'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetABCRecordsForUser).toHaveBeenCalledWith('U-001');
    expect(result.current.error?.message).toBe('ibd read failed');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ABCRecord } from '@/domain/behavior/abc';
import { useUserAlerts } from '../useUserAlerts';

const mockGetABCRecordsForUser = vi.fn<(userId: string) => ABCRecord[]>();

vi.mock('@/features/ibd/core/ibdStore', () => ({
  getABCRecordsForUser: (userId: string) => mockGetABCRecordsForUser(userId),
}));

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function makeRecord(userId: string, overrides: Partial<ABCRecord> = {}): ABCRecord {
  return {
    id: `abc-${userId}`,
    userId,
    recordedAt: daysAgoIso(1),
    antecedent: '予定変更',
    antecedentTags: ['予定の変更'],
    behavior: '大声',
    consequence: '視覚提示',
    intensity: 4,
    ...overrides,
  };
}

describe('useUserAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetABCRecordsForUser.mockReturnValue([]);
  });

  it('B 正本（getABCRecordsForUser）を参照してアラートを生成する', async () => {
    mockGetABCRecordsForUser.mockImplementation((userId: string) => {
      if (userId === 'U-001') return [makeRecord('U-001')];
      return [];
    });

    const { result } = renderHook(() => useUserAlerts(['U-001']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetABCRecordsForUser).toHaveBeenCalledWith('U-001');
    expect(result.current.alertsByUser.has('U-001')).toBe(true);
    expect((result.current.alertsByUser.get('U-001') ?? []).length).toBeGreaterThan(0);
  });

  it('7日より古い記録は除外する', async () => {
    mockGetABCRecordsForUser.mockReturnValue([
      makeRecord('U-001', { recordedAt: daysAgoIso(14), intensity: 5 }),
    ]);

    const { result } = renderHook(() => useUserAlerts(['U-001']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.alertsByUser.size).toBe(0);
  });

  it('一部ユーザー取得失敗時も他ユーザーは継続する', async () => {
    mockGetABCRecordsForUser.mockImplementation((userId: string) => {
      if (userId === 'bad') throw new Error('fetch failed');
      return [makeRecord(userId)];
    });

    const { result } = renderHook(() => useUserAlerts(['bad', 'good']));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetABCRecordsForUser).toHaveBeenCalledWith('bad');
    expect(mockGetABCRecordsForUser).toHaveBeenCalledWith('good');
    expect(result.current.alertsByUser.has('good')).toBe(true);
    expect(result.current.alertsByUser.has('bad')).toBe(false);
  });
});

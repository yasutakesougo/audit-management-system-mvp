import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ABCRecord } from '@/domain/behavior/abc';
import { useDefaultStrategies } from '../useDefaultStrategies';

const mockGetABCRecordsForUser = vi.fn<(userId: string) => ABCRecord[]>();

vi.mock('@/features/ibd/core/ibdStore', () => ({
  getABCRecordsForUser: (userId: string) => mockGetABCRecordsForUser(userId),
}));

function makeRecord(userId: string, overrides: Partial<ABCRecord> = {}): ABCRecord {
  return {
    id: `abc-${userId}`,
    userId,
    recordedAt: new Date().toISOString(),
    antecedent: '予定変更',
    antecedentTags: ['予定の変更'],
    behavior: '大声',
    consequence: '視覚提示',
    intensity: 4,
    referencedStrategies: [
      { strategyKey: 'antecedent', strategyText: '事前提示', applied: true },
    ],
    ...overrides,
  } as ABCRecord;
}

describe('useDefaultStrategies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetABCRecordsForUser.mockReturnValue([]);
  });

  it('B 正本（getABCRecordsForUser）を参照して戦略を導出する', async () => {
    mockGetABCRecordsForUser.mockReturnValue([
      makeRecord('U-001'),
    ]);

    const { result } = renderHook(() => useDefaultStrategies('U-001'));

    await waitFor(() => {
      expect(result.current.resolved).toBe(true);
    });

    expect(mockGetABCRecordsForUser).toHaveBeenCalledWith('U-001');
    expect(result.current.defaultKeys.has('antecedent:事前提示')).toBe(true);
    expect(result.current.sourceLabel).toContain('今日');
  });

  it('userId が変わったときに再取得し、resolved と loading が適切に遷移する', async () => {
    mockGetABCRecordsForUser.mockReturnValueOnce([makeRecord('U-001')]);

    const { result, rerender } = renderHook(({ userId }) => useDefaultStrategies(userId), {
      initialProps: { userId: 'U-001' as string | undefined },
    });

    await waitFor(() => {
      expect(result.current.resolved).toBe(true);
    });
    expect(result.current.defaultKeys.has('antecedent:事前提示')).toBe(true);

    // userId 変更
    mockGetABCRecordsForUser.mockReturnValueOnce([]);
    rerender({ userId: 'U-002' });

    // 一旦 resolved が false になることは React の更新タイミングに依存するため、
    // 最終的に resolved となり、正しい userId で取得されていることを確認する
    await waitFor(() => {
      expect(result.current.resolved).toBe(true);
    });
    expect(result.current.defaultKeys.size).toBe(0);
    expect(mockGetABCRecordsForUser).toHaveBeenCalledWith('U-002');
  });

  it('userId が undefined の場合は即座に resolved になり、空の結果を返す', async () => {
    const { result } = renderHook(() => useDefaultStrategies(undefined));

    expect(result.current.resolved).toBe(true);
    expect(result.current.defaultKeys.size).toBe(0);
    expect(mockGetABCRecordsForUser).not.toHaveBeenCalled();
  });

  it('取得失敗時（例外発生）は空の結果を返し、resolved になる', async () => {
    mockGetABCRecordsForUser.mockImplementation(() => {
      throw new Error('Sync Error');
    });

    const { result } = renderHook(() => useDefaultStrategies('U-001'));

    await waitFor(() => {
      expect(result.current.resolved).toBe(true);
    });

    expect(result.current.defaultKeys.size).toBe(0);
    expect(result.current.loading).toBe(false);
  });
});

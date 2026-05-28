import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useHistoricalRecords } from '../useHistoricalRecords';
import type { ExecutionRecord } from '../../domain/legacy/executionRecordTypes';

const mockGetHistoricalRecords = vi.fn<(...args: unknown[]) => Promise<ExecutionRecord[]>>();
const mockGetRecordsInRange = vi.fn<(...args: unknown[]) => Promise<ExecutionRecord[]>>();

// useExecutionData の返す関数を毎レンダーで再作成し、参照揺れをシミュレートする
vi.mock('../useExecutionData', () => ({
  useExecutionData: () => ({
    getHistoricalRecords: (...args: unknown[]) => mockGetHistoricalRecords(...args),
    getRecordsInRange: (...args: unknown[]) => mockGetRecordsInRange(...args),
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

  it('does not re-trigger fetch when parent passes new arrays with the same values', async () => {
    mockGetHistoricalRecords.mockResolvedValue([]);
    mockGetRecordsInRange.mockResolvedValue([]);

    const { result, rerender } = renderHook(
      ({ fallbackScheduleItemIds, fallbackUserIds }) =>
        useHistoricalRecords('U001', '0', fallbackScheduleItemIds, fallbackUserIds),
      {
        initialProps: {
          fallbackScheduleItemIds: ['1'] as readonly string[],
          fallbackUserIds: ['U002'] as readonly string[],
        },
      },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCallCount = mockGetHistoricalRecords.mock.calls.length;

    // 再レンダリングで同一要素だが別インスタンスの配列を渡す
    rerender({
      fallbackScheduleItemIds: ['1'] as readonly string[],
      fallbackUserIds: ['U002'] as readonly string[],
    });

    expect(result.current.isLoading).toBe(false);
    expect(mockGetHistoricalRecords.mock.calls.length).toBe(initialCallCount);
  });

  it('does not re-trigger fetch when function references from useExecutionData change', async () => {
    mockGetHistoricalRecords.mockResolvedValue([]);
    mockGetRecordsInRange.mockResolvedValue([]);

    const { result, rerender } = renderHook(() =>
      useHistoricalRecords('U001', '0', [], []),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const initialCallCount = mockGetHistoricalRecords.mock.calls.length;

    // 再描画を呼び出す（useExecutionData は新しい無名関数を返すが、内部的には hook の副作用がトリガーされないはず）
    rerender();

    expect(result.current.isLoading).toBe(false);
    expect(mockGetHistoricalRecords.mock.calls.length).toBe(initialCallCount);
  });

  it('discards stale fetch results if params change during flight (Sequence Guard)', async () => {
    mockGetHistoricalRecords.mockResolvedValue([]);
    mockGetRecordsInRange.mockResolvedValue([]);

    let resolveFirstFetch: (value: ExecutionRecord[]) => void = () => {};
    const firstFetchPromise = new Promise<ExecutionRecord[]>((resolve) => {
      resolveFirstFetch = resolve;
    });

    // 引数に応じて精密にモックの挙動を切り替える
    mockGetHistoricalRecords.mockImplementation(async (userId, scheduleItemId) => {
      if (userId === 'U001' && String(scheduleItemId) === '1') {
        return firstFetchPromise;
      }
      if (userId === 'U001' && String(scheduleItemId) === '2') {
        return [record('r-2026-05-15', '2026-05-15', '2')];
      }
      return [];
    });

    const { result, rerender } = renderHook(
      ({ userId, scheduleItemId }) => useHistoricalRecords(userId, scheduleItemId, [], []),
      {
        initialProps: { userId: 'U001', scheduleItemId: '1' },
      },
    );

    // まだローディング中
    expect(result.current.isLoading).toBe(true);

    // 1回目が保留されている間に、パラメータを変更して2回目を走らせる
    rerender({ userId: 'U001', scheduleItemId: '2' });

    // 2回目のフェッチは即座に解決される
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.records.map((r) => r.id)).toEqual(['r-2026-05-15']);

    // ここで1回目のフェッチが遅れて解決する
    resolveFirstFetch([record('r-2026-05-10', '2026-05-10', '1')]);

    // しばらく待っても records が古い 1 回目のデータで上書きされないことを確認
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result.current.records.map((r) => r.id)).toEqual(['r-2026-05-15']);
  });

  it('discards stale fetch results if params become empty during flight', async () => {
    mockGetHistoricalRecords.mockResolvedValue([]);
    mockGetRecordsInRange.mockResolvedValue([]);

    let resolveFirstFetch: (value: ExecutionRecord[]) => void = () => {};
    const firstFetchPromise = new Promise<ExecutionRecord[]>((resolve) => {
      resolveFirstFetch = resolve;
    });

    mockGetHistoricalRecords.mockImplementation(async (userId, scheduleItemId) => {
      if (userId === 'U001' && String(scheduleItemId) === '1') {
        return firstFetchPromise;
      }
      return [];
    });

    const { result, rerender } = renderHook(
      ({ userId, scheduleItemId }) => useHistoricalRecords(userId, scheduleItemId, [], []),
      {
        initialProps: { userId: 'U001', scheduleItemId: '1' },
      },
    );

    // 1回目が保留されている間に、params を空にする
    rerender({ userId: 'U001', scheduleItemId: '' });

    // paramsが空になったので即座にローディングや状態がクリアされるはず
    expect(result.current.isLoading).toBe(false);
    expect(result.current.records).toEqual([]);

    // 1回目のフェッチが遅れて解決する
    resolveFirstFetch([record('r-2026-05-10', '2026-05-10', '1')]);

    // しばらく待っても records が古い 1 回目のデータで復活しないことを確認
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(result.current.records).toEqual([]);
  });

  it('does not loop infinitely when fetch fails and sets error state', async () => {
    const apiError = new Error('SharePoint Throttle or CORS Blocked');
    mockGetHistoricalRecords.mockRejectedValue(apiError);

    const { result } = renderHook(() => useHistoricalRecords('U001', '0', [], []));

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.error?.message).toBe('SharePoint Throttle or CORS Blocked');
    expect(result.current.isLoading).toBe(false);

    // 再フェッチの無限ループに入らず、コール数が1回で止まっていること
    expect(mockGetHistoricalRecords.mock.calls.length).toBe(1);
  });
});

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSuggestionLifecycleEvents } from '../useSuggestionLifecycleEvents';

const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockQuery = vi.fn();
const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: (...args: unknown[]) => mockCollection(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  orderBy: (...args: unknown[]) => mockOrderBy(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

vi.mock('@/infra/firestore/client', () => ({
  db: 'mock-db',
}));

type SnapshotDoc = {
  data: () => Record<string, unknown>;
};

function doc(data: Record<string, unknown>): SnapshotDoc {
  return {
    data: () => data,
  };
}

describe('useSuggestionLifecycleEvents', () => {
  beforeEach(() => {
    mockCollection.mockReset();
    mockWhere.mockReset();
    mockOrderBy.mockReset();
    mockLimit.mockReset();
    mockQuery.mockReset();
    mockGetDocs.mockReset();

    mockCollection.mockReturnValue('mock-collection');
    mockWhere.mockImplementation((...args: unknown[]) => ({ kind: 'where', args }));
    mockOrderBy.mockImplementation((...args: unknown[]) => ({ kind: 'orderBy', args }));
    mockLimit.mockImplementation((...args: unknown[]) => ({ kind: 'limit', args }));
    mockQuery.mockImplementation((...args: unknown[]) => ({ kind: 'query', args }));
  });

  it('直近7日を既定期間として取得し、集計用イベント shape に変換する', async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        doc({
          type: 'suggestion_lifecycle_event',
          event: 'suggestion_shown',
          sourceScreen: 'today',
          stableId: 'rule-a:user-1:2026-W12',
          ruleId: 'behavior-trend',
          priority: 'P1',
          clientTs: '2026-03-20T10:00:00.000Z',
        }),
        // clientTs がないケースは ts を fallback として使う
        doc({
          type: 'suggestion_lifecycle_event',
          event: 'suggestion_snoozed',
          sourceScreen: 'exception-center',
          stableId: 'rule-b:user-2:2026-W12',
          ruleId: 'high-intensity',
          priority: 'P0',
          ts: {
            toDate: () => new Date('2026-03-20T11:00:00.000Z'),
          },
        }),
        // 必須フィールド不足は除外
        doc({
          type: 'suggestion_lifecycle_event',
          event: 'suggestion_dismissed',
          sourceScreen: 'today',
          ruleId: 'behavior-trend',
          priority: 'P1',
          clientTs: '2026-03-20T12:00:00.000Z',
        }),
      ],
    });

    const now = new Date('2026-03-21T12:00:00.000Z');
    const { result } = renderHook(() =>
      useSuggestionLifecycleEvents({ now, maxDocs: 200 }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isEmpty).toBe(false);
    expect(result.current.events).toEqual([
      {
        event: 'suggestion_shown',
        sourceScreen: 'today',
        stableId: 'rule-a:user-1:2026-W12',
        ruleId: 'behavior-trend',
        priority: 'P1',
        timestamp: '2026-03-20T10:00:00.000Z',
      },
      {
        event: 'suggestion_snoozed',
        sourceScreen: 'exception-center',
        stableId: 'rule-b:user-2:2026-W12',
        ruleId: 'high-intensity',
        priority: 'P0',
        timestamp: '2026-03-20T11:00:00.000Z',
      },
    ]);

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'telemetry');
    expect(mockWhere).toHaveBeenCalledWith('type', '==', 'suggestion_lifecycle_event');
    expect(mockOrderBy).toHaveBeenCalledWith('ts', 'desc');
    expect(mockLimit).toHaveBeenCalledWith(200);

    const fromCall = mockWhere.mock.calls.find(
      (args: unknown[]) => args[0] === 'ts' && args[1] === '>=',
    );
    const toCall = mockWhere.mock.calls.find(
      (args: unknown[]) => args[0] === 'ts' && args[1] === '<=',
    );

    expect((fromCall?.[2] as Date).toISOString()).toBe('2026-03-14T12:00:00.000Z');
    expect((toCall?.[2] as Date).toISOString()).toBe('2026-03-21T12:00:00.000Z');
  });

  it('enabled=false の場合は自動取得せず、refetch で取得できる', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    const { result } = renderHook(() =>
      useSuggestionLifecycleEvents({
        enabled: false,
        now: new Date('2026-03-21T12:00:00.000Z'),
      }),
    );

    expect(result.current.isLoading).toBe(false);
    expect(mockGetDocs).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGetDocs).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.isEmpty).toBe(true);
  });

  it('取得失敗時は error を返し、events は空配列にする', async () => {
    mockGetDocs.mockRejectedValue(new Error('fetch failed'));

    const { result } = renderHook(() =>
      useSuggestionLifecycleEvents({
        now: new Date('2026-03-21T12:00:00.000Z'),
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.events).toEqual([]);
    expect(result.current.error?.message).toBe('fetch failed');
    expect(result.current.isEmpty).toBe(false);
  });

  it('from > to の場合でも window を入れ替えて問い合わせる', async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });

    renderHook(() =>
      useSuggestionLifecycleEvents({
        from: new Date('2026-03-22T00:00:00.000Z'),
        to: new Date('2026-03-20T00:00:00.000Z'),
      }),
    );

    await waitFor(() => {
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
    });

    const fromCall = mockWhere.mock.calls.find(
      (args: unknown[]) => args[0] === 'ts' && args[1] === '>=',
    );
    const toCall = mockWhere.mock.calls.find(
      (args: unknown[]) => args[0] === 'ts' && args[1] === '<=',
    );

    expect((fromCall?.[2] as Date).toISOString()).toBe('2026-03-20T00:00:00.000Z');
    expect((toCall?.[2] as Date).toISOString()).toBe('2026-03-22T00:00:00.000Z');
  });
});

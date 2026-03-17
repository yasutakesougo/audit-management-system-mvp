/**
 * useUserTimeline.spec — Phase 2 hook テスト
 *
 * テスト方針:
 *   - fetcher は mock 関数で注入（データ取得のテストではなく接続のテスト）
 *   - buildTimeline の計算ロジック自体は Phase 1 でテスト済み
 *   - hook 層のテスト対象: fetcher 呼び出し → buildTimeline 接続 → 状態管理
 *
 * カバレッジ:
 *   1. 正常系 — 4ソース統合
 *   2. Handoff userCode 解決失敗 → unresolvedHandoff カウント
 *   3. loading / error 状態遷移
 *   4. filter 反映
 *   5. sourceCounts 正確性
 *   6. refresh による再取得
 *   7. buildResolveUserIdFromCode 単体テスト
 *   8. 空データ / userId 変更
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

import {
  useUserTimeline,
  buildResolveUserIdFromCode,
} from '../useUserTimeline';
import type {
  TimelineDataFetcher,
  UseUserTimelineOptions,
} from '../useUserTimeline';
import type { TimelineSources } from '@/domain/timeline';
import type { AnyDaily } from '@/domain/daily/types';
import type { HighRiskIncident } from '@/domain/support/highRiskIncident';
import type { IndividualSupportPlan } from '@/domain/isp/schema';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';
import type { IUserMaster } from '@/features/users/types';

// ─────────────────────────────────────────────
// Test data factories
// ─────────────────────────────────────────────

function makeDaily(userId: string, date: string): AnyDaily {
  return {
    id: 1,
    userId,
    userName: '田中太郎',
    date,
    status: '完了',
    reporter: { name: 'スタッフA' },
    draft: { isDraft: false },
    kind: 'A' as const,
    data: {
      amActivities: ['活動1'],
      pmActivities: [],
      specialNotes: '特記事項あり',
    },
  } as AnyDaily;
}

function makeIncident(userId: string): HighRiskIncident {
  return {
    id: 'inc-1',
    userId,
    occurredAt: '2026-03-10T14:00:00',
    severity: '高' as const,
    description: 'テスト事象',
  } as HighRiskIncident;
}

function makeIsp(userId: string): IndividualSupportPlan {
  return {
    id: 'isp-1',
    userId,
    createdAt: '2026-03-01T10:00:00',
    createdBy: 'admin',
    updatedAt: '2026-03-01T10:00:00',
    updatedBy: 'admin',
    version: 1,
    status: 'active',
    title: 'テスト計画',
    planStartDate: '2026-03-01',
    planEndDate: '2026-09-01',
    userIntent: '自立',
    familyIntent: '',
    overallSupportPolicy: '支援方針',
    longTermGoals: [],
    shortTermGoals: [],
    isCurrent: true,
  } as unknown as IndividualSupportPlan;
}

function makeHandoff(userCode: string): HandoffRecord {
  return {
    id: 1,
    userCode,
    userDisplayName: '田中太郎',
    title: '申し送り件名',
    message: '申し送り内容',
    severity: '通常' as const,
    createdAt: '2026-03-10T09:00:00',
    status: '未対応' as const,
    category: '全般' as const,
    timeBand: '日中' as const,
    createdByName: 'スタッフB',
    isDraft: false,
  } as unknown as HandoffRecord;
}

const mockUsers: IUserMaster[] = [
  { Id: 101, Title: '田中太郎', UserID: '101', FullName: '田中太郎' } as IUserMaster,
  { Id: 102, Title: '佐藤花子', UserID: '102', FullName: '佐藤花子' } as IUserMaster,
];

// ─────────────────────────────────────────────
// buildResolveUserIdFromCode の単体テスト
// ─────────────────────────────────────────────

describe('buildResolveUserIdFromCode', () => {
  it('UserMaster から userCode → userId の resolver を構築する', () => {
    const resolve = buildResolveUserIdFromCode(mockUsers);

    expect(resolve('101')).toBe('101');
    expect(resolve('102')).toBe('102');
    expect(resolve('999')).toBeNull();
  });

  it('空の users では常に null を返す', () => {
    const resolve = buildResolveUserIdFromCode([]);

    expect(resolve('101')).toBeNull();
  });
});

// ─────────────────────────────────────────────
// useUserTimeline のテスト
// ─────────────────────────────────────────────

describe('useUserTimeline', () => {
  let fetcher: ReturnType<typeof vi.fn<TimelineDataFetcher>>;

  /** デフォルトの fetcher を作成（4ソースすべてデータあり） */
  function createFetcher(
    overrides?: Partial<TimelineSources & { rawHandoffCount: number }>,
  ) {
    const defaults: TimelineSources & { rawHandoffCount: number } = {
      dailyRecords: [makeDaily('101', '2026-03-10')],
      incidents: [makeIncident('101')],
      ispRecords: [makeIsp('101')],
      handoffRecords: [makeHandoff('101')],
      rawHandoffCount: 1,
      ...overrides,
    };
    return vi.fn<TimelineDataFetcher>().mockResolvedValue(defaults);
  }

  beforeEach(() => {
    fetcher = createFetcher();
  });

  // ─── 1. 正常系 ───

  it('4ソースのデータを統合してタイムラインを返す', async () => {
    const { result } = renderHook(() =>
      useUserTimeline('101', fetcher, mockUsers),
    );

    // 初期状態: loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Daily(1) + Incident(1) + ISP(1) + Handoff(1) = 4
    expect(result.current.events).toHaveLength(4);
    expect(result.current.error).toBeNull();

    // fetcher が正しい userId で呼ばれている
    expect(fetcher).toHaveBeenCalledWith('101');
  });

  // ─── 2. イベントが occurredAt 降順になっている ───

  it('イベントは occurredAt 降順にソートされている', async () => {
    const { result } = renderHook(() =>
      useUserTimeline('101', fetcher, mockUsers),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const dates = result.current.events.map((e) => e.occurredAt);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1] >= dates[i]).toBe(true);
    }
  });

  // ─── 3. Handoff unresolved ───

  it('Handoff の userCode が解決できない場合は除外し unresolvedHandoff をカウントする', async () => {
    fetcher = createFetcher({
      handoffRecords: [
        makeHandoff('101'), // 解決可能
        makeHandoff('999'), // 解決不可
      ],
      rawHandoffCount: 2,
    });

    const { result } = renderHook(() =>
      useUserTimeline('101', fetcher, mockUsers),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sourceCounts.handoff).toBe(1);
    expect(result.current.sourceCounts.unresolvedHandoff).toBe(1);
  });

  // ─── 4. loading 状態 ───

  it('取得中は isLoading が true になる', async () => {
    fetcher = vi.fn<TimelineDataFetcher>().mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                dailyRecords: [],
                incidents: [],
                ispRecords: [],
                handoffRecords: [],
                rawHandoffCount: 0,
              }),
            100,
          ),
        ),
    );

    const { result } = renderHook(() =>
      useUserTimeline('101', fetcher, mockUsers),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  // ─── 5. エラー状態 ───

  it('fetcher がエラーを投げた場合は error に設定される', async () => {
    fetcher = vi.fn<TimelineDataFetcher>().mockRejectedValue(
      new Error('fetch failed'),
    );

    const { result } = renderHook(() =>
      useUserTimeline('101', fetcher, mockUsers),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('fetch failed');
    expect(result.current.events).toEqual([]);
  });

  // ─── 6. filter 反映 ───

  it('filter.sources で特定ソースのみ表示する', async () => {
    const options: UseUserTimelineOptions = {
      filter: { sources: ['daily'] },
    };

    const { result } = renderHook(() =>
      useUserTimeline('101', fetcher, mockUsers, options),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // フィルタ後は daily のみ
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].source).toBe('daily');

    // sourceCounts はフィルタ前の件数を反映
    expect(result.current.sourceCounts.total).toBe(4);
  });

  // ─── 7. sourceCounts の正確性 ───

  it('sourceCounts がソースごとの件数を正確に返す', async () => {
    fetcher = createFetcher({
      handoffRecords: [makeHandoff('101'), makeHandoff('101')],
      rawHandoffCount: 2,
    });

    const { result } = renderHook(() =>
      useUserTimeline('101', fetcher, mockUsers),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const counts = result.current.sourceCounts;
    expect(counts.daily).toBe(1);
    expect(counts.incident).toBe(1);
    expect(counts.isp).toBe(1);
    expect(counts.handoff).toBe(2);
    expect(counts.total).toBe(5);
    expect(counts.unresolvedHandoff).toBe(0);
  });

  // ─── 8. refresh ───

  it('refresh() で再取得される', async () => {
    const { result } = renderHook(() =>
      useUserTimeline('101', fetcher, mockUsers),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetcher).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });

  // ─── 9. 空のソースデータ ───

  it('全ソースが空でもエラーにならない', async () => {
    fetcher = createFetcher({
      dailyRecords: [],
      incidents: [],
      ispRecords: [],
      handoffRecords: [],
      rawHandoffCount: 0,
    });

    const { result } = renderHook(() =>
      useUserTimeline('101', fetcher, mockUsers),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.events).toEqual([]);
    expect(result.current.sourceCounts.total).toBe(0);
    expect(result.current.error).toBeNull();
  });

  // ─── 10. userId 変更 ───

  it('userId が変わると再取得される', async () => {
    const { result, rerender } = renderHook(
      ({ userId }: { userId: string }) =>
        useUserTimeline(userId, fetcher, mockUsers),
      { initialProps: { userId: '101' } },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetcher).toHaveBeenCalledWith('101');

    // userId を変更
    rerender({ userId: '102' });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith('102');
    });
  });

  // ─── 11. severity filter ───

  it('severity filter で指定以上のイベントのみ返す', async () => {
    const options: UseUserTimelineOptions = {
      filter: { severity: 'critical' },
    };

    const { result } = renderHook(() =>
      useUserTimeline('101', fetcher, mockUsers, options),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Incident (severity: '高' → critical) のみ
    for (const event of result.current.events) {
      expect(event.severity).toBe('critical');
    }
  });
});

/**
 * useUserTimeline — 利用者タイムライン hook（Phase 2）
 *
 * 4ドメイン（Daily / Incident / ISP / Handoff）のデータを userId 軸で集約し、
 * buildTimeline に渡す薄い orchestration 層。
 *
 * 設計方針:
 *   - hook 自身はロジックを持たない（計算は buildTimeline に委譲）
 *   - 各ソースの取得 → adapter → buildTimeline → 出力
 *   - Handoff の ResolveUserIdFromCode は hook 内で構築
 *   - sourceCounts でフィルタ UI / デバッグ用の件数を提供
 *
 * データ取得の責務:
 *   この hook は「データの取得」と「buildTimeline への接続」のみを担う。
 *   各リポジトリの型差異（DailyRecordItem vs AnyDaily 等）の吸収は
 *   hook に渡す前に呼び出し側で行う。
 *   hook 自体は TimelineSources の型をそのまま受け取る。
 *
 * @see domain/timeline/buildTimeline.ts — コア計算ロジック
 * @see domain/timeline/types.ts — 共通型定義
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  TimelineEvent,
  TimelineFilter,
  TimelineEventSource,
  ResolveUserIdFromCode,
} from '@/domain/timeline';
import { buildTimeline, TIMELINE_SOURCES } from '@/domain/timeline';
import type { TimelineSources } from '@/domain/timeline';

import type { IUserMaster } from '@/features/users/types';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

/** ソースごとの件数（フィルタ前） */
export type TimelineSourceCounts = Record<TimelineEventSource, number> & {
  total: number;
  /** Handoff の userCode 解決に失敗した件数 */
  unresolvedHandoff: number;
};

/**
 * タイムラインのデータソースを取得する関数。
 *
 * hook から呼ばれ、4ドメインのデータを取得して返す。
 * userId でのフィルタリングは fetcher 内で行う。
 *
 * @param userId - 対象利用者 ID
 * @returns 各ドメインのレコード配列 + 元の handoff 件数
 */
export type TimelineDataFetcher = (
  userId: string,
) => Promise<TimelineSources & { rawHandoffCount: number }>;

/** useUserTimeline のオプション */
export type UseUserTimelineOptions = {
  /** 絞り込みフィルタ */
  filter?: TimelineFilter;
};

/** useUserTimeline の戻り値 */
export type UseUserTimelineReturn = {
  /** フィルタ適用済みのタイムラインイベント（occurredAt 降順） */
  events: TimelineEvent[];
  /** 読み込み中フラグ */
  isLoading: boolean;
  /** エラー（あれば） */
  error: Error | null;
  /** データ再取得 */
  refresh: () => void;
  /** ソースごとの件数（フィルタ前） */
  sourceCounts: TimelineSourceCounts;
};

// ─────────────────────────────────────────────
// 空の sourceCounts
// ─────────────────────────────────────────────

const EMPTY_COUNTS: TimelineSourceCounts = {
  total: 0,
  daily: 0,
  incident: 0,
  isp: 0,
  handoff: 0,
  unresolvedHandoff: 0,
};

// ─────────────────────────────────────────────
// UserCode → UserId resolver 構築
// ─────────────────────────────────────────────

/**
 * UserMaster 一覧から userCode → userId の resolver を構築する。
 *
 * IUserMaster.Id (number) を string 化した値を userCode と照合する。
 * UserID フィールドがあればそれを userId として使い、なければ Id を流用する。
 * マッチしない場合は null を返し、そのイベントはタイムラインから除外される。
 */
export function buildResolveUserIdFromCode(
  users: IUserMaster[],
): ResolveUserIdFromCode {
  // O(1) ルックアップ用 Map: userCode (= Id.toString()) → userId (= UserID)
  const map = new Map<string, string>();
  for (const user of users) {
    const code = String(user.Id);
    // UserID フィールドがある場合はそれを使い、なければ code をそのまま使う
    const resolvedId = user.UserID ?? code;
    map.set(code, resolvedId);
  }
  return (userCode: string) => map.get(userCode) ?? null;
}

// ─────────────────────────────────────────────
// sourceCounts 計算
// ─────────────────────────────────────────────

function computeSourceCounts(
  allEvents: TimelineEvent[],
  rawHandoffCount: number,
): TimelineSourceCounts {
  const counts: TimelineSourceCounts = { ...EMPTY_COUNTS };

  for (const source of TIMELINE_SOURCES) {
    counts[source] = allEvents.filter((e) => e.source === source).length;
  }

  counts.total = allEvents.length;
  // 解決失敗 = 元の Handoff 件数 - タイムラインに含まれた Handoff 件数
  counts.unresolvedHandoff = rawHandoffCount - counts.handoff;

  return counts;
}

// ─────────────────────────────────────────────
// useUserTimeline
// ─────────────────────────────────────────────

/**
 * 利用者タイムラインを取得する React Hook。
 *
 * 4ドメインのデータを userId で絞り込み、buildTimeline で統合する。
 * hook 自体はデータ取得と接続のみを担い、計算ロジックは持たない。
 *
 * @param userId - 対象利用者の ID
 * @param fetcher - データ取得関数（4ドメインのレコードを返す）
 * @param users - UserMaster 一覧（Handoff resolver 構築用）
 * @param options - フィルタ条件
 *
 * @example
 * ```tsx
 * const fetcher: TimelineDataFetcher = async (userId) => ({
 *   dailyRecords: await dailyRepo.listByUser(userId),
 *   incidents: await incidentRepo.getByUserId(userId),
 *   ispRecords: await ispRepo.listByUser(userId),
 *   handoffRecords: await handoffRepo.getRecords('week', 'all'),
 *   rawHandoffCount: allHandoff.length,
 * });
 *
 * const { events, isLoading, sourceCounts } = useUserTimeline(
 *   selectedUserId,
 *   fetcher,
 *   users,
 *   { filter: { sources: ['daily', 'incident'] } },
 * );
 * ```
 */
export function useUserTimeline(
  userId: string,
  fetcher: TimelineDataFetcher,
  users: IUserMaster[],
  options?: UseUserTimelineOptions,
): UseUserTimelineReturn {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sourceCounts, setSourceCounts] = useState<TimelineSourceCounts>(EMPTY_COUNTS);

  // refreshTrigger で手動リロードを実現
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const refresh = useCallback(() => setRefreshTrigger((n) => n + 1), []);

  // Handoff resolver を users から構築（users が変わったときだけ再構築）
  const resolveUserIdFromCode = useMemo(
    () => buildResolveUserIdFromCode(users),
    [users],
  );

  // options を安定化（インラインオブジェクトの identity churn を防ぐ）
  const optionsKey = JSON.stringify(options ?? null);
  const stableOptions = useRef(options);
  stableOptions.current = options;

  // fetcher を ref に退避（参照安定化）
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;

    const fetchTimeline = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const currentOptions = stableOptions.current;

        // ─── データ取得（fetcher に委譲） ───
        const { rawHandoffCount, ...sources } =
          await fetcherRef.current(userId);

        if (cancelled) return;

        // ─── buildTimeline に委譲 ───

        // フィルタ前のイベントで sourceCounts を計算
        const allEvents = buildTimeline(sources, {
          resolveUserIdFromCode,
        });

        const counts = computeSourceCounts(allEvents, rawHandoffCount);

        // フィルタ適用済みイベント
        const filteredEvents = currentOptions?.filter
          ? buildTimeline(sources, {
              filter: currentOptions.filter,
              resolveUserIdFromCode,
            })
          : allEvents;

        if (cancelled) return;

        setEvents(filteredEvents);
        setSourceCounts(counts);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err : new Error(String(err)),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchTimeline();

    return () => {
      cancelled = true;
    };
  }, [userId, refreshTrigger, resolveUserIdFromCode, optionsKey]);

  return { events, isLoading, error, refresh, sourceCounts };
}

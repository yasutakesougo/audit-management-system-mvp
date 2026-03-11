/**
 * /dashboard/briefing ページの状態管理フック
 *
 * 責務:
 * - タブ選択と defaultTab 判定
 * - 朝会/夕会の handoff データ取得
 * - 週次チャート用データ取得
 * - WeeklySummaryChart の preload 制御
 * - タイムラインへの navigation callback
 *
 * 戻り値は 5 つのグループに分けて返す:
 * tab / summary / timelines / weekly / actions
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildHandoffTimelineUrl } from '@/app/links/navigationLinks';
import type { HandoffStats } from '@/features/handoff/TodayHandoffTimelineList';
import { useHandoffSummary } from '@/features/handoff/useHandoffSummary';
import { useHandoffTimeline } from '@/features/handoff/useHandoffTimeline';
import { useUsersStore } from '@/features/users/store';
import lazyWithPreload from '@/utils/lazyWithPreload';
import { cancelIdle, runOnIdle } from '@/utils/runOnIdle';
import type { BriefingTabValue } from './types';
import { resolveDefaultTab, startOfWeek } from './constants';

// ---------------------------------------------------------------------------
// WeeklySummaryChart — lazy + preload
// ---------------------------------------------------------------------------

export const WeeklySummaryChartLazy = lazyWithPreload(
  () => import('@/features/records/dashboard/WeeklySummaryChart'),
);

// ---------------------------------------------------------------------------
// ユーザー ID 抽出ヘルパー
// ---------------------------------------------------------------------------

type MaybeUser = {
  Id?: number | string;
  UserID?: string | number;
  IsActive?: boolean | null;
};
const getUserId = (u: MaybeUser) => String(u.UserID ?? u.Id ?? '');

// ---------------------------------------------------------------------------
// Hook 本体
// ---------------------------------------------------------------------------

export const useBriefingPageState = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state as { tab?: BriefingTabValue } | undefined;

  // ── Tab ──────────────────────────────────────────────────
  const [selectedTab, setSelectedTab] = useState<BriefingTabValue>(() =>
    resolveDefaultTab(navState?.tab),
  );

  useEffect(() => {
    if (navState?.tab) setSelectedTab(navState.tab);
  }, [navState?.tab]);

  // ── Handoff summary ─────────────────────────────────────
  const { total, byStatus, criticalCount } = useHandoffSummary({ dayScope: 'today' });
  const hasSummaryInfo = total > 0;

  // ── Handoff timelines ───────────────────────────────────
  const morningTimeline = useHandoffTimeline('all', 'yesterday');
  const eveningTimeline = useHandoffTimeline('all', 'today');
  const [morningHandoffStats, setMorningHandoffStats] = useState<HandoffStats | null>(null);
  const [eveningHandoffStats, setEveningHandoffStats] = useState<HandoffStats | null>(null);
  const handoffPreviewLimit = 6;

  // ── Weekly chart data ───────────────────────────────────
  const { data: usersStore = [] } = useUsersStore();
  const activeUserIds = useMemo(
    () => usersStore.filter((u) => u?.IsActive !== false).map(getUserId),
    [usersStore],
  );
  const weekStartYYYYMMDD = useMemo(
    () => startOfWeek(new Date(), 1).toISOString().split('T')[0],
    [],
  );

  // ── Preload control ─────────────────────────────────────
  const hoverTimerRef = useRef<number | null>(null);

  const preloadOnHover = useCallback(() => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      WeeklySummaryChartLazy.preload?.();
    }, 150);
  }, []);

  // Idle preload + cleanup
  useEffect(() => {
    const handle = runOnIdle(() => WeeklySummaryChartLazy.preload?.());
    return () => {
      cancelIdle(handle);
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, []);

  // Tab-select preload
  useEffect(() => {
    if (selectedTab === 'weekly') {
      WeeklySummaryChartLazy.preload?.();
    }
  }, [selectedTab]);

  // ── Navigation callbacks ────────────────────────────────
  const openTimelineToday = useCallback(() => {
    navigate(buildHandoffTimelineUrl(), { state: { dayScope: 'today', timeFilter: 'all' } });
  }, [navigate]);

  const openTimelineYesterday = useCallback(() => {
    navigate(buildHandoffTimelineUrl({ date: 'yesterday' }), {
      state: { dayScope: 'yesterday', timeFilter: 'all' },
    });
  }, [navigate]);

  // ── Grouped return ──────────────────────────────────────
  return {
    /** タブ状態 */
    tab: {
      value: selectedTab,
      set: setSelectedTab,
    },

    /** 今日の要点チップ（handoff summary） */
    summary: {
      total,
      byStatus,
      criticalCount,
      hasSummaryInfo,
    },

    /** 朝会/夕会の申し送りタイムライン */
    timelines: {
      morning: morningTimeline,
      evening: eveningTimeline,
      morningStats: morningHandoffStats,
      eveningStats: eveningHandoffStats,
      setMorningStats: setMorningHandoffStats,
      setEveningStats: setEveningHandoffStats,
      previewLimit: handoffPreviewLimit,
    },

    /** 週次サマリーのデータ */
    weekly: {
      weekStartYYYYMMDD,
      activeUserIds,
      preloadOnHover,
    },

    /** Navigation */
    actions: {
      openTimelineToday,
      openTimelineYesterday,
    },
  };
};

/** useBriefingPageState の戻り値型 */
export type BriefingPageState = ReturnType<typeof useBriefingPageState>;

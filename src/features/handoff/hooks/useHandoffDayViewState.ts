/**
 * useHandoffDayViewState — HandoffDayView 固有の state 管理 Hook
 *
 * Phase 3 (C-1): DayView コンポーネントから state を分離。
 *
 * 責務:
 * - displayMode (timeline / grouped)
 * - statusFilter (actionRequired / pending / all)
 * - meetingMode 切替時の dateNav 連動
 * - filteredHandoffs の計算
 * - DI 注入 (useHandoffTimelineViewModel → useHandoffTimeline 間)
 *
 * DayView は描画のみを担当する構成に。
 */

import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  filterHandoffsByStatus,
  getFilteredCountInfo,
  type HandoffStatusFilter,
} from '../domain/filterHandoffsByStatus';
import type { HandoffDayScope, HandoffRecord, MeetingMode } from '../handoffTypes';
import { useHandoffTimeline } from '../useHandoffTimeline';
import { useHandoffTimelineViewModel } from '../useHandoffTimelineViewModel';
import type { HandoffStats } from '../TodayHandoffTimelineList';
import { addDays, formatDateLocal } from './useHandoffDateNav';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

/** 表示モード: 時系列フラット or 利用者グループ */
export type HandoffDisplayMode = 'timeline' | 'grouped';

/** /today 経由か直接遷移か */
export type EntryMode = 'from-today' | 'direct';

export type UseHandoffDayViewStateArgs = {
  dayScope: HandoffDayScope;
  entryMode: EntryMode;
  goToDate: (date: string) => void;
  goToToday: () => void;
};

export type HandoffDayViewState = {
  // Display
  displayMode: HandoffDisplayMode;
  setDisplayMode: (mode: HandoffDisplayMode) => void;

  // Status filter
  statusFilter: HandoffStatusFilter;
  setStatusFilter: (filter: HandoffStatusFilter) => void;
  filteredHandoffs: HandoffRecord[];
  filteredCountInfo: { label: string; isFiltered: boolean };

  // Meeting mode
  meetingMode: MeetingMode;
  handleMeetingModeChange: (event: React.MouseEvent<HTMLElement>, newMode: string) => void;

  // Data
  todayHandoffs: HandoffRecord[];
  timelineLoading: boolean;
  timelineError: string | null;
  updateHandoffStatus: (id: number, status: HandoffRecord['status']) => Promise<void>;

  // Stats
  handoffStats: HandoffStats | null;
  setHandoffStats: (stats: HandoffStats | null) => void;

  // VM passthrough
  timeFilter: ReturnType<typeof useHandoffTimelineViewModel>['timeFilter'];
  handleTimeFilterChange: ReturnType<typeof useHandoffTimelineViewModel>['handleTimeFilterChange'];
  workflowActions: ReturnType<typeof useHandoffTimelineViewModel>['workflowActions'];

  // PR-B: 該当カードのハイライト用
  highlightedHandoffId: number | null;
};

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

export function useHandoffDayViewState({
  dayScope,
  entryMode,
  goToDate,
  goToToday,
}: UseHandoffDayViewStateArgs): HandoffDayViewState {

  // ── Day 固有 state ──
  const [displayMode, setDisplayMode] = useState<HandoffDisplayMode>(
    entryMode === 'from-today' ? 'grouped' : 'timeline',
  );
  const [statusFilter, setStatusFilter] = useState<HandoffStatusFilter>('actionRequired');

  // ── VM: timeFilter / meetingMode / workflowActions ──
  const {
    timeFilter,
    handoffStats,
    setHandoffStats,
    handleTimeFilterChange,
    meetingMode,
    handleMeetingModeChange: vmHandleMeetingModeChange,
    workflowActions,
    injectDI,
  } = useHandoffTimelineViewModel({
    navState: {
      dayScope,
      timeFilter: undefined,
    },
  });

  // 会議モード切替時に dateNav の日付も連動移動
  const handleMeetingModeChange = useCallback(
    (event: React.MouseEvent<HTMLElement>, newMode: string) => {
      vmHandleMeetingModeChange(event, newMode as MeetingMode);
      if (newMode === 'morning') {
        goToDate(addDays(formatDateLocal(), -1));
      } else if (newMode === 'evening') {
        goToToday();
      }
    },
    [vmHandleMeetingModeChange, goToDate, goToToday],
  );

  // ── データ取得 ──
  const {
    todayHandoffs,
    loading: timelineLoading,
    error: timelineError,
    updateHandoffStatus,
  } = useHandoffTimeline(timeFilter, dayScope);

  // ── ステータスフィルタ適用 ──
  // PR-B: URLの handoffId を読み取り、該当カードを先頭へ移動する
  const [searchParams] = useSearchParams();
  const highlightedHandoffId = useMemo(() => {
    const param = searchParams.get('handoffId');
    return param ? Number(param) : null;
  }, [searchParams]);

  const filteredHandoffs = useMemo(() => {
    const list = filterHandoffsByStatus(todayHandoffs, statusFilter);
    if (highlightedHandoffId) {
      const targetIndex = list.findIndex(h => h.id === highlightedHandoffId);
      if (targetIndex > -1) {
        const [target] = list.splice(targetIndex, 1);
        list.unshift(target); // 先頭に移動
      }
    }
    return list;
  }, [todayHandoffs, statusFilter, highlightedHandoffId]);

  const filteredCountInfo = useMemo(
    () => getFilteredCountInfo(todayHandoffs.length, filteredHandoffs.length, statusFilter),
    [todayHandoffs.length, filteredHandoffs.length, statusFilter],
  );

  // ── DI 注入 ──
  injectDI({ updateHandoffStatus, currentRecords: todayHandoffs });

  return {
    displayMode,
    setDisplayMode,
    statusFilter,
    setStatusFilter,
    filteredHandoffs,
    filteredCountInfo,
    meetingMode,
    handleMeetingModeChange,
    todayHandoffs,
    timelineLoading,
    timelineError,
    updateHandoffStatus,
    handoffStats,
    setHandoffStats,
    timeFilter,
    handleTimeFilterChange,
    workflowActions,
    highlightedHandoffId,
  };
}

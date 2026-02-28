import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { HandoffStats } from './TodayHandoffTimelineList';
import type {
    HandoffDayScope,
    HandoffStatus,
    HandoffStatusUpdate,
    HandoffTimeFilter,
    MeetingMode
} from './handoffTypes';
import {
    formatYmdLocal,
    isTerminalStatus
} from './handoffTypes';

type HandoffTimelineNavState =
  | {
      dayScope?: HandoffDayScope;
      timeFilter?: HandoffTimeFilter;
    }
  | undefined;

type UseHandoffTimelineViewModelArgs = {
  navState?: HandoffTimelineNavState;
};

export type HandoffTimelineViewModel = {
  // 既存
  dayScope: HandoffDayScope;
  timeFilter: HandoffTimeFilter;
  isQuickNoteOpen: boolean;
  handoffStats: HandoffStats | null;
  setHandoffStats: (stats: HandoffStats | null) => void;
  quickNoteRef: MutableRefObject<HTMLDivElement | null>;
  handleDayScopeChange: (_event: React.MouseEvent<HTMLElement>, newDayScope: HandoffDayScope) => void;
  handleTimeFilterChange: (_event: React.MouseEvent<HTMLElement>, newFilter: HandoffTimeFilter) => void;
  openQuickNote: () => void;
  closeQuickNote: () => void;

  // ワークフロー拡張
  meetingMode: MeetingMode;
  handleMeetingModeChange: (_event: React.MouseEvent<HTMLElement>, newMode: MeetingMode) => void;
  /** 未対応 → 確認済 (夕会) */
  markReviewed: (id: number, currentStatus: HandoffStatus) => void;
  /** 確認済 → 明日へ持越 + carryOverDate=今日 (夕会) */
  markCarryOver: (id: number, currentStatus: HandoffStatus) => void;
  /** → 完了 (夕会/朝会) */
  markClosed: (id: number, currentStatus: HandoffStatus) => void;
  /**
   * ViewModel レベルで提供するフィルタ済み更新関数
   * TodayHandoffTimelineList で使用
   */
  updateHandoffStatusVm: (id: number, update: HandoffStatusUpdate) => Promise<void> | void;
};

export function useHandoffTimelineViewModel({
  navState,
}: UseHandoffTimelineViewModelArgs): HandoffTimelineViewModel {
  const [dayScope, setDayScope] = useState<HandoffDayScope>(
    navState?.dayScope ?? 'today'
  );
  const [timeFilter, setTimeFilter] = useState<HandoffTimeFilter>(
    navState?.timeFilter ?? 'all'
  );
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);
  const [handoffStats, setHandoffStats] = useState<HandoffStats | null>(null);
  const quickNoteRef = useRef<HTMLDivElement | null>(null);
  const [meetingMode, setMeetingMode] = useState<MeetingMode>('normal');

  // 外部から updateHandoffStatus を受け取るためのrefを用意
  // TodayHandoffTimelineList 内部の useHandoffTimeline で実際のupdate関数が決まるので、
  // VM からはコールバックを提供し、子から呼んでもらう形。
  // → 実装詳細: 子コンポーネント側が updateHandoffStatus を持っているので、
  //   VM はワークフローアクション用のラッパーのみ提供。
  //   updateHandoffStatusVm は子に渡す用のパススルー関数。
  const updateHandoffStatusRef = useRef<((id: number, update: HandoffStatusUpdate) => Promise<void> | void) | null>(null);

  /**
   * 子コンポーネントが実際のupdate関数を登録するためのsetter
   * → 実際は TodayHandoffTimelineList の updateHandoffStatus をそのままパススルーする。
   *   しかし updateHandoffStatus は useHandoffTimeline フック内で定義されるため、
   *   VMレベルからは直接アクセスできない。
   *
   * 解決策: updateHandoffStatusVm を子にpropsで渡し、子側でラップして呼ぶ。
   * VMのワークフローアクション (markReviewed等) → updateHandoffStatusVm → 子の updateHandoffStatus
   */
  const updateHandoffStatusVm = useCallback(
    async (id: number, update: HandoffStatusUpdate) => {
      if (updateHandoffStatusRef.current) {
        await updateHandoffStatusRef.current(id, update);
      }
    },
    []
  );

  const navDayScope = navState?.dayScope;
  const navTimeFilter = navState?.timeFilter;

  useEffect(() => {
    if (navDayScope) {
      setDayScope(navDayScope);
    }
    if (navTimeFilter) {
      setTimeFilter(navTimeFilter);
    }
  }, [navDayScope, navTimeFilter]);

  useEffect(() => {
    setHandoffStats(null);
  }, [dayScope, timeFilter]);

  useEffect(() => {
    const handler = () => {
      setIsQuickNoteOpen(true);
      window.setTimeout(() => {
        if (quickNoteRef.current) {
          quickNoteRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    };

    window.addEventListener('handoff-open-quicknote', handler);
    return () => window.removeEventListener('handoff-open-quicknote', handler);
  }, []);

  const handleDayScopeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newDayScope: HandoffDayScope) => {
      if (newDayScope !== null) {
        setDayScope(newDayScope);
      }
    },
    []
  );

  const handleTimeFilterChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newFilter: HandoffTimeFilter) => {
      if (newFilter !== null) {
        setTimeFilter(newFilter);
      }
    },
    []
  );

  const handleMeetingModeChange = useCallback(
    (_event: React.MouseEvent<HTMLElement>, newMode: MeetingMode) => {
      if (newMode !== null) {
        setMeetingMode(newMode);
      }
    },
    []
  );

  const openQuickNote = useCallback(() => {
    setIsQuickNoteOpen(true);
  }, []);

  const closeQuickNote = useCallback(() => {
    setIsQuickNoteOpen(false);
  }, []);

  // ────────────────────────────────────────────────────────────
  // ワークフローアクション
  // ────────────────────────────────────────────────────────────

  /**
   * 夕会: 未対応 → 確認済
   */
  const markReviewed = useCallback(
    (id: number, currentStatus: HandoffStatus) => {
      if (currentStatus !== '未対応') return; // ガード
      updateHandoffStatusVm(id, { status: '確認済' });
    },
    [updateHandoffStatusVm]
  );

  /**
   * 夕会: 確認済 → 明日へ持越 + carryOverDate
   */
  const markCarryOver = useCallback(
    (id: number, currentStatus: HandoffStatus) => {
      if (currentStatus !== '確認済') return; // ガード
      updateHandoffStatusVm(id, {
        status: '明日へ持越',
        carryOverDate: formatYmdLocal(new Date()),
      });
    },
    [updateHandoffStatusVm]
  );

  /**
   * 夕会/朝会: → 完了
   * 確認済→完了 (夕会), 明日へ持越→完了 (朝会)
   */
  const markClosed = useCallback(
    (id: number, currentStatus: HandoffStatus) => {
      if (isTerminalStatus(currentStatus)) return; // 既に終端ならno-op
      if (currentStatus === '未対応' || currentStatus === '対応中') return; // 通常フロー中はno-op
      updateHandoffStatusVm(id, { status: '完了' });
    },
    [updateHandoffStatusVm]
  );

  return {
    dayScope,
    timeFilter,
    isQuickNoteOpen,
    handoffStats,
    setHandoffStats,
    quickNoteRef,
    handleDayScopeChange,
    handleTimeFilterChange,
    openQuickNote,
    closeQuickNote,

    // ワークフロー拡張
    meetingMode,
    handleMeetingModeChange,
    markReviewed,
    markCarryOver,
    markClosed,
    updateHandoffStatusVm,
  };
}

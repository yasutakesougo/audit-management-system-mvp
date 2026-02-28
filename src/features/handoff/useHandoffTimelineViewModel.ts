import { useCallback, useEffect, useRef, useState } from 'react';
import type { HandoffStats } from './TodayHandoffTimelineList';
import type {
    HandoffDayScope,
    HandoffRecord,
    HandoffStatus,
    HandoffTimeFilter,
    MeetingMode,
} from './handoffTypes';
import { getAllowedActions } from './handoffTypes';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

type HandoffTimelineNavState =
  | {
      dayScope?: HandoffDayScope;
      timeFilter?: HandoffTimeFilter;
    }
  | undefined;

type UseHandoffTimelineViewModelArgs = {
  navState?: HandoffTimelineNavState;
  /** v3: データhookから注入される updateHandoffStatus */
  updateHandoffStatus?: (id: number, newStatus: HandoffStatus, carryOverDate?: string) => Promise<void>;
  /** v3: 現在表示中のレコード (ワークフローガード検証用) */
  currentRecords?: HandoffRecord[];
};

/** v3: late-binding DI コンテナ (useRef で保持、Page 側から毎レンダー更新) */
type WorkflowDI = {
  updateHandoffStatus: ((id: number, newStatus: HandoffStatus, carryOverDate?: string) => Promise<void>) | undefined;
  currentRecords: HandoffRecord[];
};

/**
 * ワークフローアクション関数の型
 * UI層はこれを受け取ってボタンの onClick に直結する
 */
export type WorkflowActions = {
  /** 夕会: 未対応 → 確認済 */
  markReviewed: (id: number) => Promise<void>;
  /** 夕会: 確認済 → 明日へ持越 (carryOverDate を自動セット) */
  markCarryOver: (id: number) => Promise<void>;
  /** 夕会/朝会: → 完了 */
  markClosed: (id: number) => Promise<void>;
};

export type HandoffTimelineViewModel = {
  // 既存
  dayScope: HandoffDayScope;
  timeFilter: HandoffTimeFilter;
  handoffStats: HandoffStats | null;
  setHandoffStats: (stats: HandoffStats | null) => void;
  handleDayScopeChange: (_event: React.MouseEvent<HTMLElement>, newDayScope: HandoffDayScope) => void;
  handleTimeFilterChange: (_event: React.MouseEvent<HTMLElement>, newFilter: HandoffTimeFilter) => void;
  // v3: ワークフロー拡張
  meetingMode: MeetingMode;
  handleMeetingModeChange: (_event: React.MouseEvent<HTMLElement>, newMode: MeetingMode) => void;
  workflowActions: WorkflowActions;
  /** v3: late-binding DI 注入関数。Page 側で data hook 後に呼ぶ。 */
  injectDI: (di: {
    updateHandoffStatus: (id: number, newStatus: HandoffStatus, carryOverDate?: string) => Promise<void>;
    currentRecords: HandoffRecord[];
  }) => void;
};

// ────────────────────────────────────────────────────────────
// JST安全な日付フォーマット
// ────────────────────────────────────────────────────────────

/** YYYY-MM-DD を JST で生成 (timezone-safe) */
function formatYmdLocal(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ────────────────────────────────────────────────────────────
// Hook
// ────────────────────────────────────────────────────────────

/**
 * ワークフローアクションを生成
 *
 * updateHandoffStatus: 既存の data hook (useHandoffTimeline) が提供する関数
 * -> 楽観的更新 + rollback が既に組み込み済み
 *
 * ガード: getAllowedActions で不正遷移を防止 (no-op)
 */
function useWorkflowActions(
  diRef: React.MutableRefObject<WorkflowDI>,
  meetingMode: MeetingMode,
): WorkflowActions {
  const findRecord = useCallback(
    (id: number) => diRef.current.currentRecords.find(r => r.id === id),
    [diRef],
  );

  const isAllowed = useCallback(
    (id: number, target: HandoffStatus): boolean => {
      const record = findRecord(id);
      if (!record) return false;
      return getAllowedActions(record.status, meetingMode).includes(target);
    },
    [findRecord, meetingMode],
  );

  const markReviewed = useCallback(
    async (id: number) => {
      if (!isAllowed(id, '確認済')) {
        console.warn(`[handoff] markReviewed blocked: id=${id} not allowed in ${meetingMode} mode`);
        return;
      }
      const fn = diRef.current.updateHandoffStatus;
      if (!fn) { console.warn('[handoff] updateHandoffStatus not provided'); return; }
      await fn(id, '確認済');
    },
    [diRef, isAllowed, meetingMode],
  );

  const markCarryOver = useCallback(
    async (id: number) => {
      if (!isAllowed(id, '明日へ持越')) {
        console.warn(`[handoff] markCarryOver blocked: id=${id} not allowed in ${meetingMode} mode`);
        return;
      }
      const fn = diRef.current.updateHandoffStatus;
      if (!fn) { console.warn('[handoff] updateHandoffStatus not provided'); return; }
      const today = formatYmdLocal();
      await fn(id, '明日へ持越', today);
    },
    [diRef, isAllowed, meetingMode],
  );

  const markClosed = useCallback(
    async (id: number) => {
      if (!isAllowed(id, '完了')) {
        console.warn(`[handoff] markClosed blocked: id=${id} not allowed in ${meetingMode} mode`);
        return;
      }
      const fn = diRef.current.updateHandoffStatus;
      if (!fn) { console.warn('[handoff] updateHandoffStatus not provided'); return; }
      await fn(id, '完了');
    },
    [diRef, isAllowed, meetingMode],
  );

  return { markReviewed, markCarryOver, markClosed };
}

export function useHandoffTimelineViewModel({
  navState,
  updateHandoffStatus,
  currentRecords = [],
}: UseHandoffTimelineViewModelArgs): HandoffTimelineViewModel {
  const [dayScope, setDayScope] = useState<HandoffDayScope>(
    navState?.dayScope ?? 'today'
  );
  const [timeFilter, setTimeFilter] = useState<HandoffTimeFilter>(
    navState?.timeFilter ?? 'all'
  );
  const [handoffStats, setHandoffStats] = useState<HandoffStats | null>(null);

  // v3: 会議モード ('normal' | 'evening' | 'morning')
  const [meetingMode, setMeetingMode] = useState<MeetingMode>('normal');

  // v3: late-binding DI (useRef)
  // Page 側で data hook を VM の後に呼ぶため、
  // useRef で保持して毎レンダー同期する。
  // workflowActions 内の useCallback は diRef.current を読むので
  // 常に最新の関数・データが使われる。
  const diRef = useRef<WorkflowDI>({
    updateHandoffStatus,
    currentRecords,
  });
  diRef.current = { updateHandoffStatus, currentRecords };

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

        // v3: モード切替時に自然なデフォルトを設定
        if (newMode === 'morning') {
          setDayScope('yesterday');
          setTimeFilter('morning');
        } else if (newMode === 'evening') {
          setDayScope('today');
          setTimeFilter('evening');
        }
      }
    },
    []
  );

  // v3: ワークフローアクション (useRef DI 経由で late-binding)
  const workflowActions = useWorkflowActions(diRef, meetingMode);

  // v3: Page 側が data hook の後に呼ぶ DI 注入関数
  const injectDI = useCallback(
    (di: {
      updateHandoffStatus: (id: number, newStatus: HandoffStatus, carryOverDate?: string) => Promise<void>;
      currentRecords: HandoffRecord[];
    }) => {
      diRef.current = di;
    },
    [],
  );

  return {
    dayScope,
    timeFilter,
    handoffStats,
    setHandoffStats,
    handleDayScopeChange,
    handleTimeFilterChange,
    meetingMode,
    handleMeetingModeChange,
    workflowActions,
    injectDI,
  };
}

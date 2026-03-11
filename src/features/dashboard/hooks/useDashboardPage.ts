/**
 * useDashboardPage — ダッシュボードページ全体の State / ViewModel 集約フック
 *
 * 責務:
 * - 各ストア・外部フックの呼び出し
 * - useDashboardSummary / useDashboardViewModel の接続
 * - ページレベルの UI State（tabValue, showAttendanceNames, highlightSection）
 * - scrollToSection コールバック
 * -日付ラベル / todayChanges の生成
 *
 * DashboardPage.tsx はこのフックの戻り値のみに依存し、ロジックを一切持たない。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useFeatureFlags } from '@/config/featureFlags';
import { useAttendanceStore } from '@/features/attendance/store';
import { canAccessDashboardAudience, type DashboardAudience } from '@/features/auth/store';
import type { TodayChanges } from '@/features/dashboard/components/TodayChangesCard';
import { useDashboardLayoutMode, type DashboardLayoutMode } from '@/features/dashboard/hooks/useDashboardLayoutMode';
import { generateMockActivityRecords } from '@/features/dashboard/mocks/mockData';
import { getDashboardAnchorIdByKey } from '@/features/dashboard/sections/buildSections';
import { useDashboardSummary } from '@/features/dashboard/useDashboardSummary';
import { useDashboardViewModel, type DashboardSectionKey, type DashboardViewModel } from '@/features/dashboard/useDashboardViewModel';
import type { HandoffDayScope, HandoffRecord, HandoffStatus } from '@/features/handoff/handoffTypes';
import { useHandoffSummary } from '@/features/handoff/useHandoffSummary';
import { useHandoffTimeline } from '@/features/handoff/useHandoffTimeline';
import { useAttendanceCounts } from '@/features/staff/attendance/useAttendanceCounts';
import { useStaffStore } from '@/features/staff/store';
import { useUsersDemo } from '@/features/users/usersStoreDemo';
import { toLocalDateISO } from '@/utils/getNow';

// ── 定数 ──
const ADMIN_TABS = [
  { label: '集団傾向分析' },
  { label: '利用状況' },
  { label: '問題行動サマリー' },
  { label: '医療・健康情報' },
  { label: '個別支援記録' },
] as const;

// ── Handoff グループ型 ──
export interface DashboardHandoffGroup {
  total: number;
  critical: number;
  status: Record<string, number>;
  timeline: {
    items: HandoffRecord[];
    loading: boolean;
    error: string | null;
    updateStatus: (id: number, newStatus: HandoffStatus, carryOverDate?: string) => Promise<void>;
    reload: () => void;
  };
}

// ── Navigation グループ型 ──
export interface DashboardNavGroup {
  navigate: ReturnType<typeof useNavigate>;
  openTimeline: (scope?: HandoffDayScope) => void;
  openBriefing: () => void;
  layoutMode: DashboardLayoutMode;
  schedulesEnabled: boolean;
}

// ── UI State グループ型 ──
export interface DashboardUIGroup {
  tabValue: number;
  handleTabChange: (_: React.SyntheticEvent, newValue: number) => void;
  showAttendanceNames: boolean;
  setShowAttendanceNames: React.Dispatch<React.SetStateAction<boolean>>;
  highlightSection: DashboardSectionKey | null;
  scrollToSection: (sectionKeyOrAnchorId: DashboardSectionKey | string) => void;
  sectionIdByKey: Record<DashboardSectionKey, string>;
  dateLabel: string;
  todayChanges: TodayChanges;
  dailyStatusCards: DailyStatusCard[];
  isMorningTime: boolean;
  isEveningTime: boolean;
  users: ReturnType<typeof useUsersDemo>['data'];
  visits: ReturnType<typeof useAttendanceStore>['visits'];
}

// ── 戻り値の型 ──
export interface UseDashboardPageReturn {
  nav: DashboardNavGroup;
  ui: DashboardUIGroup;
  vm: DashboardViewModel<unknown>;
  summary: ReturnType<typeof useDashboardSummary>;
  handoff: DashboardHandoffGroup;
}

export interface DailyStatusCard {
  label: string;
  value: number;
  helper: string;
  color: string;
  emphasize?: boolean;
}

// ── フック本体 ──
export function useDashboardPage(audience: DashboardAudience = 'staff'): UseDashboardPageReturn {
  const navigate = useNavigate();
  const layoutMode = useDashboardLayoutMode();
  const { schedules: schedulesEnabled } = useFeatureFlags();

  // ── UI State ──
  const [tabValue, setTabValue] = useState(0);
  const [showAttendanceNames, setShowAttendanceNames] = useState(false);
  const [highlightSection, setHighlightSection] = useState<DashboardSectionKey | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  // ── Domain stores ──
  const { data: users } = useUsersDemo();
  const { visits } = useAttendanceStore();
  const { staff } = useStaffStore();
  const {
    total: handoffTotal,
    byStatus: handoffStatus,
    criticalCount: handoffCritical,
  } = useHandoffSummary({ dayScope: 'today' });

  // ── Handoff Live Feed データ ──
  const {
    todayHandoffs: handoffTimelineItems,
    loading: handoffTimelineLoading,
    error: handoffTimelineError,
    updateHandoffStatus: handoffTimelineUpdateStatus,
    reload: handoffTimelineReload,
  } = useHandoffTimeline('all', 'today');

  // ── Time calculations ──
  const today = toLocalDateISO();
  const currentMonth = today.slice(0, 7);
  const currentHour = new Date().getHours();
  const isMorningTime = currentHour >= 8 && currentHour < 12;
  const isEveningTime = currentHour >= 17 && currentHour < 19;

  // ── Navigation callbacks ──
  const openTimeline = useCallback(
    (scope: HandoffDayScope = 'today') => {
      navigate('/handoff-timeline', {
        state: { dayScope: scope, timeFilter: 'all' },
      });
    },
    [navigate],
  );

  const openBriefing = useCallback(() => {
    const tab = isMorningTime ? 'morning' : 'evening';
    navigate('/dashboard/briefing', { state: { tab } });
  }, [navigate, isMorningTime]);

  // ── Anchor IDs ──
  const sectionIdByKey = getDashboardAnchorIdByKey();

  // ── Scroll ──
  const scrollToSection = useCallback(
    (sectionKeyOrAnchorId: DashboardSectionKey | string) => {
      const targetId = (sectionIdByKey as Record<string, string>)[sectionKeyOrAnchorId] ?? sectionKeyOrAnchorId;
      const node = document.getElementById(targetId);
      if (!node) {
        console.warn(`[dashboard] section not found or hidden: ${sectionKeyOrAnchorId} -> #${targetId}`);
        return;
      }
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setHighlightSection(sectionKeyOrAnchorId as DashboardSectionKey);
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightSection(null);
      }, 1400);
    },
    [sectionIdByKey],
  );

  // ── Date label / today changes ──
  const dateLabel = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date());

  const todayChanges: TodayChanges = {
    userChanges: [],
    staffChanges: [],
  };

  // ── Dashboard Summary ──
  const attendanceCounts = useAttendanceCounts(today);

  const summary = useDashboardSummary({
    users,
    today,
    currentMonth,
    visits,
    staff,
    attendanceCounts,
    generateMockActivityRecords,
  });

  // summary はグループごと返すので、ここでは VM 構築に必要なフィールドのみ展開
  const {
    usageMap,
    stats,
    attendanceSummary,
    dailyRecordStatus,
    briefingAlerts,
  } = summary;

  // ── Dev logging ──
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.debug('[usageMap]', currentMonth, usageMap);
    }
  }, [usageMap, currentMonth]);

  // ── ViewModel ──
  const vm = useDashboardViewModel({
    role: audience,
    summary: {
      attendanceSummary,
      dailyRecordStatus,
      stats,
      handoff: {
        total: handoffTotal,
        byStatus: handoffStatus,
        critical: handoffCritical,
      },
      timing: { isMorningTime, isEveningTime },
      briefingAlerts,
    },
  });

  // ── Daily status cards ──
  const dailyStatusCards: DailyStatusCard[] = [
    {
      label: '未入力',
      value: dailyRecordStatus.pending,
      helper: `対象 ${dailyRecordStatus.total}名`,
      color: 'error.main',
      emphasize: true,
    },
    {
      label: '入力途中',
      value: dailyRecordStatus.inProgress,
      helper: `対象 ${dailyRecordStatus.total}名`,
      color: 'warning.main',
    },
    {
      label: '完了',
      value: dailyRecordStatus.completed,
      helper: `対象 ${dailyRecordStatus.total}名`,
      color: 'text.secondary',
    },
  ];

  // ── Tab guard ──
  const handleTabChange = useCallback(
    (_: React.SyntheticEvent, newValue: number) => {
      setTabValue(newValue);
    },
    [],
  );

  useEffect(() => {
    if (!canAccessDashboardAudience(vm.role, 'admin')) return;
    const maxIndex = ADMIN_TABS.length - 1;
    if (tabValue > maxIndex) {
      setTabValue(0);
    }
  }, [vm.role, tabValue]);

  // ── Cleanup ──
  useEffect(() => () => {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
  }, []);

  return {
    nav: {
      navigate,
      openTimeline,
      openBriefing,
      layoutMode,
      schedulesEnabled,
    },
    ui: {
      tabValue,
      handleTabChange,
      showAttendanceNames,
      setShowAttendanceNames,
      highlightSection,
      scrollToSection,
      sectionIdByKey,
      dateLabel,
      todayChanges,
      dailyStatusCards,
      isMorningTime,
      isEveningTime,
      users,
      visits,
    },
    vm,
    summary,
    handoff: {
      total: handoffTotal,
      critical: handoffCritical,
      status: handoffStatus,
      timeline: {
        items: handoffTimelineItems,
        loading: handoffTimelineLoading,
        error: handoffTimelineError,
        updateStatus: handoffTimelineUpdateStatus,
        reload: handoffTimelineReload,
      },
    },
  };
}

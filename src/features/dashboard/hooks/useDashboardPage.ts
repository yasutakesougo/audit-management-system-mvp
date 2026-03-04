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
import type { HandoffDayScope } from '@/features/handoff/handoffTypes';
import { useHandoffSummary } from '@/features/handoff/useHandoffSummary';
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

// ── 戻り値の型 ──
export interface UseDashboardPageReturn {
  // Navigation
  navigate: ReturnType<typeof useNavigate>;
  openTimeline: (scope?: HandoffDayScope) => void;
  openBriefing: () => void;

  // Layout
  layoutMode: DashboardLayoutMode;

  // Feature flags
  schedulesEnabled: boolean;

  // UI State
  tabValue: number;
  handleTabChange: (_: React.SyntheticEvent, newValue: number) => void;
  showAttendanceNames: boolean;
  setShowAttendanceNames: React.Dispatch<React.SetStateAction<boolean>>;
  highlightSection: DashboardSectionKey | null;

  // Scroll & anchor
  scrollToSection: (sectionKeyOrAnchorId: DashboardSectionKey | string) => void;
  sectionIdByKey: Record<DashboardSectionKey, string>;

  // View data
  dateLabel: string;
  todayChanges: TodayChanges;

  // ViewModel
  vm: DashboardViewModel<unknown>;

  // Summary values (needed by section props / tabs)
  attendanceSummary: ReturnType<typeof useDashboardSummary>['attendanceSummary'];
  dailyRecordStatus: ReturnType<typeof useDashboardSummary>['dailyRecordStatus'];
  stats: ReturnType<typeof useDashboardSummary>['stats'];
  scheduleLanesToday: ReturnType<typeof useDashboardSummary>['scheduleLanesToday'];
  scheduleLanesTomorrow: ReturnType<typeof useDashboardSummary>['scheduleLanesTomorrow'];
  prioritizedUsers: ReturnType<typeof useDashboardSummary>['prioritizedUsers'];
  intensiveSupportUsers: ReturnType<typeof useDashboardSummary>['intensiveSupportUsers'];
  staffAvailability: ReturnType<typeof useDashboardSummary>['staffAvailability'];
  usageMap: ReturnType<typeof useDashboardSummary>['usageMap'];

  // Handoff
  handoffTotal: number;
  handoffCritical: number;
  handoffStatus: Record<string, number>;

  // Timing
  isMorningTime: boolean;
  isEveningTime: boolean;

  // Domain data
  users: ReturnType<typeof useUsersDemo>['data'];
  visits: ReturnType<typeof useAttendanceStore>['visits'];

  // Daily status cards
  dailyStatusCards: DailyStatusCard[];
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

  const {
    usageMap,
    stats,
    attendanceSummary,
    dailyRecordStatus,
    scheduleLanesToday,
    scheduleLanesTomorrow,
    prioritizedUsers,
    intensiveSupportUsers,
    briefingAlerts,
    staffAvailability,
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
    navigate,
    openTimeline,
    openBriefing,
    layoutMode,
    schedulesEnabled,
    tabValue,
    handleTabChange,
    showAttendanceNames,
    setShowAttendanceNames,
    highlightSection,
    scrollToSection,
    sectionIdByKey,
    dateLabel,
    todayChanges,
    vm,
    attendanceSummary,
    dailyRecordStatus,
    stats,
    scheduleLanesToday,
    scheduleLanesTomorrow,
    prioritizedUsers,
    intensiveSupportUsers,
    staffAvailability,
    usageMap,
    handoffTotal,
    handoffCritical,
    handoffStatus,
    isMorningTime,
    isEveningTime,
    users,
    visits,
    dailyStatusCards,
  };
}

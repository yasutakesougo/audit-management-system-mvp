/**
 * useDashboardUIState — タブ、スクロール、ハイライト、日付ラベル、日次ステータスカード
 *
 * 依存: dailyRecordStatus (引数), role (引数)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { canAccessDashboardAudience, type DashboardAudience } from '@/features/auth/store';
import type { LifeSupportSummary, TodayChanges } from '@/features/dashboard/components/TodayChangesCard';
import { getDashboardAnchorIdByKey } from '@/features/dashboard/sections/buildSections';
import type { DashboardSectionKey } from '@/features/dashboard/sections/types';
import type { useAttendanceStore } from '@/features/attendance/store';
import type { IUserMaster } from '@/features/users/types';

/** useAttendanceStore の visits 型を推論で取得 */
type Visits = ReturnType<typeof useAttendanceStore>['visits'];

// ── 定数 ──
const ADMIN_TABS = [
  { label: '集団傾向分析' },
  { label: '利用状況' },
  { label: '問題行動サマリー' },
  { label: '医療・健康情報' },
  { label: '個別支援記録' },
] as const;

export interface DailyStatusCard {
  label: string;
  value: number;
  helper: string;
  color: string;
  emphasize?: boolean;
}

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
  lifeSupport: LifeSupportSummary;
  dailyStatusCards: DailyStatusCard[];
  isMorningTime: boolean;
  isEveningTime: boolean;
  users: IUserMaster[];
  visits: Visits;
}

interface DailyRecordStatus {
  pending: number;
  inProgress: number;
  completed: number;
  total: number;
}

export function useDashboardUIState(
  role: DashboardAudience,
  dailyRecordStatus: DailyRecordStatus,
  users: IUserMaster[],
  visits: Visits,
): DashboardUIGroup {
  // ── UI State ──
  const [tabValue, setTabValue] = useState(0);
  const [showAttendanceNames, setShowAttendanceNames] = useState(false);
  const [highlightSection, setHighlightSection] = useState<DashboardSectionKey | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  // ── Time calculations ──
  const currentHour = new Date().getHours();
  const isMorningTime = currentHour >= 8 && currentHour < 12;
  const isEveningTime = currentHour >= 17 && currentHour < 19;

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

  // ── Life Support: visits から SS / 一時ケアの件数を算出 ──
  const lifeSupport: LifeSupportSummary = (() => {
    let shortStayCount = 0;
    let temporaryCareCount = 0;
    for (const v of Object.values(visits)) {
      if (v.transportToMethod === 'short_stay' || v.transportFromMethod === 'short_stay') {
        shortStayCount++;
      }
      if (v.transportToMethod === 'temporary_care' || v.transportFromMethod === 'temporary_care') {
        temporaryCareCount++;
      }
    }
    return { shortStayCount, temporaryCareCount };
  })();

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
    if (!canAccessDashboardAudience(role, 'admin')) return;
    const maxIndex = ADMIN_TABS.length - 1;
    if (tabValue > maxIndex) {
      setTabValue(0);
    }
  }, [role, tabValue]);

  // ── Cleanup ──
  useEffect(() => () => {
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
  }, []);

  return {
    tabValue,
    handleTabChange,
    showAttendanceNames,
    setShowAttendanceNames,
    highlightSection,
    scrollToSection,
    sectionIdByKey,
    dateLabel,
    todayChanges,
    lifeSupport,
    dailyStatusCards,
    isMorningTime,
    isEveningTime,
    users,
    visits,
  };
}

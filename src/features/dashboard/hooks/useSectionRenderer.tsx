/**
 * useSectionRenderer — Bento Grid セクションの Props 構築 & 描画フック
 *
 * 責務:
 * - DashboardSectionKey ごとの Props マッピング（getSectionProps）
 * - Registry パターンによるコンポーネント取得と描画（renderSection）
 *
 * DashboardPage（Container）から呼ばれ、各 Section に型安全な Props を渡す。
 * JSX を返すため .tsx 拡張子を使用。
 */

import type { DailyStatusCard } from '@/features/dashboard/hooks/useDashboardPage';
import { getSectionComponent, type SectionProps } from '@/features/dashboard/sections/registry';
import type { AttendanceVisitSnapshot } from '@/features/dashboard/selectors/useAttendanceAnalytics';
import type { useDashboardSummary } from '@/features/dashboard/useDashboardSummary';
import type { DashboardRole, DashboardSection, DashboardSectionKey } from '@/features/dashboard/useDashboardViewModel';
import type { HandoffDayScope } from '@/features/handoff/handoffTypes';
import type { IUserMaster } from '@/sharepoint/fields';
import React, { useCallback } from 'react';

// ── 入力 Props ──
export interface UseSectionRendererParams {
  role: DashboardRole;

  // Summary (object ごと受け取り — バケツリレー解消)
  summary: ReturnType<typeof useDashboardSummary>;

  // UI state
  showAttendanceNames: boolean;
  setShowAttendanceNames: React.Dispatch<React.SetStateAction<boolean>>;
  tabValue: number;
  handleTabChange: (_: React.SyntheticEvent, newValue: number) => void;
  dailyStatusCards: DailyStatusCard[];

  // Feature flags
  schedulesEnabled: boolean;

  // Handoff
  handoffTotal: number;
  handoffCritical: number;
  handoffStatus: Record<string, number>;

  // Callbacks
  openTimeline: (scope?: HandoffDayScope) => void;

  // Timing
  isMorningTime: boolean;
  isEveningTime: boolean;

  // Domain data
  users: IUserMaster[];
  visits: Record<string, AttendanceVisitSnapshot>;
}

export interface UseSectionRendererReturn {
  renderSection: (section: DashboardSection) => React.ReactNode;
}

export function useSectionRenderer(params: UseSectionRendererParams): UseSectionRendererReturn {
  const {
    role,
    summary,
    showAttendanceNames,
    setShowAttendanceNames,
    tabValue,
    handleTabChange,
    dailyStatusCards,
    schedulesEnabled,
    handoffTotal,
    handoffCritical,
    handoffStatus,
    openTimeline,
    isMorningTime,
    isEveningTime,
    users,
    visits,
  } = params;

  // summary から描画に必要なフィールドを展開
  const {
    attendanceSummary,
    dailyRecordStatus,
    stats,
    scheduleLanesToday,
    scheduleLanesTomorrow,
    prioritizedUsers,
    intensiveSupportUsers,
    usageMap,
  } = summary;

  /**
   * セクションキーに基づいて、対応するコンポーネントに渡す props を生成する
   */
  const getSectionProps = useCallback(
    (key: DashboardSectionKey, section: DashboardSection): SectionProps[typeof key] => {
      switch (key) {
        case 'safety':
          return {};
        case 'attendance':
          return {
            attendanceSummary,
            showAttendanceNames,
            onToggleAttendanceNames: setShowAttendanceNames,
            visits,
          };
        case 'daily':
          return {
            dailyStatusCards,
            dailyRecordStatus,
          };
        case 'schedule':
          return {
            title: section.title,
            schedulesEnabled,
            scheduleLanesToday,
          };
        case 'handover':
          return {
            title: section.title ?? '申し送りタイムライン',
            handoffTotal,
            handoffCritical,
            handoffStatus,
            onOpenTimeline: openTimeline,
          };
        case 'stats':
          return {
            stats,
            intensiveSupportUsersCount: intensiveSupportUsers.length,
          };
        case 'adminOnly':
          return {
            tabValue,
            onTabChange: handleTabChange,
            stats,
            intensiveSupportUsers,
            activeUsers: users,
            usageMap,
          };
        case 'staffOnly':
          return {
            isMorningTime,
            isEveningTime,
            dailyStatusCards,
            prioritizedUsers,
            scheduleLanesToday,
            scheduleLanesTomorrow,
            stats,
            onOpenTimeline: openTimeline,
          };
        default:
          throw new Error(`Unhandled dashboard section key: ${section.key}`);
      }
    },
    [
      summary,
      showAttendanceNames,
      setShowAttendanceNames,
      dailyStatusCards,
      schedulesEnabled,
      handoffTotal,
      handoffCritical,
      handoffStatus,
      openTimeline,
      tabValue,
      handleTabChange,
      users,
      isMorningTime,
      isEveningTime,
      visits,
    ],
  );

  /**
   * Registry パターンでコンポーネントを取得して render する
   */
  const renderSection = useCallback(
    (section: DashboardSection): React.ReactNode => {
      // Role-based exclusion
      if (section.key === 'adminOnly' && role !== 'admin') return null;
      if (section.key === 'staffOnly' && role !== 'staff') return null;

      const SectionComponent = getSectionComponent(section.key);
      const props = getSectionProps(section.key, section);

      return <SectionComponent {...props} />;
    },
    [getSectionProps, role],
  );

  return { renderSection };
}

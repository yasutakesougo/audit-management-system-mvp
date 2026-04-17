/**
 * Dashboard Summary Hook (Phase 3A: Logic Move Only)
 *
 * Consolidates 7 useMemo blocks from DashboardPage.tsx into a single hook.
 * IMPORTANT: This is a DIRECT COPY of the original useMemo blocks.
 * No logic changes, no type redefinitions. Uses existing domain types only.
 */

import { useMemo } from 'react';
import type { IUserMaster } from '@/sharepoint/fields';
import type { PersonDaily } from '@/domain/daily/types';
import type { Staff } from '@/types';
import type { AttendanceCounts } from '@/features/staff/attendance/port';
import type { BriefingAlert } from '@/features/dashboard/sections/types';
import { useAttendanceAnalytics } from '@/features/dashboard/selectors/useAttendanceAnalytics';
import type { AttendanceVisitSnapshot } from '@/features/dashboard/selectors/useAttendanceAnalytics';
import { calculateUsageFromDailyRecords } from '@/features/users/userMasterDashboardUtils';
import { startFeatureSpan, estimatePayloadSize, HYDRATION_FEATURES } from '@/hydration/features';
import { calculateStaffAvailability } from './staffAvailability';
import type { StaffAvailability, StaffAssignment } from './staffAvailability';

export interface ScheduleSummaryItem {
  id: string;
  time: string;
  title: string;
  location?: string;
  owner?: string;
}

type ScheduleItem = ScheduleSummaryItem;

/**
 * Dashboard input data (grouped for clarity)
 */
export interface DashboardInputData {
  users: IUserMaster[];
  staff: Staff[];
  visits: Record<string, AttendanceVisitSnapshot>;
  attendanceCounts: AttendanceCounts;
  spSyncStatus?: {
    spLane: string | null;
  };
}

/**
 * Dashboard temporal data (date/period information)
 */
export interface DashboardTemporalData {
  today: string;
  currentMonth: string;
}

/**
 * Dashboard data generators (functions/callbacks)
 */
export interface DashboardGenerators {
  generateMockActivityRecords: (users: IUserMaster[], today: string) => PersonDaily[];
}

/**
 * Arguments for useDashboardSummary hook
 * Grouped for readability: entity data, temporal data, generators
 */
export interface UseDashboardSummaryArgs extends DashboardInputData, DashboardTemporalData, DashboardGenerators {}

/**
 * Return type: combines all 7 useMemo outputs
 * Keys match DashboardPage variable names exactly
 */
export interface DashboardSummary {
  activityRecords: PersonDaily[];
  usageMap: Record<string, unknown>;
  stats: {
    totalUsers: number;
    recordedUsers: number;
    completionRate: number;
    problemBehaviorStats: Record<string, number>;
    seizureCount: number;
    lunchStats: Record<string, number>;
  };
  attendanceSummary: ReturnType<typeof useAttendanceAnalytics>['attendanceSummary'];
  dailyRecordStatus: {
    pending: number;
    inProgress: number;
    completed: number;
    total: number;
    pendingUserIds: string[];
  };
  scheduleLanesToday: {
    userLane: ScheduleSummaryItem[];
    staffLane: ScheduleSummaryItem[];
    organizationLane: ScheduleSummaryItem[];
  };
  scheduleLanesTomorrow: {
    userLane: ScheduleSummaryItem[];
    staffLane: ScheduleSummaryItem[];
    organizationLane: ScheduleSummaryItem[];
  };
  prioritizedUsers: IUserMaster[];
  intensiveSupportUsers: IUserMaster[];
  briefingAlerts: BriefingAlert[];  // ✨ 朝会用アラート
  staffAvailability: StaffAvailability[];  // ✨ 職員フリー状態
  monitoringHub: {
    spLane: string | null;
  };
}

/**
 * useDashboardSummary — Centralized Domain Aggregation for Dashboard
 *
 * Features:
 * - Direct Logic Migration (Phase 3A)
 * - Built-in Performance Profiling
 * - Structured Span Tracing (Hydration)
 */
export function useDashboardSummary(args: UseDashboardSummaryArgs): DashboardSummary {
  const {
    users,
    today,
    currentMonth,
    visits,
    staff,
    attendanceCounts,
    generateMockActivityRecords,
    spSyncStatus,
  } = args;

  // DEV-only perf profiling setup (gated by localStorage.debug = 'dashboard:perf')
  const perfEnabled = typeof window !== 'undefined' && localStorage.getItem('debug')?.includes('dashboard:perf');
  const perfMark = (name: string) => perfEnabled && performance.mark(`${name}-start`);
  const perfMeasure = (name: string) => perfEnabled && performance.measure(name, `${name}-start`);

  perfMark('useDashboardSummary-start');

  // ============================================================================
  // 1. Activity Records (original: line 163-177)
  // ============================================================================
  perfMark('activityRecords-calc');
  const activityRecords = useMemo(() => {
    return generateMockActivityRecords(users, today);
  }, [users, today, generateMockActivityRecords]);
  perfMeasure('activityRecords-calc');

  // ============================================================================
  // 2. Usage Map (original: line 319-351)
  // ============================================================================
  perfMark('usageMap-calc');
  const usageMap = useMemo(() => {
    const span = startFeatureSpan(HYDRATION_FEATURES.dashboard.usageAggregation, {
      status: 'pending',
      month: currentMonth,
    });
    try {
      const map = calculateUsageFromDailyRecords(activityRecords, users, currentMonth, {
        userKey: (record) => String(record.userId ?? ''),
        dateKey: (record) => record.date ?? '',
        countRule: (record) => record.status === '完了',
      });
      const entryCount = map && typeof map === 'object'
        ? Object.keys(map as Record<string, unknown>).length
        : 0;
      span({
        meta: {
          status: 'ok',
          entries: entryCount,
          bytes: estimatePayloadSize(map),
        },
      });
      return map;
    } catch (error) {
      span({
        meta: { status: 'error' },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [activityRecords, users, currentMonth]);
  perfMeasure('usageMap-calc');

  // ============================================================================
  // 3. Intensive Support Users (original: line 361-362)
  // ============================================================================
  perfMark('intensiveSupportUsers-calc');
  const intensiveSupportUsers = useMemo(
    () => users.filter(user => user.IsSupportProcedureTarget),
    [users],
  );
  perfMeasure('intensiveSupportUsers-calc');

  // ============================================================================
  // 4. Stats (original: line 364-399)
  // ============================================================================
  perfMark('stats-calc');
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const recordedUsers = activityRecords.filter(r => r.status === '完了').length;
    const completionRate = totalUsers > 0 ? (recordedUsers / totalUsers) * 100 : 0;

    // 問題行動統計
    const problemBehaviorStats = activityRecords.reduce((acc, record) => {
      const pb = record.data.problemBehavior;
      if (pb) {
        if (pb.selfHarm) acc.selfHarm++;
        if (pb.otherInjury) acc.violence++;
        if (pb.loudVoice) acc.loudVoice++;
        if (pb.pica) acc.pica++;
        if (pb.other) acc.other++;
      }
      return acc;
    }, { selfHarm: 0, violence: 0, loudVoice: 0, pica: 0, other: 0 } as Record<string, number>);

    // 発作統計
    const seizureCount = activityRecords.filter(r =>
      r.data.seizureRecord && r.data.seizureRecord.occurred
    ).length;

    // 昼食摂取統計
    const lunchStats = activityRecords.reduce((acc, record) => {
      const amount = record.data.mealAmount || 'なし';
      acc[amount] = (acc[amount] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalUsers,
      recordedUsers,
      completionRate,
      problemBehaviorStats,
      seizureCount,
      lunchStats
    };
  }, [users, activityRecords]);
  perfMeasure('stats-calc');

  // ============================================================================
  // 5. Attendance Analytics Selector (Consolidated from manual logic)
  // ============================================================================
  const { attendanceSummary, briefingAlerts: analyticsAlerts } = useAttendanceAnalytics(
    users,
    staff,
    visits,
    attendanceCounts,
  );

  // ============================================================================
  // 6. Daily Record Status (original: line 460-472)
  // ============================================================================
  perfMark('dailyRecordStatus-calc');
  const dailyRecordStatus = useMemo(() => {
    const completed = activityRecords.filter(r => r.status === '完了');
    const inProgress = activityRecords.filter(r => r.status === '作成中');
    const completedUserIds = new Set(completed.map(r => r.userId));
    
    const pendingUserIds = users
      .map(u => String(u.UserID || ''))
      .filter(id => id && !completedUserIds.has(id));

    return {
      pending: pendingUserIds.length,
      inProgress: inProgress.length,
      completed: completed.length,
      total: users.length,
      pendingUserIds,
    };
  }, [activityRecords, users]);
  perfMeasure('dailyRecordStatus-calc');

  // ============================================================================
  // 7. Schedule Lanes (original: line 501-571)
  perfMark('scheduleLanes-calc');
  const [scheduleLanesToday, scheduleLanesTomorrow] = useMemo<[
    { userLane: ScheduleSummaryItem[]; staffLane: ScheduleSummaryItem[]; organizationLane: ScheduleSummaryItem[] },
    { userLane: ScheduleSummaryItem[]; staffLane: ScheduleSummaryItem[]; organizationLane: ScheduleSummaryItem[] },
  ]>(() => {
    const baseUserLane = users.slice(0, 3).map((user, index) => ({
      id: `user-${index}`,
      time: `${(9 + index).toString().padStart(2, '0')}:00`,
      title: `${user.FullName ?? `利用者${index + 1}`} ${['作業プログラム', '個別支援', 'リハビリ'][index % 3]}`,
      location: ['作業室A', '相談室1', '療育室'][index % 3],
    }));
    const baseStaffLane = [
      { id: 'staff-1', time: '08:45', title: '職員朝会 / 申し送り確認', owner: '生活支援課' },
      { id: 'staff-2', time: '11:30', title: '通所記録レビュー', owner: '管理責任者' },
      { id: 'staff-3', time: '15:30', title: '支援手順フィードバック会議', owner: '専門職チーム' },
    ];
    const baseOrganizationLane: ScheduleItem[] = [
      { id: 'org-1', time: '10:00', title: '自治体監査ヒアリング', owner: '法人本部' },
      { id: 'org-2', time: '13:30', title: '家族向け連絡会資料確認', owner: '連携推進室' },
      { id: 'org-3', time: '16:00', title: '設備点検結果共有', owner: '施設管理' },
    ];

    const todayLanes = {
      userLane: baseUserLane,
      staffLane: baseStaffLane,
      organizationLane: baseOrganizationLane,
    };

    const tomorrowLanes = {
      userLane: baseUserLane,
      staffLane: baseStaffLane,
      organizationLane: baseOrganizationLane,
    };

    return [todayLanes, tomorrowLanes];
  }, [users]);
  perfMeasure('scheduleLanes-calc');

  // ============================================================================
  // 8. Prioritized Users (original: line 573)
  // ============================================================================
  perfMark('prioritizedUsers-calc');
  const prioritizedUsers = useMemo(() => intensiveSupportUsers.slice(0, 3), [intensiveSupportUsers]);
  perfMeasure('prioritizedUsers-calc');

  // ============================================================================
  // 9. Briefing Alerts (Combining Analytics + Domain)
  // ============================================================================
  perfMark('briefingAlerts-calc');
  const briefingAlerts = useMemo<BriefingAlert[]>(() => {
    const alerts: BriefingAlert[] = [...analyticsAlerts];

    // 3️⃣ 健康懸念アラート (Intensive Support)
    if (intensiveSupportUsers.length > 0) {
      alerts.push({
        id: 'health_concern',
        type: 'health_concern',
        severity: 'info',
        label: 'ケア要注視',
        count: intensiveSupportUsers.length,
        targetAnchorId: 'sec-safety',
        description: intensiveSupportUsers.slice(0, 2).map(u => u.FullName).join('、'),
      });
    }

    // 4️⃣ 安全・発作報告アラート
    const problemBehaviorTotal = Object.values(stats.problemBehaviorStats || {})
      .reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    if (problemBehaviorTotal > 0 || stats.seizureCount > 0) {
      alerts.push({
        id: 'critical_safety',
        type: 'critical_safety',
        severity: stats.seizureCount > 0 ? 'error' : 'warning',
        label: stats.seizureCount > 0 ? '発作報告あり' : '問題行動',
        count: stats.seizureCount > 0 ? stats.seizureCount : problemBehaviorTotal,
        targetAnchorId: 'sec-safety',
      });
    }

    return alerts;
  }, [analyticsAlerts, intensiveSupportUsers, stats]);
  perfMeasure('briefingAlerts-calc');

  // ============================================================================
  // 10. Staff Availability Calculation (Phase B)
  // ============================================================================
  perfMeasure('staffAvailability-calc');
  const staffAvailability = useMemo(() => {
    // scheduleLanesToday.staffLane から StaffAssignment を生成
    const assignments: StaffAssignment[] = scheduleLanesToday.staffLane.map((item) => {
      const [startTime, endTime] = item.time.split('-').map(t => t.trim());
      return {
        userId: item.id,
        userName: item.title,
        role: 'main',  // TODO: 実データから判定（現状はメイン担当と仮定）
        startTime,
        endTime: endTime ?? '18:00',
      };
    });

    // 現在時刻を "HH:MM" 形式で取得
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return calculateStaffAvailability(staff, assignments, currentTime);
  }, [staff, scheduleLanesToday.staffLane]);
  perfMeasure('staffAvailability-calc');

  // ============================================================================
  // Return consolidated summary
  // ============================================================================
  perfMeasure('useDashboardSummary-start');

  return useMemo(() => ({
    activityRecords,
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
    monitoringHub: {
      spLane: spSyncStatus?.spLane ?? 'N/A',
    },
  }), [
    activityRecords,
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
    spSyncStatus,
  ]);
}

/**
 * Dashboard Summary Hook (Phase 3A: Logic Move Only)
 *
 * Consolidates useMemo blocks from DashboardPage.tsx into a single hook.
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
import type { StaffAssignment } from './staffAvailability';

export interface ScheduleSummaryItem {
  id: string;
  time: string;
  title: string;
  location?: string;
  owner?: string;
}

export interface HubSyncStatus {
  spLane: string | null;
}

/**
 * useDashboardSummary — Centralized Domain Aggregation for Dashboard
 */
export function useDashboardSummary(args: {
  users: IUserMaster[];
  staff: Staff[];
  visits: Record<string, AttendanceVisitSnapshot>;
  today: string;
  currentMonth: string;
  generateMockActivityRecords: (users: IUserMaster[], date: string) => PersonDaily[];
  attendanceCounts: AttendanceCounts;
  spSyncStatus?: HubSyncStatus;
}) {
  const {
    users,
    staff,
    visits,
    today,
    currentMonth,
    generateMockActivityRecords,
    attendanceCounts,
    spSyncStatus,
  } = args;

  // Normalize inputs: prevent Object.values(undefined) crash during initial render
  const safeVisits = visits ?? {};
  
  // 1. Activity & Usage
  const activityRecords = useMemo(() => {
    return generateMockActivityRecords(users, today);
  }, [users, today, generateMockActivityRecords]);

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
      span({
        meta: {
          status: 'ok',
          entries: map ? Object.keys(map).length : 0,
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

  const intensiveSupportUsers = useMemo(
    () => users.filter(user => user.IsSupportProcedureTarget),
    [users],
  );

  // 2. Stats
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const recordedUsers = activityRecords.filter(r => r.status === '完了').length;
    const completionRate = totalUsers > 0 ? (recordedUsers / totalUsers) * 100 : 0;

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

    const seizureCount = activityRecords.filter(r =>
      r.data.seizureRecord && r.data.seizureRecord.occurred
    ).length;

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

  // 3. Attendance Analytics
  const { attendanceSummary, briefingAlerts: analyticsAlerts } = useAttendanceAnalytics(
    users,
    staff,
    safeVisits,
    attendanceCounts,
  );

  // 4. Daily Record Status
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

  // 5. Schedule Lanes
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
    const baseOrganizationLane = [
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

  const prioritizedUsers = useMemo(() => intensiveSupportUsers.slice(0, 3), [intensiveSupportUsers]);

  // 6. Briefing Alerts
  const briefingAlerts = useMemo<BriefingAlert[]>(() => {
    const alerts: BriefingAlert[] = [...analyticsAlerts];

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

  // 7. Staff Availability
  const staffAvailability = useMemo(() => {
    const assignments: StaffAssignment[] = scheduleLanesToday.staffLane.map((item) => {
      const parts = item.time.split('-');
      const startTime = parts[0]?.trim();
      const endTime = parts[1]?.trim();
      return {
        userId: item.id,
        userName: item.title,
        role: 'main',
        startTime,
        endTime: endTime ?? '18:00',
      };
    });

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return calculateStaffAvailability(staff, assignments, currentTime);
  }, [staff, scheduleLanesToday.staffLane]);

  const monitoringHub = useMemo(() => ({
    spLane: spSyncStatus?.spLane ?? 'N/A',
  }), [spSyncStatus]);

  return useMemo(
    () => ({
      activityRecords,
      usageMap,
      intensiveSupportUsers,
      stats,
      attendanceSummary,
      dailyRecordStatus,
      scheduleLanesToday,
      scheduleLanesTomorrow,
      prioritizedUsers,
      briefingAlerts,
      staffAvailability,
      monitoringHub,
    }),
    [
      activityRecords,
      usageMap,
      intensiveSupportUsers,
      stats,
      attendanceSummary,
      dailyRecordStatus,
      scheduleLanesToday,
      scheduleLanesTomorrow,
      prioritizedUsers,
      briefingAlerts,
      staffAvailability,
      monitoringHub,
    ],
  );
}

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
import { calculateUsageFromDailyRecords } from '@/features/users/userMasterDashboardUtils';
import { startFeatureSpan, estimatePayloadSize, HYDRATION_FEATURES } from '@/hydration/features';

// Attendance visit type
type AttendanceVisitSnapshot = {
  userCode: string;
  status: string;
  providedMinutes?: number;
  isEarlyLeave?: boolean;
};

/**
 * Dashboard input data (grouped for clarity)
 */
export interface DashboardInputData {
  users: IUserMaster[];
  staff: Staff[];
  visits: Record<string, AttendanceVisitSnapshot>;
  attendanceCounts: AttendanceCounts;
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
  attendanceSummary: {
    facilityAttendees: number;
    lateOrEarlyLeave: number;
    lateOrEarlyNames: string[];
    absenceCount: number;
    absenceNames: string[];
    onDutyStaff: number;
    lateOrShiftAdjust: number;
    outStaff: number;
    outStaffNames: string[];
  };
  dailyRecordStatus: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
  };
  scheduleLanesToday: {
    userLane: Array<{ id: string; time: string; title: string; location?: string }>;
    staffLane: Array<{ id: string; time: string; title: string; owner?: string }>;
    organizationLane: Array<{ id: string; time: string; title: string; owner?: string }>;
  };
  scheduleLanesTomorrow: {
    userLane: Array<{ id: string; time: string; title: string; location?: string }>;
    staffLane: Array<{ id: string; time: string; title: string; owner?: string }>;
    organizationLane: Array<{ id: string; time: string; title: string; owner?: string }>;
  };
  prioritizedUsers: IUserMaster[];
  intensiveSupportUsers: IUserMaster[];
}

/**
 * Main hook: consolidates 7 useMemo blocks from DashboardPage
 * Returns DashboardSummary with all original variable names
 *
 * Performance profiling (DEV only):
 * Set localStorage.debug = 'dashboard:perf' to see computation times
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
  } = args;

  // DEV-only perf profiling setup (Vite optimized)
  // import.meta.env.DEV is tree-shaken in production
  const isDevProfiling = import.meta.env.DEV
    && typeof localStorage !== 'undefined'
    && localStorage.getItem('debug')?.includes('dashboard:perf');

  const perfMark = (label: string) => {
    if (isDevProfiling) {
      performance.mark(label);
    }
  };

  const perfMeasure = (label: string) => {
    if (isDevProfiling && performance.getEntriesByName(label).length > 0) {
      try {
        performance.measure(`${label}-duration`, label);
        const duration = performance.getEntriesByName(`${label}-duration`)[0]?.duration || 0;
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug(
            `[Dashboard Perf] ${label}: ${duration.toFixed(2)}ms`,
          );
        }
        performance.clearMarks(label);
        performance.clearMeasures(`${label}-duration`);
      } catch {
        // silently ignore perf API errors
      }
    }
  };

  perfMark('useDashboardSummary-start');

  // ============================================================================
  // 1. Activity Records (original: line 292-315)
  // ============================================================================
  perfMark('activityRecords-calc');
  const activityRecords = useMemo(() => {
    const span = startFeatureSpan(HYDRATION_FEATURES.dashboard.activityModel, {
      status: 'pending',
      users: users.length,
    });
    try {
      const records = generateMockActivityRecords(users, today);
      span({
        meta: {
          status: 'ok',
          recordCount: records.length,
          bytes: estimatePayloadSize(records),
        },
      });
      return records;
    } catch (error) {
      span({
        meta: { status: 'error' },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
        userKey: (record) => String(record.personId ?? ''),
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
        if (pb.violence) acc.violence++;
        if (pb.loudVoice) acc.loudVoice++;
        if (pb.pica) acc.pica++;
        if (pb.other) acc.other++;
      }
      return acc;
    }, { selfHarm: 0, violence: 0, loudVoice: 0, pica: 0, other: 0 });

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
  // 5. Attendance Summary (original: line 401-458)
  // ============================================================================
  perfMark('attendanceSummary-calc');
  const attendanceSummary = useMemo(() => {
    const visitList = Object.values(visits);
    const userCodeMap = new Map<string, string>();

    users.forEach((user, index) => {
      const userCode = (user.UserID ?? '').trim() || `U${String(user.Id ?? index + 1).padStart(3, '0')}`;
      const displayName = user.FullName ?? `利用者${index + 1}`;
      userCodeMap.set(userCode, displayName);
    });

    const facilityAttendees = visitList.filter(
      (visit) => visit.status === '通所中' || visit.status === '退所済'
    ).length;

    const lateOrEarlyVisits = visitList.filter((visit) => visit.isEarlyLeave === true);
    const lateOrEarlyLeave = lateOrEarlyVisits.length;
    const lateOrEarlyNames = Array.from(
      new Set(
        lateOrEarlyVisits
          .map((visit) => userCodeMap.get(visit.userCode))
          .filter((name): name is string => Boolean(name))
      )
    );
    const absenceVisits = visitList.filter((visit) => visit.status === '当日欠席' || visit.status === '事前欠席');
    const absenceNames = Array.from(
      new Set(
        absenceVisits
          .map((visit) => userCodeMap.get(visit.userCode))
          .filter((name): name is string => Boolean(name))
      )
    );
    const absenceCount = absenceVisits.length;

    // Get actual staff attendance via port (Phase 3.1-C)
    const onDutyStaff = attendanceCounts.onDuty;

    // Fallback to demo data if no attendance records yet
    const staffCount = staff.length || 0;
    const estimatedOnDutyStaff = Math.max(0, Math.round(staffCount * 0.6));
    const finalOnDutyStaff = onDutyStaff > 0 ? onDutyStaff : estimatedOnDutyStaff;

    const lateOrShiftAdjust = Math.max(0, Math.round(finalOnDutyStaff * 0.15));
    const outStaff = Math.max(0, Math.round(finalOnDutyStaff * 0.2));
    const outStaffNames = staff.slice(0, outStaff).map((member, index) => {
      return member?.name ?? member?.staffId ?? `職員${index + 1}`;
    });

    return {
      facilityAttendees,
      lateOrEarlyLeave,
      lateOrEarlyNames,
      absenceCount,
      absenceNames,
      onDutyStaff: finalOnDutyStaff,
      lateOrShiftAdjust,
      outStaff,
      outStaffNames,
    };
  }, [attendanceCounts, staff.length, users, visits]);
  perfMeasure('attendanceSummary-calc');

  // ============================================================================
  // 6. Daily Record Status (original: line 460-472)
  // ============================================================================
  perfMark('dailyRecordStatus-calc');
  const dailyRecordStatus = useMemo(() => {
    const total = users.length;
    const completed = activityRecords.filter((record) => record.status === '完了').length;
    const inProgress = activityRecords.filter((record) => record.status === '作成中').length;
    const pending = Math.max(total - completed - inProgress, 0);

    return {
      total,
      pending,
      inProgress,
      completed,
    };
  }, [activityRecords, users.length]);
  perfMeasure('dailyRecordStatus-calc');

  // ============================================================================
  // 7. Schedule Lanes (original: line 501-571)
  // ============================================================================
  perfMark('scheduleLanes-calc');
  type ScheduleItem = {
    id: string;
    time: string;
    title: string;
    location?: string;
    owner?: string;
  };

  const [scheduleLanesToday, scheduleLanesTomorrow] = useMemo<[
    { userLane: ScheduleItem[]; staffLane: ScheduleItem[]; organizationLane: ScheduleItem[] },
    { userLane: ScheduleItem[]; staffLane: ScheduleItem[]; organizationLane: ScheduleItem[] },
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

    const today = {
      userLane: baseUserLane,
      staffLane: baseStaffLane,
      organizationLane: baseOrganizationLane,
    };

    const tomorrow = {
      userLane: baseUserLane,
      staffLane: baseStaffLane,
      organizationLane: baseOrganizationLane,
    };

    return [today, tomorrow];
  }, [users]);
  perfMeasure('scheduleLanes-calc');

  // ============================================================================
  // 8. Prioritized Users (original: line 573)
  // ============================================================================
  perfMark('prioritizedUsers-calc');
  const prioritizedUsers = useMemo(() => intensiveSupportUsers.slice(0, 3), [intensiveSupportUsers]);
  perfMeasure('prioritizedUsers-calc');

  // ============================================================================
  // Return consolidated summary
  // ============================================================================
  perfMeasure('useDashboardSummary-start');

  return {
    activityRecords,
    usageMap,
    stats,
    attendanceSummary,
    dailyRecordStatus,
    scheduleLanesToday,
    scheduleLanesTomorrow,
    prioritizedUsers,
    intensiveSupportUsers,
  };
}

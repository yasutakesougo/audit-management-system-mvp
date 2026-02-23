/**
 * Dashboard Summary Hook
 * 
 * DashboardPage の useMemo 群を集約し、計算ロジックを分離。
 * 
 * Purpose:
 * - ViewModel への入力を1箇所で生成
 * - Page の肥大化を防ぐ
 * - 集計ロジックの単体テスト可能化
 * 
 * Phase 3: Summary Hook化（ロジックリファクタ）
 */

import { useMemo } from 'react';
import type { IUserMaster } from '@/sharepoint/fields';
import type { PersonDaily } from '@/domain/daily/types';
import type { Staff } from '@/types';
import type { AttendanceCounts } from '@/features/staff/attendance/port';
import { calculateUsageFromDailyRecords } from '@/features/users/userMasterDashboardUtils';

// ============================================================================
// Types (DashboardPage から移植)
// ============================================================================

export type ActivityRecord = {
  personId: number | string;
  date: string;
  status: '未着手' | '作成中' | '完了';
  data: {
    amActivities: string[];
    pmActivities: string[];
    amNotes: string;
    pmNotes: string;
    mealAmount: PersonDaily['data']['mealAmount'];
    problemBehavior: {
      selfHarm: boolean;
      violence: boolean;
      loudVoice: boolean;
      pica: boolean;
      other: boolean;
      otherDetail?: string;
    };
    seizureRecord: {
      occurred: boolean;
      time?: string;
      duration?: string;
      severity?: 'レ軽度' | '中等度' | '重度';
      notes?: string;
    };
    specialNotes: string;
  };
};

export type VisitRecord = {
  date: string;
  attendees: number;
  lateCount: number;
  earlyLeaveCount: number;
  absenceCount: number;
};

export type ScheduleItem = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  staffIds: string[];
};

export type ScheduleLanes = {
  schedule: ScheduleItem[];
  byHour: Record<number, ScheduleItem[]>;
};

export type DashboardStats = {
  totalUsers: number;
  recordedUsers: number;
  completionRate: number;
  problemBehavior: number;
  seizures: number;
  lunch: number;
};

export type AttendanceSummaryData = {
  facilityAttendees: number;
  lateCount: number;
  earlyLeaveCount: number;
  absenceCount: number;
  staffOnDuty: number;
};

export type DailyRecordStatus = {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
};

export type DashboardSummary = {
  activityRecords: ActivityRecord[];
  usageMap: Record<string, unknown>;
  stats: DashboardStats;
  attendanceSummary: AttendanceSummaryData;
  dailyRecordStatus: DailyRecordStatus;
  scheduleLanesToday: ScheduleLanes;
  scheduleLanesTomorrow: ScheduleLanes;
  prioritizedUsers: IUserMaster[];
  intensiveSupportUsers: IUserMaster[];
};

export type UseDashboardSummaryArgs = {
  users: IUserMaster[];
  today: string;
  currentMonth: string;
  visits: Record<string, VisitRecord>;
  staff: Staff[];
  attendanceCounts: AttendanceCounts;
  generateMockActivityRecords: (users: IUserMaster[], date: string) => ActivityRecord[];
};

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * すべての Dashboard 計算ロジックを1つのフックに統合
 *
 * 使用例:
 * ```
 * const summary = useDashboardSummary({
 *   users,
 *   today,
 *   currentMonth,
 *   visits,
 *   staff,
 *   attendanceCounts,
 *   generateMockActivityRecords,
 * });
 *
 * const {
 *   activityRecords,
 *   stats,
 *   attendanceSummary,
 *   // ...
 * } = summary;
 * ```
 *
 * @param args Input state and callbacks
 * @returns Consolidated summary object with all 7+1 calculated values
 *
 * 注意:
 * - Phase 3-A: ロジックは変更なし（移動のみ）
 * - Phase 3-B: 入力引数の最小化（next PR）
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

  // Intensive support users (used in multiple calculations)
  const intensiveSupportUsers = useMemo(
    () => users.filter(user => user.IsSupportProcedureTarget),
    [users],
  );

  // 1. Activity Records
  const activityRecords = useMemo(() => {
    return generateMockActivityRecords(users, today);
  }, [users, today, generateMockActivityRecords]);

  // 2. Usage Map
  const usageMap = useMemo(() => {
    return calculateUsageFromDailyRecords(activityRecords, users, currentMonth);
  }, [activityRecords, users, currentMonth]);

  // 3. Stats
  const stats = useMemo(() => {
    const totalUsers = users.length;
    const recordedUsers = activityRecords.filter(r => r.status === '完了').length;
    const completionRate = totalUsers > 0 ? (recordedUsers / totalUsers) * 100 : 0;

    const problemBehavior = activityRecords.filter(r =>
      r.data.problemBehavior.selfHarm ||
      r.data.problemBehavior.violence ||
      r.data.problemBehavior.loudVoice ||
      r.data.problemBehavior.pica ||
      r.data.problemBehavior.other
    ).length;

    const seizures = activityRecords.filter(r => r.data.seizureRecord.occurred).length;

    const lunch = activityRecords.filter(r => r.data.mealAmount === '完食').length;

    return {
      totalUsers,
      recordedUsers,
      completionRate: Math.round(completionRate),
      problemBehavior,
      seizures,
      lunch,
    };
  }, [users, activityRecords]);

  // 4. Attendance Summary
  const attendanceSummary = useMemo(() => {
    const onDuty = attendanceCounts.onDuty || [];
    const facilityAttendees = onDuty.length;
    const staffOnDuty = staff.length;

    const todayVisits = visits[today];
    const lateCount = todayVisits?.lateCount || 0;
    const earlyLeaveCount = todayVisits?.earlyLeaveCount || 0;
    const absenceCount = todayVisits?.absenceCount || 0;

    return {
      facilityAttendees,
      lateCount,
      earlyLeaveCount,
      absenceCount,
      staffOnDuty,
    };
  }, [attendanceCounts.onDuty, staff.length, visits, today]);

  // 5. Daily Record Status
  const dailyRecordStatus = useMemo(() => {
    const total = activityRecords.length;
    const completed = activityRecords.filter(r => r.status === '完了').length;
    const inProgress = activityRecords.filter(r => r.status === '作成中').length;
    const pending = total - completed - inProgress;

    return {
      total,
      pending,
      inProgress,
      completed,
    };
  }, [activityRecords]);

  // 6. Schedule Lanes (Today & Tomorrow)
  const [scheduleLanesToday, scheduleLanesTomorrow] = useMemo<[ScheduleLanes, ScheduleLanes]>(
    () => {
      const createScheduleLanes = (): ScheduleLanes => ({
        schedule: [],
        byHour: {},
      });

      return [createScheduleLanes(), createScheduleLanes()];
    },
    [today],
  );

  // 7. Prioritized Users (top 3 intensive support)
  const prioritizedUsers = useMemo(
    () => intensiveSupportUsers.slice(0, 3),
    [intensiveSupportUsers],
  );

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

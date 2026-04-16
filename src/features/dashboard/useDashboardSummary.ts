/**
 * Dashboard Summary Hook (Phase 3A: Logic Move Only)
 *
 * Consolidates 7 useMemo blocks from DashboardPage.tsx into a single hook.
 * IMPORTANT: This is a DIRECT COPY of the original useMemo blocks.
 * No logic changes, no type redefinitions. Uses existing domain types only.
 */

import type { PersonDaily } from '@/domain/daily/types';
import type { AttendanceCounts } from '@/features/staff/attendance/port';
import { isSchedulesSpEnabled } from '@/lib/env';
import type { IUserMaster } from '@/features/users/types';
import type { Staff } from '@/types';
import { useMemo } from 'react';
import { useActivitySummary } from './selectors/useActivitySummary';
import { useAttendanceAnalytics, type AttendanceVisitSnapshot } from './selectors/useAttendanceAnalytics';
import { useMonitoringHub } from './selectors/useMonitoringHub';
import { useScheduleLanes } from './selectors/useScheduleLanes';
import { calculateStaffAvailability, StaffAssignment } from './staffAvailability';

import { buildHubLaneModel } from './selectors';
import {
    type HubSyncStatus,
    type SpLaneModel,
    type SpSyncStatus
} from './types/hub';

/**
 * Legacy alias for buildHubLaneModel (specifically for SP Lane)
 */
export function buildSpLaneModel(enabled: boolean, status: SpSyncStatus): SpLaneModel {
  return buildHubLaneModel('SharePoint 外部連携', enabled, status);
}

/**
 * Main hook: consolidates domain logic via modular selectors
 */
export function useDashboardSummary({
  users,
  staff,
  visits,
  today,
  currentMonth,
  generateMockActivityRecords,
  attendanceCounts,
  spSyncStatus,
}: {
  users: IUserMaster[];
  staff: Staff[];
  visits: Record<string, AttendanceVisitSnapshot>;
  today: string;
  currentMonth: string;
  generateMockActivityRecords: (users: IUserMaster[], date: string) => PersonDaily[];
  attendanceCounts: AttendanceCounts;
  spSyncStatus?: HubSyncStatus;
}) {
  // Normalize inputs: prevent Object.values(undefined) crash during initial render
  const safeVisits = visits ?? {};
  const safeAttendanceCounts = attendanceCounts ?? { onDuty: 0, out: 0, absent: 0, total: 0 };

  // 1. Activity & Usage
  const attendanceOrderUserIds = Object.values(safeVisits)
    .filter(v => v.status !== '当日欠席' && v.status !== '事前欠席')
    .map(v => v.userCode);

  const { activityRecords, usageMap, intensiveSupportUsers, stats, dailyRecordStatus } =
    useActivitySummary(users, today, currentMonth, generateMockActivityRecords, attendanceOrderUserIds);

  // 2. Attendance & Alerts
  const { attendanceSummary, briefingAlerts } =
    useAttendanceAnalytics(users, staff, safeVisits, safeAttendanceCounts);

  // 3. Schedules
  const { scheduleLanesToday, scheduleLanesTomorrow } = useScheduleLanes(users);

  // 4. Monitoring Hub
  const spEnabled = isSchedulesSpEnabled();

  const presenceSyncStatus: HubSyncStatus = {
    loading: false,
    error: null,
    itemCount: attendanceSummary.facilityAttendees,
    source: 'demo',
  };
  const dailySyncStatus: HubSyncStatus = {
    loading: false,
    error: null,
    itemCount: dailyRecordStatus.completed,
    source: 'demo',
  };

  const defaultSyncStatus: HubSyncStatus = { loading: false, error: null, itemCount: 0, source: 'demo' };
  const monitoringHub = useMonitoringHub(spSyncStatus ?? defaultSyncStatus, presenceSyncStatus, dailySyncStatus, spEnabled);

  // 5. Prioritized Users
  const prioritizedUsers = useMemo(() => intensiveSupportUsers.slice(0, 3), [intensiveSupportUsers]);

  // 6. Staff Availability
  const staffAvailability = useMemo(() => {
    const assignments: StaffAssignment[] = scheduleLanesToday.staffLane.map((item) => {
      const [startTime, endTime] = item.time.split('-').map(t => t.trim());
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

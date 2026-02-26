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
import type { IUserMaster } from '@/sharepoint/fields';
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
export function useDashboardSummary(
  users: IUserMaster[],
  staff: Staff[],
  visits: Record<string, AttendanceVisitSnapshot>,
  today: string,
  currentMonth: string,
  generateMockActivityRecords: (users: IUserMaster[], date: string) => PersonDaily[],
  attendanceCounts: AttendanceCounts,
  spSyncStatus: HubSyncStatus,
) {
  const isDevProfiling = process.env.NODE_ENV === 'development';

  const perfMark = (label: string) => {
    if (isDevProfiling && typeof performance !== 'undefined') {
      performance.mark(label);
    }
  };

  const perfMeasure = (label: string) => {
    if (isDevProfiling && typeof performance !== 'undefined' && performance.getEntriesByName(label).length > 0) {
      try {
        performance.measure(`${label}-duration`, label);
        const duration = performance.getEntriesByName(`${label}-duration`)[0]?.duration || 0;
        // eslint-disable-next-line no-console
        console.log(`[Dashboard Perf] ${label}: ${duration.toFixed(2)}ms`);
        performance.clearMarks(label);
        performance.clearMeasures(`${label}-duration`);
      } catch (e) {
        console.error('[PERF MEASURE ERROR]', label, e);
      }
    }
  };

  perfMark('useDashboardSummary-start');

  // 1. Activity & Usage
  const attendanceOrderUserIds = Object.values(visits)
    .filter(v => v.status !== '当日欠席' && v.status !== '事前欠席')
    .map(v => v.userCode);

  const { activityRecords, usageMap, intensiveSupportUsers, stats, dailyRecordStatus } =
    useActivitySummary(users, today, currentMonth, generateMockActivityRecords, attendanceOrderUserIds);

  // 2. Attendance & Alerts
  const { attendanceSummary, briefingAlerts } =
    useAttendanceAnalytics(users, staff, visits, attendanceCounts);

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

  const monitoringHub = useMonitoringHub(spSyncStatus, presenceSyncStatus, dailySyncStatus, spEnabled);

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

  perfMeasure('useDashboardSummary-start');

  return {
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
    handoffTotal: 12, // Demo
    handoffStatus: { pending: 4, ongoing: 6, completed: 2 }, // Demo
    handoffCritical: 1, // Demo
  };
}

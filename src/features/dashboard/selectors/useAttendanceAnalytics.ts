import type { BriefingAlert } from '@/features/dashboard/sections/types';
import type { AttendanceCounts } from '@/features/staff/attendance/port';
import type { IUserMaster } from '@/sharepoint/fields';
import type { Staff } from '@/types';
import { useMemo } from 'react';

export interface AttendanceVisitSnapshot {
  userCode: string;
  status: string;
  providedMinutes?: number;
  isEarlyLeave?: boolean;
}

export function useAttendanceAnalytics(
  users: IUserMaster[],
  staff: Staff[],
  visits: Record<string, AttendanceVisitSnapshot>,
  attendanceCounts: AttendanceCounts
) {
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

    const onDutyStaff = attendanceCounts.onDuty;
    const staffCount = staff.length || 0;
    const estimatedOnDutyStaff = Math.max(0, Math.round(staffCount * 0.6));
    const finalOnDutyStaff = onDutyStaff > 0 ? onDutyStaff : estimatedOnDutyStaff;

    const lateOrShiftAdjust = Math.max(0, Math.round(finalOnDutyStaff * 0.15));

    // Per-user items for actionable alerts (Today Execution Layer)
    const absenceItems = absenceVisits.map((v) => ({
      userId: v.userCode,
      userName: userCodeMap.get(v.userCode) ?? v.userCode,
    }));
    const lateOrEarlyItems = lateOrEarlyVisits.map((v) => ({
      userId: v.userCode,
      userName: userCodeMap.get(v.userCode) ?? v.userCode,
    }));

    return {
      facilityAttendees,
      lateOrEarlyLeave,
      lateOrEarlyNames,
      absenceCount,
      absenceNames,
      onDutyStaff: finalOnDutyStaff,
      lateOrShiftAdjust,
      absenceItems,
      lateOrEarlyItems,
    };
  }, [attendanceCounts, staff.length, users, visits]);

  const briefingAlerts = useMemo<BriefingAlert[]>(() => {
    const alerts: BriefingAlert[] = [];

    if (attendanceSummary.absenceCount > 0) {
      alerts.push({
        id: 'absent',
        type: 'absent',
        severity: 'error',
        label: '本日欠席',
        count: attendanceSummary.absenceCount,
        targetAnchorId: 'sec-attendance',
        description: attendanceSummary.absenceNames?.slice(0, 3).join('、'),
        items: attendanceSummary.absenceItems,
      });
    }

    if (attendanceSummary.lateOrEarlyLeave > 0) {
      alerts.push({
        id: 'late',
        type: 'late',
        severity: 'warning',
        label: '遅刻・早退',
        count: attendanceSummary.lateOrEarlyLeave,
        targetAnchorId: 'sec-attendance',
        description: attendanceSummary.lateOrEarlyNames?.slice(0, 3).join('、'),
        items: attendanceSummary.lateOrEarlyItems,
      });
    }

    return alerts;
  }, [attendanceSummary]);

  return {
    attendanceSummary,
    briefingAlerts,
  };
}

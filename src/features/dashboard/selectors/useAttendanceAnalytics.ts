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
  /** 検温値 (℃) — 37.5以上で発熱アラート */
  temperature?: number;
  /** 欠席者の朝連絡受け入れ完了フラグ */
  morningContacted?: boolean;
  /** 欠席者の夕方フォロー完了フラグ */
  eveningChecked?: boolean;
}

/** 発熱閾値: useAttendance.ts と統一 */
const FEVER_THRESHOLD = 37.5;

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

    // ── 欠席内訳: 当日欠席 / 事前欠席 ──
    const sameDayAbsenceVisits = absenceVisits.filter((visit) => visit.status === '当日欠席');
    const priorAbsenceVisits = absenceVisits.filter((visit) => visit.status === '事前欠席');
    const sameDayAbsenceCount = sameDayAbsenceVisits.length;
    const priorAbsenceCount = priorAbsenceVisits.length;
    const sameDayAbsenceNames = Array.from(
      new Set(
        sameDayAbsenceVisits
          .map((visit) => userCodeMap.get(visit.userCode))
          .filter((name): name is string => Boolean(name))
      )
    );
    const priorAbsenceNames = Array.from(
      new Set(
        priorAbsenceVisits
          .map((visit) => userCodeMap.get(visit.userCode))
          .filter((name): name is string => Boolean(name))
      )
    );
    const sameDayAbsenceItems = sameDayAbsenceVisits.map((v) => ({
      userId: v.userCode,
      userName: userCodeMap.get(v.userCode) ?? v.userCode,
      morningContacted: v.morningContacted ?? false,
      eveningChecked: v.eveningChecked ?? false,
    }));
    const priorAbsenceItems = priorAbsenceVisits.map((v) => ({
      userId: v.userCode,
      userName: userCodeMap.get(v.userCode) ?? v.userCode,
      morningContacted: v.morningContacted ?? false,
      eveningChecked: v.eveningChecked ?? false,
    }));

    const onDutyStaff = attendanceCounts.onDuty;
    const staffCount = staff.length || 0;
    const estimatedOnDutyStaff = Math.max(0, Math.round(staffCount * 0.6));
    const finalOnDutyStaff = onDutyStaff > 0 ? onDutyStaff : estimatedOnDutyStaff;

    const lateOrShiftAdjust = Math.max(0, Math.round(finalOnDutyStaff * 0.15));

    // Per-user items for actionable alerts (Today Execution Layer)
    const absenceItems = absenceVisits.map((v) => ({
      userId: v.userCode,
      userName: userCodeMap.get(v.userCode) ?? v.userCode,
      morningContacted: v.morningContacted ?? false,
      eveningChecked: v.eveningChecked ?? false,
    }));
    const lateOrEarlyItems = lateOrEarlyVisits.map((v) => ({
      userId: v.userCode,
      userName: userCodeMap.get(v.userCode) ?? v.userCode,
    }));

    // ── 🌡️ 発熱者の抽出 ──
    const feverVisits = visitList.filter(
      (visit) => visit.temperature != null && visit.temperature >= FEVER_THRESHOLD
    );
    const feverCount = feverVisits.length;
    const feverNames = Array.from(
      new Set(
        feverVisits
          .map((visit) => userCodeMap.get(visit.userCode))
          .filter((name): name is string => Boolean(name))
      )
    );
    const feverItems = feverVisits.map((v) => ({
      userId: v.userCode,
      userName: userCodeMap.get(v.userCode) ?? v.userCode,
    }));

    // ── ⚠️ 夕方フォロー未完了（欠席者で eveningChecked !== true）──
    const eveningPendingVisits = absenceVisits.filter(
      (visit) => visit.eveningChecked !== true
    );
    const eveningPendingCount = eveningPendingVisits.length;
    const eveningPendingNames = Array.from(
      new Set(
        eveningPendingVisits
          .map((visit) => userCodeMap.get(visit.userCode))
          .filter((name): name is string => Boolean(name))
      )
    );
    const eveningPendingItems = eveningPendingVisits.map((v) => ({
      userId: v.userCode,
      userName: userCodeMap.get(v.userCode) ?? v.userCode,
    }));

    // 予定人数
    const scheduledCount = users.length;

    return {
      scheduledCount,
      facilityAttendees,
      lateOrEarlyLeave,
      lateOrEarlyNames,
      absenceCount,
      absenceNames,
      sameDayAbsenceCount,
      sameDayAbsenceNames,
      sameDayAbsenceItems,
      priorAbsenceCount,
      priorAbsenceNames,
      priorAbsenceItems,
      onDutyStaff: finalOnDutyStaff,
      lateOrShiftAdjust,
      absenceItems,
      lateOrEarlyItems,
      feverCount,
      feverNames,
      feverItems,
      eveningPendingCount,
      eveningPendingNames,
      eveningPendingItems,
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
        section: 'today',
        tags: ['重要'],
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
        section: 'today',
        tags: ['新規'],
      });
    }

    // 🌡️ 発熱アラート（37.5℃以上）
    if (attendanceSummary.feverCount > 0) {
      alerts.push({
        id: 'fever_alert',
        type: 'fever_alert',
        severity: 'error',
        label: '発熱',
        count: attendanceSummary.feverCount,
        targetAnchorId: 'sec-attendance',
        description: attendanceSummary.feverNames?.slice(0, 3).join('、'),
        items: attendanceSummary.feverItems,
        section: 'today',
        tags: ['重要'],
      });
    }

    // ⚠️ 夕方フォロー未完了
    if (attendanceSummary.eveningPendingCount > 0) {
      alerts.push({
        id: 'evening_followup',
        type: 'evening_followup',
        severity: 'warning',
        label: '夕方フォロー未完了',
        count: attendanceSummary.eveningPendingCount,
        targetAnchorId: 'sec-attendance',
        description: attendanceSummary.eveningPendingNames?.slice(0, 3).join('、'),
        items: attendanceSummary.eveningPendingItems,
        section: 'ongoing',
        tags: ['継続'],
      });
    }

    return alerts;
  }, [attendanceSummary]);

  return {
    attendanceSummary,
    briefingAlerts,
  };
}

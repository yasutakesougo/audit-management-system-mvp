import type { StaffAttendance, StaffAttendanceStatus } from './types';

// ──── UI-only types (ドメイン型を汚さない) ────

/**
 * UI表示用ステータス。ドメインの StaffAttendanceStatus + '未入力'。
 * '未入力' はドメイン型に追加しない（型安全維持のため）。
 */
export type AttendanceRowStatus = StaffAttendanceStatus | '未入力';

export type StaffAttendanceRow = {
  staffId: string;
  staffName?: string;
  status: AttendanceRowStatus;
  note?: string;
  isFinalized?: boolean;
};

export type StaffLike = {
  staffId: string;
  name?: string;
};

// ──── Sort order (現場で見やすい順) ────

const STATUS_ORDER: Record<AttendanceRowStatus, number> = {
  '未入力': 0,
  '欠勤': 1,
  '出勤': 2,
};

/**
 * Left-join staff master × attendance records.
 *
 * - All staff appear in the result (left outer join)
 * - Staff without attendance record → status = '未入力'
 * - Stable sort: 未入力 → 欠勤 → 出勤 → staffId asc
 *
 * @param staffList  Staff master (all staff)
 * @param items      Attendance records for a given date
 * @returns          Joined & sorted rows for UI display
 */
export function buildStaffAttendanceRows(
  staffList: StaffLike[],
  items: StaffAttendance[],
): StaffAttendanceRow[] {
  const attendanceMap = new Map(items.map((a) => [a.staffId, a]));

  const rows: StaffAttendanceRow[] = staffList.map((staff) => {
    const att = attendanceMap.get(staff.staffId);
    if (att) {
      return {
        staffId: att.staffId,
        staffName: staff.name,
        status: att.status,
        note: att.note,
        isFinalized: att.isFinalized,
      };
    }
    return {
      staffId: staff.staffId,
      staffName: staff.name,
      status: '未入力' as const,
    };
  });

  rows.sort(
    (a, b) =>
      (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99) ||
      a.staffId.localeCompare(b.staffId),
  );

  return rows;
}

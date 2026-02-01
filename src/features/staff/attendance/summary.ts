export type AttendanceLike = {
  recordDate: string; // YYYY-MM-DD
  staffId: string;
  status: string;
  lateMinutes?: number | null;
};

export type AttendanceCounts = Record<string, number>;

export type MonthlySummary = {
  totalItems: number;
  uniqueStaffCount: number;
  attendanceCount: number;
  absenceCount: number;
  lateCount: number;
  earlyLeaveCount: number;
  countsByStatus: AttendanceCounts;
};

export type StaffBreakdownRow = {
  staffId: string;
  countsByStatus: AttendanceCounts;
  total: number;
  attendanceCount: number;
  absenceCount: number;
  lateCount: number;
  earlyLeaveCount: number;
};

export const ATTENDANCE_STATUS_SET = new Set(['出勤', '外出中', '遅刻', '早退']);
export const ABSENCE_STATUS_SET = new Set(['欠勤']);
export const LATE_STATUS_SET = new Set(['遅刻']);
export const EARLY_LEAVE_STATUS_SET = new Set(['早退']);

const normalizeKey = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : "(unknown)";
};

const classifyStatus = (status: string, lateMinutes?: number | null) => {
  const key = normalizeKey(status);
  const isLate = LATE_STATUS_SET.has(key) || (lateMinutes ?? 0) > 0;
  const isEarlyLeave = EARLY_LEAVE_STATUS_SET.has(key);
  const isAbsence = ABSENCE_STATUS_SET.has(key);
  const isAttendance = ATTENDANCE_STATUS_SET.has(key) || isLate || isEarlyLeave;
  return { key, isAttendance, isAbsence, isLate, isEarlyLeave };
};

export const countByStatus = <T extends AttendanceLike>(items: T[]): AttendanceCounts => {
  const out: AttendanceCounts = {};
  for (const it of items) {
    const key = normalizeKey(it.status);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
};

export const buildMonthlySummary = <T extends AttendanceLike>(items: T[]): MonthlySummary => {
  const staffSet = new Set<string>();
  let attendanceCount = 0;
  let absenceCount = 0;
  let lateCount = 0;
  let earlyLeaveCount = 0;
  for (const it of items) {
    staffSet.add(normalizeKey(it.staffId));
    const { isAttendance, isAbsence, isLate, isEarlyLeave } = classifyStatus(it.status, it.lateMinutes);
    if (isAttendance) attendanceCount += 1;
    if (isAbsence) absenceCount += 1;
    if (isLate) lateCount += 1;
    if (isEarlyLeave) earlyLeaveCount += 1;
  }
  return {
    totalItems: items.length,
    uniqueStaffCount: staffSet.size,
    attendanceCount,
    absenceCount,
    lateCount,
    earlyLeaveCount,
    countsByStatus: countByStatus(items),
  };
};

export const buildStaffBreakdown = <T extends AttendanceLike>(items: T[]): StaffBreakdownRow[] => {
  const map = new Map<string, {
    countsByStatus: AttendanceCounts;
    attendanceCount: number;
    absenceCount: number;
    lateCount: number;
    earlyLeaveCount: number;
  }>();
  for (const it of items) {
    const staffId = normalizeKey(it.staffId);
    const { key, isAttendance, isAbsence, isLate, isEarlyLeave } = classifyStatus(it.status, it.lateMinutes);
    const cur = map.get(staffId) ?? {
      countsByStatus: {},
      attendanceCount: 0,
      absenceCount: 0,
      lateCount: 0,
      earlyLeaveCount: 0,
    };
    cur.countsByStatus[key] = (cur.countsByStatus[key] ?? 0) + 1;
    if (isAttendance) cur.attendanceCount += 1;
    if (isAbsence) cur.absenceCount += 1;
    if (isLate) cur.lateCount += 1;
    if (isEarlyLeave) cur.earlyLeaveCount += 1;
    map.set(staffId, cur);
  }

  const rows: StaffBreakdownRow[] = [];
  for (const [staffId, payload] of map.entries()) {
    const total = Object.values(payload.countsByStatus).reduce((a, b) => a + b, 0);
    rows.push({
      staffId,
      countsByStatus: payload.countsByStatus,
      total,
      attendanceCount: payload.attendanceCount,
      absenceCount: payload.absenceCount,
      lateCount: payload.lateCount,
      earlyLeaveCount: payload.earlyLeaveCount,
    });
  }

  // absence desc -> late desc -> total desc -> staffId asc (stable)
  rows.sort((a, b) =>
    (b.absenceCount - a.absenceCount)
    || (b.lateCount - a.lateCount)
    || (b.total - a.total)
    || a.staffId.localeCompare(b.staffId)
  );
  return rows;
};

export const listAllStatuses = (countsByStatus: AttendanceCounts): string[] => {
  return Object.keys(countsByStatus).sort((a, b) => a.localeCompare(b, "ja"));
};

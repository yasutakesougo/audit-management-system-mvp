export type AttendanceLike = {
  recordDate: string; // YYYY-MM-DD
  staffId: string;
  status: string;
};

export type AttendanceCounts = Record<string, number>;

export type MonthlySummary = {
  totalItems: number;
  uniqueStaffCount: number;
  countsByStatus: AttendanceCounts;
};

export type StaffBreakdownRow = {
  staffId: string;
  countsByStatus: AttendanceCounts;
  total: number;
};

const normalizeKey = (v: unknown): string => {
  const s = String(v ?? "").trim();
  return s.length > 0 ? s : "(unknown)";
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
  for (const it of items) {
    staffSet.add(normalizeKey(it.staffId));
  }
  return {
    totalItems: items.length,
    uniqueStaffCount: staffSet.size,
    countsByStatus: countByStatus(items),
  };
};

export const buildStaffBreakdown = <T extends AttendanceLike>(items: T[]): StaffBreakdownRow[] => {
  const map = new Map<string, AttendanceCounts>();
  for (const it of items) {
    const staffId = normalizeKey(it.staffId);
    const status = normalizeKey(it.status);
    const cur = map.get(staffId) ?? {};
    cur[status] = (cur[status] ?? 0) + 1;
    map.set(staffId, cur);
  }

  const rows: StaffBreakdownRow[] = [];
  for (const [staffId, countsByStatus] of map.entries()) {
    const total = Object.values(countsByStatus).reduce((a, b) => a + b, 0);
    rows.push({ staffId, countsByStatus, total });
  }

  // total desc -> staffId asc (stable)
  rows.sort((a, b) => (b.total - a.total) || a.staffId.localeCompare(b.staffId));
  return rows;
};

export const listAllStatuses = (countsByStatus: AttendanceCounts): string[] => {
  return Object.keys(countsByStatus).sort((a, b) => a.localeCompare(b, "ja"));
};

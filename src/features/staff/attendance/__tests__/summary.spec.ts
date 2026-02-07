import { describe, expect, it } from "vitest";
import {
  buildMonthlySummary,
  buildStaffBreakdown,
  countByStatus,
  listAllStatuses,
  type AttendanceLike,
} from "../summary";

const mk = (
  recordDate: string,
  staffId: string,
  status: string,
  lateMinutes?: number | null,
): AttendanceLike => ({
  recordDate,
  staffId,
  status,
  lateMinutes,
});

describe("staff attendance summary", () => {
  it("countByStatus counts and normalizes blanks", () => {
    const items = [
      mk("2026-02-01", "S001", "出勤"),
      mk("2026-02-01", "S001", "出勤"),
      mk("2026-02-01", "S001", "遅刻"),
      mk("2026-02-02", "S002", ""),
    ];
    expect(countByStatus(items)).toEqual({ "出勤": 2, "遅刻": 1, "(unknown)": 1 });
  });

  it("buildMonthlySummary returns totals + unique staff count + derived counts", () => {
    const items = [
      mk("2026-02-01", "S001", "出勤"),
      mk("2026-02-01", "S002", "欠勤"),
      mk("2026-02-02", "S002", "出勤", 5),
    ];
    const s = buildMonthlySummary(items);
    expect(s.totalItems).toBe(3);
    expect(s.uniqueStaffCount).toBe(2);
    expect(s.attendanceCount).toBe(2);
    expect(s.absenceCount).toBe(1);
    expect(s.lateCount).toBe(1);
    expect(s.earlyLeaveCount).toBe(0);
    expect(s.countsByStatus).toEqual({ "出勤": 2, "欠勤": 1 });
  });

  it("buildStaffBreakdown groups by staff and sorts by absence/late/total", () => {
    const items = [
      mk("2026-02-01", "S001", "出勤"),
      mk("2026-02-02", "S001", "遅刻"),
      mk("2026-02-01", "S002", "欠勤"),
      mk("2026-02-02", "S002", "出勤", 3),
    ];
    const rows = buildStaffBreakdown(items);
    expect(rows.map((r) => r.staffId)).toEqual(["S002", "S001"]);
    expect(rows[0].countsByStatus).toEqual({ "欠勤": 1, "出勤": 1 });
    expect(rows[0].absenceCount).toBe(1);
    expect(rows[0].lateCount).toBe(1);
    expect(rows[1].lateCount).toBe(1);
  });

  it("listAllStatuses returns sorted status keys", () => {
    expect(listAllStatuses({ "遅刻": 1, "出勤": 2, "欠勤": 3 })).toEqual(["欠勤", "出勤", "遅刻"]);
  });
});

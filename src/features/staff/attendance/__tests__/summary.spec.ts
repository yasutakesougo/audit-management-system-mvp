import { describe, expect, it } from "vitest";
import {
  buildMonthlySummary,
  buildStaffBreakdown,
  countByStatus,
  listAllStatuses,
  type AttendanceLike,
} from "../summary";

const mk = (recordDate: string, staffId: string, status: string): AttendanceLike => ({
  recordDate,
  staffId,
  status,
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

  it("buildMonthlySummary returns totals + unique staff count", () => {
    const items = [
      mk("2026-02-01", "S001", "出勤"),
      mk("2026-02-01", "S002", "欠勤"),
      mk("2026-02-02", "S002", "出勤"),
    ];
    const s = buildMonthlySummary(items);
    expect(s.totalItems).toBe(3);
    expect(s.uniqueStaffCount).toBe(2);
    expect(s.countsByStatus).toEqual({ "出勤": 2, "欠勤": 1 });
  });

  it("buildStaffBreakdown groups by staff and sorts by total desc", () => {
    const items = [
      mk("2026-02-01", "S001", "出勤"),
      mk("2026-02-02", "S001", "遅刻"),
      mk("2026-02-01", "S002", "出勤"),
    ];
    const rows = buildStaffBreakdown(items);
    expect(rows.map((r) => r.staffId)).toEqual(["S001", "S002"]);
    expect(rows[0].countsByStatus).toEqual({ "出勤": 1, "遅刻": 1 });
    expect(rows[0].total).toBe(2);
    expect(rows[1].total).toBe(1);
  });

  it("listAllStatuses returns sorted status keys", () => {
    expect(listAllStatuses({ "遅刻": 1, "出勤": 2, "欠勤": 3 })).toEqual(["欠勤", "出勤", "遅刻"]);
  });
});

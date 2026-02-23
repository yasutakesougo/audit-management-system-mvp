export type StaffAttendanceStatus = '出勤' | '欠勤' | '外出中';

// YYYY-MM-DD を想定（生成は util で統一してもOK）
export type RecordDate = string;

export interface StaffAttendance {
  staffId: string;
  recordDate: RecordDate;
  status: StaffAttendanceStatus;
  isFinalized?: boolean;
  finalizedAt?: string;
  finalizedBy?: string;

  // Phase 2.1 は optional のまま置いておく（PR-C以降で利用）
  checkInAt?: string; // ISO datetime
  checkOutAt?: string; // ISO datetime
  lateMinutes?: number;
  note?: string;
}

// key: `${recordDate}_${staffId}`
export function buildAttendanceKey(
  recordDate: RecordDate,
  staffId: string
): string {
  return `${recordDate}_${staffId}`;
}

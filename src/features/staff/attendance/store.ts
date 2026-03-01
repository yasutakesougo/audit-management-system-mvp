import {
    buildAttendanceKey,
    type RecordDate,
    type StaffAttendance,
} from './types';

export interface StaffAttendanceStore {
  attendances: Record<string, StaffAttendance>;

  upsert: (attendance: StaffAttendance) => void;
  remove: (recordDate: RecordDate, staffId: string) => void;

  listByDate: (recordDate: RecordDate) => StaffAttendance[];
  get: (recordDate: RecordDate, staffId: string) => StaffAttendance | undefined;

  // 便利：Dashboard 側で使いやすく
  countByDate: (
    recordDate: RecordDate
  ) => { onDuty: number; out: number; absent: number; total: number };

  // 永続化用：全記録を取得
  listAll: () => StaffAttendance[];
}

// In-memory store for demo mode (shareable state reference)
const storeState: StaffAttendanceStore = {
  attendances: {},

  upsert(attendance) {
    const key = buildAttendanceKey(attendance.recordDate, attendance.staffId);
    this.attendances[key] = attendance;
  },

  remove(recordDate, staffId) {
    const key = buildAttendanceKey(recordDate, staffId);
    delete this.attendances[key];
  },

  listByDate(recordDate) {
    return Object.values(this.attendances).filter(
      (a) => a.recordDate === recordDate
    );
  },

  get(recordDate, staffId) {
    const key = buildAttendanceKey(recordDate, staffId);
    return this.attendances[key];
  },

  countByDate(recordDate) {
    const list = this.listByDate(recordDate);
    const onDuty = list.filter((a) => a.status === '出勤').length;
    const out = 0; // 外出中 status removed (Issue 1-1); kept for interface compat
    const absent = list.filter((a) => a.status === '欠勤').length;
    return { onDuty, out, absent, total: list.length };
  },

  listAll() {
    return Object.values(this.attendances);
  },
};

export const useStaffAttendanceStore = (): StaffAttendanceStore => {
  return storeState;
};

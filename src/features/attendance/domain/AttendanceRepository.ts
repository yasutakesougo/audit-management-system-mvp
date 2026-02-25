import type { AttendanceDailyItem } from '../infra/attendanceDailyRepository';
import type { AttendanceUserItem } from '../infra/attendanceUsersRepository';

export type AttendanceRepositoryListParams = {
  recordDate: string;
  signal?: AbortSignal;
};

export type AttendanceRepositoryUpsertParams = {
  signal?: AbortSignal;
};

export interface AttendanceRepository {
  getActiveUsers(signal?: AbortSignal): Promise<AttendanceUserItem[]>;
  getDailyByDate(params: AttendanceRepositoryListParams): Promise<AttendanceDailyItem[]>;
  upsertDailyByKey(item: AttendanceDailyItem, params?: AttendanceRepositoryUpsertParams): Promise<void>;
}

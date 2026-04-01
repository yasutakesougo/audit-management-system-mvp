// contract:allow-interface — Repository interfaces define behavior contracts, not data shapes (SSOT = schema.ts)
import type { AttendanceDailyItem } from '../infra/Legacy/attendanceDailyRepository';
import type { AttendanceUserItem } from '../infra/Legacy/attendanceUsersRepository';

export type AttendanceRepositoryListParams = {
  recordDate: string;
  signal?: AbortSignal;
};

export type AttendanceRepositoryUpsertParams = {
  signal?: AbortSignal;
};

export type ObservationTemperatureItem = {
  userLookupId: number;
  temperature: number;
  observedAt: string;
};

export interface AttendanceRepository {
  getActiveUsers(date?: string, signal?: AbortSignal): Promise<AttendanceUserItem[]>;
  getDailyByDate(params: AttendanceRepositoryListParams): Promise<AttendanceDailyItem[]>;
  upsertDailyByKey(item: AttendanceDailyItem, params?: AttendanceRepositoryUpsertParams): Promise<void>;
  getObservationsByDate(recordDate: string): Promise<ObservationTemperatureItem[]>;
}

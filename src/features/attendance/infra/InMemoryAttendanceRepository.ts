import type {
  AttendanceRepository,
  AttendanceRepositoryListParams,
  AttendanceRepositoryUpsertParams,
} from '../domain/AttendanceRepository';
import type { AttendanceDailyItem } from './attendanceDailyRepository';
import type { AttendanceUserItem } from './attendanceUsersRepository';

type InMemoryAttendanceSeed = {
  users?: AttendanceUserItem[];
  dailyItems?: AttendanceDailyItem[];
};

class InMemoryAttendanceRepository implements AttendanceRepository {
  private users: AttendanceUserItem[];
  private dailyItems: AttendanceDailyItem[];

  constructor(seed: InMemoryAttendanceSeed = {}) {
    this.users = [...(seed.users ?? [])];
    this.dailyItems = [...(seed.dailyItems ?? [])];
  }

  public async getActiveUsers(signal?: AbortSignal): Promise<AttendanceUserItem[]> {
    if (signal?.aborted) return [];
    return [...this.users];
  }

  public async getDailyByDate(params: AttendanceRepositoryListParams): Promise<AttendanceDailyItem[]> {
    if (params.signal?.aborted) return [];
    return this.dailyItems
      .filter((item) => item.RecordDate === params.recordDate)
      .map((item) => ({ ...item }));
  }

  public async upsertDailyByKey(
    item: AttendanceDailyItem,
    params?: AttendanceRepositoryUpsertParams,
  ): Promise<void> {
    if (params?.signal?.aborted) return;

    const index = this.dailyItems.findIndex((existing) => existing.Key === item.Key);
    if (index >= 0) {
      this.dailyItems[index] = { ...this.dailyItems[index], ...item };
      return;
    }
    this.dailyItems.push({ ...item });
  }
}

export const inMemoryAttendanceRepository: AttendanceRepository = new InMemoryAttendanceRepository();

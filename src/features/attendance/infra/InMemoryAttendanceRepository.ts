import type {
    AttendanceRepository,
    AttendanceRepositoryListParams,
    AttendanceRepositoryUpsertParams,
    ObservationTemperatureItem,
} from '../domain/AttendanceRepository';
import type { AttendanceDailyItem } from './Legacy/attendanceDailyRepository';
import type { AttendanceUserItem } from './Legacy/attendanceUsersRepository';

import { generateSyntheticDailyItems } from './demoDataGenerator';

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

  public async getActiveUsers(date?: string, signal?: AbortSignal): Promise<AttendanceUserItem[]> {
    if (signal?.aborted) return [];
    const refDate = date || new Date().toISOString().split('T')[0];
    return this.users.filter((u) => {
      if (!u.IsActive) return false;
      if (u.UsageStatus && (u.UsageStatus.includes('終了') || u.UsageStatus.includes('退会'))) return false;
      if (u.ServiceEndDate && u.ServiceEndDate < refDate) return false;
      return true;
    });
  }

  public async getDailyByDate(params: AttendanceRepositoryListParams): Promise<AttendanceDailyItem[]> {
    if (params.signal?.aborted) return [];
    
    const existing = this.dailyItems.filter((item) => item.RecordDate === params.recordDate);
    
    // Fallback to synthetic data in demo mode if nothing is in memory for 'today' or specific date
    if (existing.length === 0) {
      const synthetic = generateSyntheticDailyItems(this.users, params.recordDate);
      return synthetic;
    }

    return existing.map((item) => ({ ...item }));
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

  public async getObservationsByDate(_recordDate: string): Promise<ObservationTemperatureItem[]> {
    return [];
  }
}

/**
 * Default seed data for local dev / demo mode.
 * Derived from DEMO_USERS so user list stays consistent across the app.
 */
import { DEMO_USERS } from '@/features/users/constants';

const seedUsers: AttendanceUserItem[] = DEMO_USERS.map((u) => ({
  Id: u.Id,
  Title: u.FullName,
  UserCode: u.UserID,
  IsTransportTarget: false,
  StandardMinutes: 360,
  IsActive: true,
  AttendanceDays: u.AttendanceDays ?? undefined,
}));

export const inMemoryAttendanceRepository: AttendanceRepository = new InMemoryAttendanceRepository({
  users: seedUsers,
});

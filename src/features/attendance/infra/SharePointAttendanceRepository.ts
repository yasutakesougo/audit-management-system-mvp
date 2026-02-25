import { createSpClient, ensureConfig } from '@/lib/spClient';

import type {
  AttendanceRepository,
  AttendanceRepositoryListParams,
  AttendanceRepositoryUpsertParams,
} from '../domain/AttendanceRepository';
import {
  getDailyByDate,
  upsertDailyByKey,
  type AttendanceDailyItem,
} from './attendanceDailyRepository';
import { getActiveUsers, type AttendanceUserItem } from './attendanceUsersRepository';

export type SharePointAttendanceRepositoryOptions = {
  listTitleUsers?: string;
  listTitleDaily?: string;
};

export class SharePointAttendanceRepository implements AttendanceRepository {
  private readonly listTitleUsers?: string;
  private readonly listTitleDaily?: string;
  private readonly spClient: ReturnType<typeof createSpClient>;

  constructor(
    acquireToken: () => Promise<string | null>,
    options: SharePointAttendanceRepositoryOptions = {},
  ) {
    this.listTitleUsers = options.listTitleUsers;
    this.listTitleDaily = options.listTitleDaily;
    this.spClient = createSpClient(acquireToken, ensureConfig().baseUrl);
  }

  public async getActiveUsers(signal?: AbortSignal): Promise<AttendanceUserItem[]> {
    if (signal?.aborted) return [];
    return getActiveUsers(this.spClient, this.listTitleUsers);
  }

  public async getDailyByDate(params: AttendanceRepositoryListParams): Promise<AttendanceDailyItem[]> {
    if (params.signal?.aborted) return [];
    return getDailyByDate(this.spClient, params.recordDate, this.listTitleDaily);
  }

  public async upsertDailyByKey(
    item: AttendanceDailyItem,
    params?: AttendanceRepositoryUpsertParams,
  ): Promise<void> {
    if (params?.signal?.aborted) return;
    await upsertDailyByKey(this.spClient, item, this.listTitleDaily);
  }
}

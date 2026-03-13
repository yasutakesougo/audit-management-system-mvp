// ---------------------------------------------------------------------------
// MonitoringMeetingRepository — モニタリング会議記録のリポジトリ Port
// ---------------------------------------------------------------------------

import type { MonitoringMeetingRecord } from './monitoringMeeting';

export interface MonitoringMeetingRepository {
  /** 会議記録を保存（新規 or 更新） */
  save(record: MonitoringMeetingRecord): Promise<MonitoringMeetingRecord>;

  /** 全件取得 */
  getAll(): Promise<MonitoringMeetingRecord[]>;

  /** ID で取得 */
  getById(id: string): Promise<MonitoringMeetingRecord | null>;

  /** 利用者 ID で取得 */
  listByUser(userId: string): Promise<MonitoringMeetingRecord[]>;

  /** ISP ID で取得 */
  listByIsp(ispId: string): Promise<MonitoringMeetingRecord[]>;

  /** 削除 */
  delete(id: string): Promise<void>;
}

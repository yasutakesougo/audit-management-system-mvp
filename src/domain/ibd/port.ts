import type {
  SupervisionCounter,
  SupervisionLogRecord,
} from './supervisionTracking';

/**
 * 観察義務（2回に1回）追跡の永続化ポート。
 */
export interface SupervisionTrackingRepository {
  getCounter(userId: number): SupervisionCounter;
  incrementSupportCount(userId: number): SupervisionCounter;
  resetSupportCount(userId: number, observedAt: string): SupervisionCounter;
  listLogsForUser(userId: number): SupervisionLogRecord[];
  addSupervisionLog(log: SupervisionLogRecord): void;
  clearAll(): void;
}

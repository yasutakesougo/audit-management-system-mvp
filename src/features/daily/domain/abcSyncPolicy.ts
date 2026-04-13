import type { ABCRecord } from '@/domain/behavior';

export const ABC_SYNC_FAILURES_KEY = 'daily-support.abc-sync-failures.v1';
const MAX_FAILURE_LOGS = 100;

interface AbcSyncFailureLog {
  id: string;
  userId: string;
  recordedAt: string;
  occurredAt: string;
  error: string;
}

function readLogs(): AbcSyncFailureLog[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(ABC_SYNC_FAILURES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AbcSyncFailureLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLogs(logs: AbcSyncFailureLog[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ABC_SYNC_FAILURES_KEY, JSON.stringify(logs));
  } catch {
    // ログ保存失敗は submit 処理を止めない
  }
}

/**
 * A（Daily 保存）成功後、B（BehaviorObservationRepository）同期が失敗した時の記録ポリシー。
 * submit 全体は失敗にせず、警告ログを残す。
 */
export function recordAbcSyncFailure(record: ABCRecord, error: unknown): void {
  const logs = readLogs();
  const next: AbcSyncFailureLog[] = [
    {
      id: record.id,
      userId: record.userId,
      recordedAt: record.recordedAt,
      occurredAt: new Date().toISOString(),
      error: String((error as Error | undefined)?.message ?? error),
    },
    ...logs,
  ].slice(0, MAX_FAILURE_LOGS);

  writeLogs(next);
}

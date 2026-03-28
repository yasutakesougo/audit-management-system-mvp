/**
 * InMemoryCallLogRepository
 *
 * ローカル / デモ / E2E 環境向けのインメモリ実装。
 * SharePoint に依存しないため、環境変数なしで動作する。
 *
 * Factory から shouldSkipSharePoint() === true のときに注入される。
 */

import { nanoid } from 'nanoid';
import type { CallLog, CreateCallLogInput } from '@/domain/callLogs/schema';
import type { CallLogRepository, ListCallLogsOptions } from '@/domain/callLogs/repository';
import {
  applyCallLogStatusTransition,
  deriveInitialCallLogStatus,
} from '@/domain/callLogs/statusTransition';

const now = () => new Date().toISOString();
const E2E_CALL_LOGS_STORAGE_KEY = 'e2e:call-logs.v1';

export type InMemoryCallLogRepositoryOptions = {
  /**
   * true の場合は module-level store を共有する。
   * 同一画面内で複数 hook が repository を作っても同じデータを見るためのオプション。
   */
  useSharedStore?: boolean;
};

let sharedStore: Map<string, CallLog> | null = null;

/**
 * E2E fixture 注入ポイント:
 * localStorage.setItem('e2e:call-logs.v1', JSON.stringify([...CallLog]))
 */
const resolveE2eCallLogs = (): CallLog[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(E2E_CALL_LOGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as CallLog[];
  } catch {
    return null;
  }
};

export const __resetInMemoryCallLogStoreForTests = (): void => {
  sharedStore = null;
};

export class InMemoryCallLogRepository implements CallLogRepository {
  private store: Map<string, CallLog>;

  constructor(seed: CallLog[] = [], options: InMemoryCallLogRepositoryOptions = {}) {
    if (options.useSharedStore) {
      if (!sharedStore) {
        const initialSeed = seed.length > 0 ? seed : resolveE2eCallLogs() ?? [];
        sharedStore = new Map(initialSeed.map((log) => [log.id, log]));
      }
      this.store = sharedStore;
      return;
    }

    this.store = new Map(seed.map((log) => [log.id, log]));
  }

  async list(options?: ListCallLogsOptions): Promise<CallLog[]> {
    let items = Array.from(this.store.values());

    if (options?.status) {
      items = items.filter((l) => l.status === options.status);
    }

    if (options?.targetStaffName) {
      const name = options.targetStaffName;
      items = items.filter((l) => l.targetStaffName === name);
    }

    // 受電日時の降順
    return items.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }

  async create(input: CreateCallLogInput, receivedByName: string): Promise<CallLog> {
    const ts = now();
    const initialStatus = deriveInitialCallLogStatus(input);
    const log: CallLog = {
      id: nanoid(),
      receivedAt: input.receivedAt ?? ts,
      callerName: input.callerName,
      callerOrg: input.callerOrg,
      targetStaffName: input.targetStaffName,
      receivedByName,
      subject: input.subject,
      message: input.message,
      needCallback: input.needCallback,
      urgency: input.urgency ?? 'normal',
      status: initialStatus,
      relatedUserId: input.relatedUserId,
      relatedUserName: input.relatedUserName,
      callbackDueAt: input.callbackDueAt,
      completedAt: undefined,
      createdAt: ts,
      updatedAt: ts,
    };

    this.store.set(log.id, log);
    return log;
  }

  async updateStatus(id: string, status: CallLog['status']): Promise<void> {
    const existing = this.store.get(id);
    if (!existing) {
      throw new Error(`[InMemoryCallLogRepository] id=${id} not found`);
    }

    const nowDate = new Date();
    const ts = nowDate.toISOString();
    const transitioned = applyCallLogStatusTransition(
      {
        status: existing.status,
        completedAt: existing.completedAt,
      },
      status,
      nowDate,
    );

    this.store.set(id, {
      ...existing,
      status: transitioned.status,
      completedAt: transitioned.completedAt,
      updatedAt: ts,
    });
  }
}

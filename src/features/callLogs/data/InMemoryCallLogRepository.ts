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

const now = () => new Date().toISOString();

export class InMemoryCallLogRepository implements CallLogRepository {
  private store: Map<string, CallLog>;

  constructor(seed: CallLog[] = []) {
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
      status: 'new',
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

    const ts = now();
    this.store.set(id, {
      ...existing,
      status,
      completedAt: status === 'done' ? ts : existing.completedAt,
      updatedAt: ts,
    });
  }
}

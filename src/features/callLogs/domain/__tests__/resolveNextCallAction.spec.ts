/**
 * resolveNextCallAction — pure function テスト
 *
 * 対象:
 *   - 全件 done → null
 *   - 単一 overdue → reason: overdue
 *   - overdue > due-soon > urgent > today > new の優先度
 *   - 同一 reason 内での並び順
 *   - dueInfo が overdue / due-soon のみ付くこと
 */

import { describe, it, expect } from 'vitest';
import { resolveNextCallAction } from '../resolveNextCallAction';
import type { CallLog } from '@/domain/callLogs/schema';

const NOW = new Date('2026-03-19T12:00:00Z');

// ─── ヘルパー: テスト用 CallLog 生成 ─────────────────────────────────────────

let _idSeq = 0;
function makeCallLog(overrides: Partial<CallLog> = {}): CallLog {
  _idSeq++;
  return {
    id: `test-${_idSeq}`,
    receivedAt: '2026-03-19T10:00:00Z',
    callerName: 'テスト太郎',
    targetStaffName: '担当者',
    receivedByName: '受付者',
    subject: 'テスト件名',
    message: 'テスト本文',
    needCallback: false,
    urgency: 'normal',
    status: 'new',
    createdAt: '2026-03-19T10:00:00Z',
    updatedAt: '2026-03-19T10:00:00Z',
    ...overrides,
  };
}

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('resolveNextCallAction', () => {
  beforeEach(() => { _idSeq = 0; });

  // ── null 判定 ──

  it('should return null for empty array', () => {
    expect(resolveNextCallAction([], NOW)).toBeNull();
  });

  it('should return null when all logs are done', () => {
    const logs = [
      makeCallLog({ status: 'done' }),
      makeCallLog({ status: 'done' }),
    ];
    expect(resolveNextCallAction(logs, NOW)).toBeNull();
  });

  // ── 単一ログ ──

  it('should return open log with reason: new', () => {
    const log = makeCallLog({ status: 'new' });
    const result = resolveNextCallAction([log], NOW);
    expect(result).not.toBeNull();
    expect(result!.log.id).toBe(log.id);
    expect(result!.reason).toBe('new');
    expect(result!.dueInfo).toBeNull();
  });

  it('should return overdue log with reason: overdue and dueInfo', () => {
    const log = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T10:00:00Z', // 2時間超過
    });
    const result = resolveNextCallAction([log], NOW);
    expect(result).not.toBeNull();
    expect(result!.reason).toBe('overdue');
    expect(result!.dueInfo).not.toBeNull();
    expect(result!.dueInfo!.level).toBe('overdue');
  });

  // ── 優先度ルール ──

  it('should prioritize overdue over urgent', () => {
    const urgentLog = makeCallLog({ urgency: 'urgent', status: 'new' });
    const overdueLog = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T11:00:00Z', // 1時間超過
    });
    const result = resolveNextCallAction([urgentLog, overdueLog], NOW);
    expect(result!.log.id).toBe(overdueLog.id);
    expect(result!.reason).toBe('overdue');
  });

  it('should prioritize due-soon over urgent', () => {
    const urgentLog = makeCallLog({ urgency: 'urgent', status: 'new' });
    const dueSoonLog = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T13:00:00Z', // 1時間後（2h以内）
    });
    const result = resolveNextCallAction([urgentLog, dueSoonLog], NOW);
    expect(result!.log.id).toBe(dueSoonLog.id);
    expect(result!.reason).toBe('due-soon');
  });

  it('should prioritize urgent over today', () => {
    const todayLog = makeCallLog({ urgency: 'today', status: 'new' });
    const urgentLog = makeCallLog({ urgency: 'urgent', status: 'new' });
    const result = resolveNextCallAction([todayLog, urgentLog], NOW);
    expect(result!.log.id).toBe(urgentLog.id);
    expect(result!.reason).toBe('urgent');
  });

  it('should prioritize today over new', () => {
    const newLog = makeCallLog({ urgency: 'normal', status: 'new' });
    const todayLog = makeCallLog({ urgency: 'today', status: 'new' });
    const result = resolveNextCallAction([newLog, todayLog], NOW);
    expect(result!.log.id).toBe(todayLog.id);
    expect(result!.reason).toBe('today');
  });

  // ── 同一 reason 内のソート ──

  it('should pick the longest-overdue log among multiple overdue', () => {
    const recent = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T11:30:00Z', // 30分超過
    });
    const old = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T09:00:00Z', // 3時間超過
    });
    const result = resolveNextCallAction([recent, old], NOW);
    expect(result!.log.id).toBe(old.id);
    expect(result!.reason).toBe('overdue');
  });

  it('should pick the nearest-due log among multiple due-soon', () => {
    const far = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T13:30:00Z', // 1.5時間後
    });
    const near = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T12:30:00Z', // 30分後
    });
    const result = resolveNextCallAction([far, near], NOW);
    expect(result!.log.id).toBe(near.id);
    expect(result!.reason).toBe('due-soon');
  });

  it('should pick the newest-received log among same-urgency open logs', () => {
    const older = makeCallLog({
      status: 'new',
      receivedAt: '2026-03-19T08:00:00Z',
    });
    const newer = makeCallLog({
      status: 'new',
      receivedAt: '2026-03-19T11:00:00Z',
    });
    const result = resolveNextCallAction([older, newer], NOW);
    expect(result!.log.id).toBe(newer.id);
    expect(result!.reason).toBe('new');
  });

  // ── done をスキップ ──

  it('should skip done logs and return the open one', () => {
    const doneLogs = [
      makeCallLog({ status: 'done' }),
      makeCallLog({ status: 'done' }),
    ];
    const openLog = makeCallLog({ status: 'new' });
    const result = resolveNextCallAction([...doneLogs, openLog], NOW);
    expect(result!.log.id).toBe(openLog.id);
  });

  // ── 全優先度混在 ──

  it('should handle mixed priorities correctly', () => {
    const logs = [
      makeCallLog({ status: 'new', urgency: 'normal' }),
      makeCallLog({ status: 'new', urgency: 'today' }),
      makeCallLog({ status: 'new', urgency: 'urgent' }),
      makeCallLog({
        status: 'callback_pending',
        callbackDueAt: '2026-03-19T13:00:00Z', // due-soon
      }),
      makeCallLog({
        status: 'callback_pending',
        callbackDueAt: '2026-03-19T10:00:00Z', // overdue
      }),
      makeCallLog({ status: 'done' }),
    ];
    const result = resolveNextCallAction(logs, NOW);
    expect(result!.reason).toBe('overdue');
  });
});

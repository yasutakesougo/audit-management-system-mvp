/**
 * schema.ts — 純粋ヘルパー関数テスト
 *
 * 対象:
 *   - isOpenCallLog
 *   - isUrgentCallLog
 *   - isTodayOrUrgentCallLog
 *   - isCallbackOverdue
 */

import { describe, it, expect } from 'vitest';
import {
  isOpenCallLog,
  isUrgentCallLog,
  isTodayOrUrgentCallLog,
  isCallbackOverdue,
  type CallLog,
} from '@/domain/callLogs/schema';

// ─── テストデータビルダー ─────────────────────────────────────────────────────

function makeCallLog(overrides?: Partial<CallLog>): CallLog {
  return {
    id: 'test-id',
    receivedAt: '2026-03-18T09:00:00.000Z',
    callerName: '田中太郎',
    callerOrg: 'テスト機関',
    targetStaffName: '山田スタッフ',
    receivedByName: '受付者',
    subject: 'テスト件名',
    message: 'テスト本文',
    needCallback: false,
    urgency: 'normal',
    status: 'new',
    createdAt: '2026-03-18T09:00:00.000Z',
    updatedAt: '2026-03-18T09:00:00.000Z',
    ...overrides,
  };
}

// ─── isOpenCallLog ────────────────────────────────────────────────────────────

describe('isOpenCallLog', () => {
  it('should return true when status is "new"', () => {
    expect(isOpenCallLog(makeCallLog({ status: 'new' }))).toBe(true);
  });

  it('should return true when status is "callback_pending"', () => {
    expect(isOpenCallLog(makeCallLog({ status: 'callback_pending' }))).toBe(true);
  });

  it('should return false when status is "done"', () => {
    expect(isOpenCallLog(makeCallLog({ status: 'done' }))).toBe(false);
  });
});

// ─── isUrgentCallLog ─────────────────────────────────────────────────────────

describe('isUrgentCallLog', () => {
  it('should return true when urgency is "urgent"', () => {
    expect(isUrgentCallLog(makeCallLog({ urgency: 'urgent' }))).toBe(true);
  });

  it('should return false when urgency is "today"', () => {
    expect(isUrgentCallLog(makeCallLog({ urgency: 'today' }))).toBe(false);
  });

  it('should return false when urgency is "normal"', () => {
    expect(isUrgentCallLog(makeCallLog({ urgency: 'normal' }))).toBe(false);
  });
});

// ─── isTodayOrUrgentCallLog ───────────────────────────────────────────────────

describe('isTodayOrUrgentCallLog', () => {
  it('should return true when urgency is "urgent"', () => {
    expect(isTodayOrUrgentCallLog(makeCallLog({ urgency: 'urgent' }))).toBe(true);
  });

  it('should return true when urgency is "today"', () => {
    expect(isTodayOrUrgentCallLog(makeCallLog({ urgency: 'today' }))).toBe(true);
  });

  it('should return false when urgency is "normal"', () => {
    expect(isTodayOrUrgentCallLog(makeCallLog({ urgency: 'normal' }))).toBe(false);
  });
});

// ─── isCallbackOverdue ────────────────────────────────────────────────────────

describe('isCallbackOverdue', () => {
  const PAST = '2026-03-17T00:00:00.000Z';
  const FUTURE = '2099-01-01T00:00:00.000Z';
  const NOW = new Date('2026-03-18T12:00:00.000Z');

  it('should return false when status is not callback_pending', () => {
    const log = makeCallLog({ status: 'new', callbackDueAt: PAST });
    expect(isCallbackOverdue(log, NOW)).toBe(false);
  });

  it('should return false when callbackDueAt is undefined', () => {
    const log = makeCallLog({ status: 'callback_pending', callbackDueAt: undefined });
    expect(isCallbackOverdue(log, NOW)).toBe(false);
  });

  it('should return true when callbackDueAt is in the past', () => {
    const log = makeCallLog({ status: 'callback_pending', callbackDueAt: PAST });
    expect(isCallbackOverdue(log, NOW)).toBe(true);
  });

  it('should return false when callbackDueAt is in the future', () => {
    const log = makeCallLog({ status: 'callback_pending', callbackDueAt: FUTURE });
    expect(isCallbackOverdue(log, NOW)).toBe(false);
  });

  it('should use current time when now is not provided', () => {
    // 過去日付なので、現在時刻より必ず前になる
    const log = makeCallLog({ status: 'callback_pending', callbackDueAt: PAST });
    expect(isCallbackOverdue(log)).toBe(true);
  });
});

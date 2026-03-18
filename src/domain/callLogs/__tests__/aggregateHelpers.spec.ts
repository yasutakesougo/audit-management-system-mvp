/**
 * 集計ヘルパー（Today 連携用） — 単体テスト
 *
 * 対象:
 *   - countOpenCallLogs
 *   - countUrgentOpenCallLogs
 *   - countCallbackPendingCallLogs
 */

import { describe, it, expect } from 'vitest';
import type { CallLog } from '../schema';
import {
  countOpenCallLogs,
  countUrgentOpenCallLogs,
  countCallbackPendingCallLogs,
  countMyOpenCallLogs,
  countOverdueCallLogs,
} from '../schema';

// ─── テストデータビルダー ─────────────────────────────────────────────────────

function makeLog(overrides?: Partial<CallLog>): CallLog {
  return {
    id: 'log-1',
    receivedAt: '2026-03-18T09:00:00.000Z',
    callerName: '田中太郎',
    targetStaffName: '山田スタッフ',
    receivedByName: '受付者A',
    subject: '件名',
    message: '本文',
    needCallback: false,
    urgency: 'normal',
    status: 'new',
    createdAt: '2026-03-18T09:00:00.000Z',
    updatedAt: '2026-03-18T09:00:00.000Z',
    ...overrides,
  };
}

// ─── countOpenCallLogs ────────────────────────────────────────────────────────

describe('countOpenCallLogs', () => {
  it('should return 0 for empty array', () => {
    expect(countOpenCallLogs([])).toBe(0);
  });

  it('should count new and callback_pending as open', () => {
    const logs = [
      makeLog({ status: 'new' }),
      makeLog({ status: 'callback_pending' }),
      makeLog({ status: 'done' }),
    ];
    expect(countOpenCallLogs(logs)).toBe(2);
  });

  it('should not count done logs', () => {
    const logs = [makeLog({ status: 'done' }), makeLog({ status: 'done' })];
    expect(countOpenCallLogs(logs)).toBe(0);
  });

  it('should count all when all are new', () => {
    const logs = [makeLog({ status: 'new' }), makeLog({ status: 'new' })];
    expect(countOpenCallLogs(logs)).toBe(2);
  });
});

// ─── countUrgentOpenCallLogs ──────────────────────────────────────────────────

describe('countUrgentOpenCallLogs', () => {
  it('should return 0 for empty array', () => {
    expect(countUrgentOpenCallLogs([])).toBe(0);
  });

  it('should count only urgent + not done', () => {
    const logs = [
      makeLog({ status: 'new', urgency: 'urgent' }),
      makeLog({ status: 'new', urgency: 'normal' }),
      makeLog({ status: 'done', urgency: 'urgent' }), // done なので除外
    ];
    expect(countUrgentOpenCallLogs(logs)).toBe(1);
  });

  it('should not count urgent logs that are done', () => {
    const logs = [makeLog({ status: 'done', urgency: 'urgent' })];
    expect(countUrgentOpenCallLogs(logs)).toBe(0);
  });

  it('should count urgent+callback_pending as open', () => {
    const logs = [makeLog({ status: 'callback_pending', urgency: 'urgent' })];
    expect(countUrgentOpenCallLogs(logs)).toBe(1);
  });
});

// ─── countCallbackPendingCallLogs ─────────────────────────────────────────────

describe('countCallbackPendingCallLogs', () => {
  it('should return 0 for empty array', () => {
    expect(countCallbackPendingCallLogs([])).toBe(0);
  });

  it('should count only callback_pending', () => {
    const logs = [
      makeLog({ status: 'new' }),
      makeLog({ status: 'callback_pending' }),
      makeLog({ status: 'callback_pending' }),
      makeLog({ status: 'done' }),
    ];
    expect(countCallbackPendingCallLogs(logs)).toBe(2);
  });

  it('should return 0 when all are done', () => {
    const logs = [makeLog({ status: 'done' })];
    expect(countCallbackPendingCallLogs(logs)).toBe(0);
  });
});

// ─── countMyOpenCallLogs ──────────────────────────────────────────────────────

describe('countMyOpenCallLogs', () => {
  it('should return 0 for empty array', () => {
    expect(countMyOpenCallLogs([], '山田')).toBe(0);
  });

  it('should return 0 when myName is empty string', () => {
    const logs = [makeLog({ status: 'new', targetStaffName: '山田' })];
    expect(countMyOpenCallLogs(logs, '')).toBe(0);
  });

  it('should count only open logs targeted at myName', () => {
    const logs = [
      makeLog({ status: 'new', targetStaffName: '山田' }),           // カウント
      makeLog({ status: 'callback_pending', targetStaffName: '山田' }), // カウント
      makeLog({ status: 'done', targetStaffName: '山田' }),           // done → 除外
      makeLog({ status: 'new', targetStaffName: '佐藤' }),            // 別スタッフ → 除外
    ];
    expect(countMyOpenCallLogs(logs, '山田')).toBe(2);
  });

  it('should return 0 when myName does not match any targetStaffName', () => {
    const logs = [makeLog({ status: 'new', targetStaffName: '佐藤' })];
    expect(countMyOpenCallLogs(logs, '山田')).toBe(0);
  });

  it('should handle whitespace around names with trim()', () => {
    const logs = [makeLog({ status: 'new', targetStaffName: ' 山田 ' })];
    expect(countMyOpenCallLogs(logs, '山田')).toBe(1);
  });
});

// ─── countOverdueCallLogs ─────────────────────────────────────────────────────

describe('countOverdueCallLogs', () => {
  const PAST = '2026-01-01T00:00:00.000Z';
  const FUTURE = '2099-12-31T23:59:59.000Z';
  const NOW = new Date('2026-03-18T10:00:00.000Z');

  it('should return 0 for empty array', () => {
    expect(countOverdueCallLogs([], NOW)).toBe(0);
  });

  it('should count callback_pending logs whose callbackDueAt is in the past', () => {
    const logs = [
      makeLog({ status: 'callback_pending', callbackDueAt: PAST }),  // 期限超過
      makeLog({ status: 'callback_pending', callbackDueAt: FUTURE }), // 期限内
      makeLog({ status: 'new', callbackDueAt: PAST }),                // callback_pending ではない
      makeLog({ status: 'done', callbackDueAt: PAST }),               // done → 除外
    ];
    expect(countOverdueCallLogs(logs, NOW)).toBe(1);
  });

  it('should return 0 when callbackDueAt is in the future', () => {
    const logs = [makeLog({ status: 'callback_pending', callbackDueAt: FUTURE })];
    expect(countOverdueCallLogs(logs, NOW)).toBe(0);
  });

  it('should return 0 when callbackDueAt is not set', () => {
    const logs = [makeLog({ status: 'callback_pending', callbackDueAt: undefined })];
    expect(countOverdueCallLogs(logs, NOW)).toBe(0);
  });

  it('should count multiple overdue logs correctly', () => {
    const logs = [
      makeLog({ status: 'callback_pending', callbackDueAt: PAST }),
      makeLog({ status: 'callback_pending', callbackDueAt: PAST }),
      makeLog({ status: 'callback_pending', callbackDueAt: FUTURE }),
    ];
    expect(countOverdueCallLogs(logs, NOW)).toBe(2);
  });
});

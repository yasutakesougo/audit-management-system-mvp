/**
 * groupCallLogsByPriority — pure function テスト
 *
 * 対象:
 *   - 空配列 → 空グループ
 *   - 全件 done → 空グループ
 *   - overdue / due-soon / open の正しい振り分け
 *   - 各グループ内のソート順
 *   - 空グループが結果に含まれないこと
 */

import { describe, it, expect } from 'vitest';
import { groupCallLogsByPriority } from '../groupCallLogsByPriority';
import type { CallLog } from '@/domain/callLogs/schema';

const NOW = new Date('2026-03-19T12:00:00Z');

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

let _idSeq = 0;
function makeCallLog(overrides: Partial<CallLog> = {}): CallLog {
  _idSeq++;
  return {
    id: `grp-${_idSeq}`,
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

describe('groupCallLogsByPriority', () => {
  beforeEach(() => { _idSeq = 0; });

  // ── 空・全件 done ──

  it('should return empty array for empty input', () => {
    expect(groupCallLogsByPriority([], NOW)).toEqual([]);
  });

  it('should return empty array when all logs are done', () => {
    const logs = [
      makeCallLog({ status: 'done' }),
      makeCallLog({ status: 'done' }),
    ];
    expect(groupCallLogsByPriority(logs, NOW)).toEqual([]);
  });

  // ── 振り分け ──

  it('should group overdue logs correctly', () => {
    const log = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T10:00:00Z', // 2時間超過
    });
    const groups = groupCallLogsByPriority([log], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('overdue');
    expect(groups[0].label).toBe('期限超過');
    expect(groups[0].logs).toHaveLength(1);
  });

  it('should group due-soon logs correctly', () => {
    const log = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T13:00:00Z', // 1時間後
    });
    const groups = groupCallLogsByPriority([log], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('due-soon');
    expect(groups[0].label).toBe('今日期限');
  });

  it('should group open (no due) logs correctly', () => {
    const log = makeCallLog({ status: 'new', urgency: 'normal' });
    const groups = groupCallLogsByPriority([log], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('open');
    expect(groups[0].label).toBe('未対応');
  });

  // ── 混在時のグループ順序 ──

  it('should order groups: overdue → due-soon → open', () => {
    const logs = [
      makeCallLog({ status: 'new', urgency: 'normal' }),                                 // open
      makeCallLog({ status: 'callback_pending', callbackDueAt: '2026-03-19T13:00:00Z' }), // due-soon
      makeCallLog({ status: 'callback_pending', callbackDueAt: '2026-03-19T10:00:00Z' }), // overdue
    ];
    const groups = groupCallLogsByPriority(logs, NOW);
    expect(groups).toHaveLength(3);
    expect(groups[0].key).toBe('overdue');
    expect(groups[1].key).toBe('due-soon');
    expect(groups[2].key).toBe('open');
  });

  // ── 空グループは含まれない ──

  it('should omit empty groups', () => {
    const logs = [
      makeCallLog({ status: 'new', urgency: 'urgent' }),  // open
      makeCallLog({ status: 'new', urgency: 'normal' }),   // open
    ];
    const groups = groupCallLogsByPriority(logs, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('open');
  });

  // ── overdue グループ内ソート（超過時間が長い方が先） ──

  it('should sort overdue logs by oldest due first', () => {
    const older = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T08:00:00Z', // 4時間超過
    });
    const newer = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T11:00:00Z', // 1時間超過
    });
    const groups = groupCallLogsByPriority([newer, older], NOW);
    expect(groups[0].logs[0].id).toBe(older.id);
    expect(groups[0].logs[1].id).toBe(newer.id);
  });

  // ── due-soon グループ内ソート（期限が近い方が先） ──

  it('should sort due-soon logs by nearest due first', () => {
    const far = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T13:30:00Z', // 1.5時間後
    });
    const near = makeCallLog({
      status: 'callback_pending',
      callbackDueAt: '2026-03-19T12:15:00Z', // 15分後
    });
    const groups = groupCallLogsByPriority([far, near], NOW);
    expect(groups[0].logs[0].id).toBe(near.id);
    expect(groups[0].logs[1].id).toBe(far.id);
  });

  // ── open グループ内ソート（urgency 降順 → 受電新しい順） ──

  it('should sort open logs by urgency desc then receivedAt desc', () => {
    const normalOld = makeCallLog({
      status: 'new', urgency: 'normal',
      receivedAt: '2026-03-19T08:00:00Z',
    });
    const normalNew = makeCallLog({
      status: 'new', urgency: 'normal',
      receivedAt: '2026-03-19T11:00:00Z',
    });
    const urgentLog = makeCallLog({
      status: 'new', urgency: 'urgent',
      receivedAt: '2026-03-19T09:00:00Z',
    });
    const todayLog = makeCallLog({
      status: 'new', urgency: 'today',
      receivedAt: '2026-03-19T10:00:00Z',
    });

    const groups = groupCallLogsByPriority([normalOld, normalNew, urgentLog, todayLog], NOW);
    const openGroup = groups.find(g => g.key === 'open')!;
    expect(openGroup.logs[0].id).toBe(urgentLog.id);   // urgent first
    expect(openGroup.logs[1].id).toBe(todayLog.id);     // then today
    expect(openGroup.logs[2].id).toBe(normalNew.id);    // then normal (newer)
    expect(openGroup.logs[3].id).toBe(normalOld.id);    // then normal (older)
  });

  // ── done をスキップ ──

  it('should skip done logs entirely', () => {
    const logs = [
      makeCallLog({ status: 'done' }),
      makeCallLog({ status: 'new' }),
    ];
    const groups = groupCallLogsByPriority(logs, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].logs).toHaveLength(1);
  });

  // ── callback_pending without due → open に入る ──

  it('should put callback_pending without due into open group', () => {
    const log = makeCallLog({
      status: 'callback_pending',
      // callbackDueAt 未設定 → getCallbackDueInfo returns 'none'
    });
    const groups = groupCallLogsByPriority([log], NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('open');
  });
});

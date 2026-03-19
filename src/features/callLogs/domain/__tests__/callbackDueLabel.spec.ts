/**
 * callbackDueLabel — pure function テスト
 *
 * 対象:
 *   - status が callback_pending でない → none
 *   - callbackDueAt 未設定 → none + 期限未設定
 *   - 期限超過 → overdue
 *   - 2時間以内 → due-soon
 *   - 2時間以上先 → due-later
 *   - 境界値テスト
 */

import { describe, it, expect } from 'vitest';
import { getCallbackDueInfo } from '../callbackDueLabel';

const NOW = new Date('2026-03-19T12:00:00Z');

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function makeLog(overrides: { status?: string; callbackDueAt?: string }) {
  return {
    status: overrides.status ?? 'callback_pending',
    callbackDueAt: overrides.callbackDueAt,
  } as { status: 'callback_pending' | 'new' | 'done'; callbackDueAt?: string };
}

// ─── テスト ───────────────────────────────────────────────────────────────────

describe('getCallbackDueInfo', () => {
  // ── none 判定 ──

  it('should return none for status=new', () => {
    const result = getCallbackDueInfo(makeLog({ status: 'new', callbackDueAt: '2026-03-19T10:00:00Z' }), NOW);
    expect(result.level).toBe('none');
    expect(result.label).toBe('');
  });

  it('should return none for status=done', () => {
    const result = getCallbackDueInfo(makeLog({ status: 'done', callbackDueAt: '2026-03-19T10:00:00Z' }), NOW);
    expect(result.level).toBe('none');
    expect(result.label).toBe('');
  });

  it('should return none with label for callback_pending without callbackDueAt', () => {
    const result = getCallbackDueInfo(makeLog({ callbackDueAt: undefined }), NOW);
    expect(result.level).toBe('none');
    expect(result.label).toBe('期限未設定');
  });

  // ── overdue 判定 ──

  it('should return overdue when callbackDueAt is 30 minutes past', () => {
    const result = getCallbackDueInfo(
      makeLog({ callbackDueAt: '2026-03-19T11:30:00Z' }), // 30分前
      NOW,
    );
    expect(result.level).toBe('overdue');
    expect(result.label).toContain('期限超過');
    expect(result.label).toContain('30分');
  });

  it('should return overdue when callbackDueAt is 3 hours past', () => {
    const result = getCallbackDueInfo(
      makeLog({ callbackDueAt: '2026-03-19T09:00:00Z' }), // 3時間前
      NOW,
    );
    expect(result.level).toBe('overdue');
    expect(result.label).toContain('期限超過');
    expect(result.label).toContain('3時間');
  });

  it('should return overdue when callbackDueAt is 2 days past', () => {
    const result = getCallbackDueInfo(
      makeLog({ callbackDueAt: '2026-03-17T12:00:00Z' }), // 2日前
      NOW,
    );
    expect(result.level).toBe('overdue');
    expect(result.label).toContain('2日');
  });

  // ── due-soon 判定（2時間以内） ──

  it('should return due-soon when callbackDueAt is 30 minutes ahead', () => {
    const result = getCallbackDueInfo(
      makeLog({ callbackDueAt: '2026-03-19T12:30:00Z' }), // 30分後
      NOW,
    );
    expect(result.level).toBe('due-soon');
    expect(result.label).toContain('あと');
    expect(result.label).toContain('30分');
  });

  it('should return due-soon when callbackDueAt is 1 hour 45 minutes ahead', () => {
    const result = getCallbackDueInfo(
      makeLog({ callbackDueAt: '2026-03-19T13:45:00Z' }), // 1時間45分後
      NOW,
    );
    expect(result.level).toBe('due-soon');
    expect(result.label).toContain('あと');
    expect(result.label).toContain('1時間45分');
  });

  // ── due-later 判定（2時間以上先） ──

  it('should return due-later when callbackDueAt is 5 hours ahead', () => {
    const result = getCallbackDueInfo(
      makeLog({ callbackDueAt: '2026-03-19T17:00:00Z' }), // 5時間後
      NOW,
    );
    expect(result.level).toBe('due-later');
    expect(result.label).toContain('期限:');
  });

  it('should return due-later when callbackDueAt is next day', () => {
    const result = getCallbackDueInfo(
      makeLog({ callbackDueAt: '2026-03-20T15:00:00Z' }), // 翌日
      NOW,
    );
    expect(result.level).toBe('due-later');
    expect(result.label).toContain('期限:');
  });

  // ── 境界値 ──

  it('should return overdue at exactly 1 minute past due', () => {
    const result = getCallbackDueInfo(
      makeLog({ callbackDueAt: '2026-03-19T11:59:00Z' }), // ちょうど1分超過
      NOW,
    );
    expect(result.level).toBe('overdue');
  });

  it('should return due-soon at exactly 2 hours before due', () => {
    const result = getCallbackDueInfo(
      makeLog({ callbackDueAt: '2026-03-19T14:00:00Z' }), // ちょうど2時間後
      NOW,
    );
    expect(result.level).toBe('due-soon');
  });

  it('should return due-later at exactly 2 hours 1 minute before due', () => {
    const result = getCallbackDueInfo(
      makeLog({ callbackDueAt: '2026-03-19T14:01:00Z' }), // 2時間1分後
      NOW,
    );
    expect(result.level).toBe('due-later');
  });

  it('should return due-soon at exactly 0 minutes remaining', () => {
    const result = getCallbackDueInfo(
      makeLog({ callbackDueAt: '2026-03-19T12:00:00Z' }), // ちょうど今
      NOW,
    );
    // diff === 0 → 0 <= threshold → due-soon
    expect(result.level).toBe('due-soon');
    expect(result.label).toContain('あと');
    expect(result.label).toContain('0分');
  });
});

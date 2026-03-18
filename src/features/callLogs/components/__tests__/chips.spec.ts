/**
 * CallLogStatusChip / CallLogUrgencyChip テスト
 *
 * 対象:
 *   - getCallLogStatusLabel   純粋ヘルパー
 *   - getCallLogUrgencyLabel  純粋ヘルパー
 *   - CALL_LOG_STATUS_CONFIG  設定値の完全性
 *   - CALL_LOG_URGENCY_CONFIG 設定値の完全性
 */

import { describe, it, expect } from 'vitest';
import {
  getCallLogStatusLabel,
  CALL_LOG_STATUS_CONFIG,
} from '../CallLogStatusChip';
import {
  getCallLogUrgencyLabel,
  CALL_LOG_URGENCY_CONFIG,
} from '../CallLogUrgencyChip';
import type { CallLogStatus, CallLogUrgency } from '@/domain/callLogs/schema';

// ─── getCallLogStatusLabel ────────────────────────────────────────────────────

describe('getCallLogStatusLabel', () => {
  it('should return "未対応" for "new"', () => {
    expect(getCallLogStatusLabel('new')).toBe('未対応');
  });

  it('should return "折返し待ち" for "callback_pending"', () => {
    expect(getCallLogStatusLabel('callback_pending')).toBe('折返し待ち');
  });

  it('should return "完了" for "done"', () => {
    expect(getCallLogStatusLabel('done')).toBe('完了');
  });
});

// ─── CALL_LOG_STATUS_CONFIG 完全性 ──────────────────────────────────────────

describe('CALL_LOG_STATUS_CONFIG', () => {
  const allStatuses: CallLogStatus[] = ['new', 'callback_pending', 'done'];

  it.each(allStatuses)('should have an entry for status "%s"', (status) => {
    expect(CALL_LOG_STATUS_CONFIG[status]).toBeDefined();
    expect(CALL_LOG_STATUS_CONFIG[status].label.length).toBeGreaterThan(0);
    expect(CALL_LOG_STATUS_CONFIG[status].color).toBeDefined();
  });
});

// ─── getCallLogUrgencyLabel ───────────────────────────────────────────────────

describe('getCallLogUrgencyLabel', () => {
  it('should return "通常" for "normal"', () => {
    expect(getCallLogUrgencyLabel('normal')).toBe('通常');
  });

  it('should return "本日中" for "today"', () => {
    expect(getCallLogUrgencyLabel('today')).toBe('本日中');
  });

  it('should return "至急" for "urgent"', () => {
    expect(getCallLogUrgencyLabel('urgent')).toBe('至急');
  });
});

// ─── CALL_LOG_URGENCY_CONFIG 完全性 ─────────────────────────────────────────

describe('CALL_LOG_URGENCY_CONFIG', () => {
  const allUrgencies: CallLogUrgency[] = ['normal', 'today', 'urgent'];

  it.each(allUrgencies)('should have an entry for urgency "%s"', (urgency) => {
    expect(CALL_LOG_URGENCY_CONFIG[urgency]).toBeDefined();
    expect(CALL_LOG_URGENCY_CONFIG[urgency].label.length).toBeGreaterThan(0);
    expect(CALL_LOG_URGENCY_CONFIG[urgency].color).toBeDefined();
  });
});

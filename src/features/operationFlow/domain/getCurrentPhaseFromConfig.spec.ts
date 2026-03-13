import { describe, it, expect } from 'vitest';
import { getCurrentPhaseFromConfig, parseTimeToMinutes } from './getCurrentPhaseFromConfig';
import { DEFAULT_PHASE_CONFIG } from './defaultPhaseConfig';

// ────────────────────────────────────────
// ヘルパー
// ────────────────────────────────────────

/** HH:mm → Date を生成（日付部分は不問） */
function dateAt(time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(2026, 2, 13); // 2026-03-13 任意の日
  d.setHours(h, m, 0, 0);
  return d;
}

// ────────────────────────────────────────
// parseTimeToMinutes
// ────────────────────────────────────────

describe('parseTimeToMinutes', () => {
  it('converts "00:00" to 0', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
  });

  it('converts "08:30" to 510', () => {
    expect(parseTimeToMinutes('08:30')).toBe(510);
  });

  it('converts "23:59" to 1439', () => {
    expect(parseTimeToMinutes('23:59')).toBe(1439);
  });

  it('throws on invalid format "8:30:00"', () => {
    expect(() => parseTimeToMinutes('8:30:00')).toThrow(RangeError);
  });

  it('throws on out-of-range hour "25:00"', () => {
    expect(() => parseTimeToMinutes('25:00')).toThrow(RangeError);
  });

  it('throws on out-of-range minute "08:60"', () => {
    expect(() => parseTimeToMinutes('08:60')).toThrow(RangeError);
  });

  it('throws on non-numeric "ab:cd"', () => {
    expect(() => parseTimeToMinutes('ab:cd')).toThrow(RangeError);
  });
});

// ────────────────────────────────────────
// getCurrentPhaseFromConfig — 境界値テスト
// ────────────────────────────────────────

describe('getCurrentPhaseFromConfig', () => {
  const config = DEFAULT_PHASE_CONFIG;

  // ── ユーザー指定の境界値テスト ──

  it('08:29 → after_hours_review（振り返り側に含まれる）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('08:29'), config)).toBe('after_hours_review');
  });

  it('08:30 → staff_prep（朝準備の開始）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('08:30'), config)).toBe('staff_prep');
  });

  it('09:00 → morning_briefing（朝会の開始）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('09:00'), config)).toBe('morning_briefing');
  });

  it('09:15 → arrival_intake（通所受入の開始）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('09:15'), config)).toBe('arrival_intake');
  });

  it('10:30 → am_activity（午前活動の開始）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('10:30'), config)).toBe('am_activity');
  });

  it('15:30 → departure_support（退所対応の開始）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('15:30'), config)).toBe('departure_support');
  });

  it('16:00 → record_wrapup（記録仕上げの開始）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('16:00'), config)).toBe('record_wrapup');
  });

  it('17:00 → evening_briefing（夕会の開始）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('17:00'), config)).toBe('evening_briefing');
  });

  it('18:00 → after_hours_review（振り返りの開始）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('18:00'), config)).toBe('after_hours_review');
  });

  // ── 日またぎ境界テスト ──

  it('00:00 → after_hours_review（深夜0時は日またぎ範囲内）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('00:00'), config)).toBe('after_hours_review');
  });

  it('03:00 → after_hours_review（深夜3時も日またぎ範囲内）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('03:00'), config)).toBe('after_hours_review');
  });

  it('23:59 → after_hours_review（23:59も日またぎ範囲内）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('23:59'), config)).toBe('after_hours_review');
  });

  // ── 各フェーズ中間値テスト ──

  it('08:45 → staff_prep（朝準備の中間）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('08:45'), config)).toBe('staff_prep');
  });

  it('09:10 → morning_briefing（朝会の中間）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('09:10'), config)).toBe('morning_briefing');
  });

  it('09:50 → arrival_intake（通所受入の中間）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('09:50'), config)).toBe('arrival_intake');
  });

  it('11:00 → am_activity（午前活動の中間）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('11:00'), config)).toBe('am_activity');
  });

  it('14:00 → pm_activity（午後活動の中間）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('14:00'), config)).toBe('pm_activity');
  });

  it('15:45 → departure_support（退所対応の中間）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('15:45'), config)).toBe('departure_support');
  });

  it('16:30 → record_wrapup（記録仕上げの中間）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('16:30'), config)).toBe('record_wrapup');
  });

  it('17:30 → evening_briefing（夕会の中間）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('17:30'), config)).toBe('evening_briefing');
  });

  it('20:00 → after_hours_review（振り返りの中間）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('20:00'), config)).toBe('after_hours_review');
  });

  // ── 各フェーズ終了直前テスト（end exclusive） ──

  it('08:59 → staff_prep（朝準備の終了1分前）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('08:59'), config)).toBe('staff_prep');
  });

  it('09:14 → morning_briefing（朝会の終了1分前）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('09:14'), config)).toBe('morning_briefing');
  });

  it('10:29 → arrival_intake（通所受入の終了1分前）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('10:29'), config)).toBe('arrival_intake');
  });

  it('11:59 → am_activity（午前活動の終了1分前）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('11:59'), config)).toBe('am_activity');
  });

  it('15:29 → pm_activity（午後活動の終了1分前）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('15:29'), config)).toBe('pm_activity');
  });

  it('15:59 → departure_support（退所対応の終了1分前）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('15:59'), config)).toBe('departure_support');
  });

  it('16:59 → record_wrapup（記録仕上げの終了1分前）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('16:59'), config)).toBe('record_wrapup');
  });

  it('17:59 → evening_briefing（夕会の終了1分前）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('17:59'), config)).toBe('evening_briefing');
  });

  // ── エッジケース ──

  it('空の config は undefined を返す', () => {
    expect(getCurrentPhaseFromConfig(dateAt('12:00'), [])).toBeUndefined();
  });

  it('sortOrder が逆順でも正しく判定する', () => {
    const reversed = [...config].reverse();
    expect(getCurrentPhaseFromConfig(dateAt('09:10'), reversed)).toBe('morning_briefing');
  });

  // ── pm_activity の開始境界（12:00） ──

  it('12:00 → pm_activity（午後活動の開始）', () => {
    expect(getCurrentPhaseFromConfig(dateAt('12:00'), config)).toBe('pm_activity');
  });
});

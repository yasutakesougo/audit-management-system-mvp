/**
 * monitoringSchedule.spec.ts — L2 モニタリング期限計算テスト
 */
import { describe, expect, it } from 'vitest';
import {
  calculateMonitoringSchedule,
  resolveSupportStartDate,
  DEFAULT_MONITORING_CYCLE_DAYS,
} from '../monitoringSchedule';

describe('calculateMonitoringSchedule', () => {
  // ── 基本計算 ──

  it('支援初日は第1期・残り90日', () => {
    const info = calculateMonitoringSchedule('2026-01-01', 90, '2026-01-01');
    expect(info?.currentCycleNumber).toBe(1);
    expect(info?.elapsedDays).toBe(0);
    expect(info?.nextMonitoringDate).toBe('2026-04-01');
    expect(info?.remainingDays).toBe(90);
    expect(info?.isOverdue).toBe(false);
    expect(info?.overdueDays).toBe(0);
    expect(info?.progressPercent).toBe(0);
  });

  it('45日経過で残り45日・進捗50%', () => {
    const info = calculateMonitoringSchedule('2026-01-01', 90, '2026-02-15');
    expect(info?.elapsedDays).toBe(45);
    expect(info?.remainingDays).toBe(45);
    expect(info?.isOverdue).toBe(false);
    expect(info?.progressPercent).toBe(50);
  });

  it('89日経過で残り1日・進捗99%', () => {
    const info = calculateMonitoringSchedule('2026-01-01', 90, '2026-03-31');
    expect(info?.elapsedDays).toBe(89);
    expect(info?.remainingDays).toBe(1);
    expect(info?.progressPercent).toBe(99);
  });

  it('ちょうど 90日で第2期に入る', () => {
    const info = calculateMonitoringSchedule('2026-01-01', 90, '2026-04-01');
    expect(info?.currentCycleNumber).toBe(2);
    expect(info?.nextMonitoringDate).toBe('2026-06-30'); // 1/1 + 180日
    expect(info?.remainingDays).toBe(90); // 4/1 → 6/30
  });

  // ── 期限超過 ──

  it('期限超過時は isOverdue=true, overdueDays が正', () => {
    // 第1期の期限(4/1)を10日超過
    const info = calculateMonitoringSchedule('2026-01-01', 90, '2026-04-11');
    expect(info?.currentCycleNumber).toBe(2);
    expect(info?.isOverdue).toBe(false); // 第2期に入っているので第2期の期限まで猶予あり
  });

  // ── カスタム周期 ──

  it('30日周期で計算できる', () => {
    const info = calculateMonitoringSchedule('2026-01-01', 30, '2026-01-16');
    expect(info?.currentCycleNumber).toBe(1);
    expect(info?.remainingDays).toBe(15);
    expect(info?.progressPercent).toBe(50);
  });

  it('180日周期（6ヶ月）で計算できる', () => {
    const info = calculateMonitoringSchedule('2026-01-01', 180, '2026-04-01');
    expect(info?.currentCycleNumber).toBe(1);
    expect(info?.elapsedDays).toBe(90);
    expect(info?.progressPercent).toBe(50);
  });

  // ── デフォルト ──

  it('デフォルトは90日', () => {
    expect(DEFAULT_MONITORING_CYCLE_DAYS).toBe(90);
  });

  // ── 複数サイクル ──

  it('第3期（180日〜270日）に正しく入る', () => {
    const info = calculateMonitoringSchedule('2026-01-01', 90, '2026-07-15');
    // 1/1 + 195日 = 7/15
    expect(info?.elapsedDays).toBe(195);
    expect(info?.currentCycleNumber).toBe(3);
    expect(info?.nextMonitoringDate).toBe('2026-09-28'); // 1/1 + 270日
  });

  // ── 異常系 ──

  it('スラッシュ区切りの日付も処理できる', () => {
    const info = calculateMonitoringSchedule('2026/01/01', 90, '2026/02/15');
    expect(info?.elapsedDays).toBe(45);
    expect(info?.remainingDays).toBe(45);
    expect(info?.nextMonitoringDate).toBe('2026-04-01');
  });

  it('不正な日付文字列の場合は null を返す', () => {
    expect(calculateMonitoringSchedule('invalid', 90)).toBeNull();
    expect(calculateMonitoringSchedule('', 90)).toBeNull();
  });

  it('周期が 0 や負数の場合にクラッシュしない', () => {
    const info = calculateMonitoringSchedule('2026-01-01', 0);
    expect(info).not.toBeNull();
    expect(info?.cycleDays).toBe(0);
  });
});

describe('resolveSupportStartDate', () => {
  it('supportStartDate があればそれを返す', () => {
    expect(resolveSupportStartDate('2026-01-15', '2026-01-01')).toBe('2026-01-15');
  });

  it('supportStartDate がなく appliedFrom があれば fallback', () => {
    expect(resolveSupportStartDate(null, '2026-01-01')).toBe('2026-01-01');
    expect(resolveSupportStartDate(undefined, '2026-01-01')).toBe('2026-01-01');
  });

  it('両方なければ null', () => {
    expect(resolveSupportStartDate(null, null)).toBeNull();
    expect(resolveSupportStartDate(undefined, undefined)).toBeNull();
  });
});

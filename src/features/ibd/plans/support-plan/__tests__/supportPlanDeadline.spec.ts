import { describe, expect, it } from 'vitest';
import {
  addMonths,
  computeDeadlineInfo,
  daysDiff,
  formatDateJP,
  parsePlanPeriod,
  toDate,
} from '../supportPlanDeadline';

describe('toDate', () => {
  it('YYYY/MM/DD をパースする', () => {
    const d = toDate('2026/03/12');
    expect(d).toBeInstanceOf(Date);
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(2); // 0-indexed
    expect(d!.getDate()).toBe(12);
  });

  it('YYYY-MM-DD をパースする', () => {
    const d = toDate('2026-01-05');
    expect(d!.getMonth()).toBe(0);
    expect(d!.getDate()).toBe(5);
  });

  it('undefined を返す（空文字）', () => {
    expect(toDate('')).toBeUndefined();
    expect(toDate(undefined)).toBeUndefined();
  });
});

describe('parsePlanPeriod', () => {
  it('〜 区切りをパースする', () => {
    const { start, end } = parsePlanPeriod('2026/01/01〜2026/12/31');
    expect(start!.getFullYear()).toBe(2026);
    expect(end!.getMonth()).toBe(11);
  });

  it('~ 区切りもパースする', () => {
    const { start, end } = parsePlanPeriod('2026/04/01~2026/09/30');
    expect(start!.getMonth()).toBe(3);
    expect(end!.getDate()).toBe(30);
  });

  it('空文字なら空を返す', () => {
    expect(parsePlanPeriod('')).toEqual({});
  });
});

describe('addMonths', () => {
  it('6ヶ月加算する', () => {
    const d = addMonths(new Date(2026, 0, 15), 6);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(15);
  });

  it('月末オーバーフローを処理する', () => {
    const d = addMonths(new Date(2026, 0, 31), 1); // 1/31 + 1month
    expect(d.getMonth()).toBe(1); // Feb
    expect(d.getDate()).toBeLessThanOrEqual(28);
  });
});

describe('daysDiff', () => {
  it('正の差を返す', () => {
    const a = new Date(2026, 2, 15);
    const b = new Date(2026, 2, 10);
    expect(daysDiff(a, b)).toBe(5);
  });

  it('負の差を返す（過去）', () => {
    const a = new Date(2026, 2, 5);
    const b = new Date(2026, 2, 10);
    expect(daysDiff(a, b)).toBe(-5);
  });
});

describe('formatDateJP', () => {
  it('YYYY/MM/DD 形式にフォーマットする', () => {
    expect(formatDateJP(new Date(2026, 2, 5))).toBe('2026/03/05');
  });

  it('undefined なら空文字を返す', () => {
    expect(formatDateJP(undefined)).toBe('');
  });
});

describe('computeDeadlineInfo', () => {
  it('期限内なら success を返す', () => {
    const farFuture = '2030/01/01〜2030/12/31';
    const result = computeDeadlineInfo({ planPeriod: farFuture, lastMonitoringDate: '' });
    expect(result.monitoring.color).toBe('success');
    expect(result.monitoring.daysLeft).toBeGreaterThan(14);
  });

  it('期限超過なら error を返す', () => {
    const pastPeriod = '2020/01/01〜2020/12/31';
    const result = computeDeadlineInfo({ planPeriod: pastPeriod, lastMonitoringDate: '' });
    expect(result.monitoring.color).toBe('error');
    expect(result.monitoring.daysLeft).toBeLessThan(0);
  });

  it('計画期間未入力なら daysLeft が undefined', () => {
    const result = computeDeadlineInfo({ planPeriod: '', lastMonitoringDate: '' });
    expect(result.monitoring.daysLeft).toBeUndefined();
    expect(result.monitoring.color).toBe('default');
  });

  it('lastMonitoringDate がある場合はそこから6ヶ月を基準にする', () => {
    const result = computeDeadlineInfo({
      planPeriod: '2026/01/01〜2030/12/31',
      lastMonitoringDate: '2026/03/01',
    });
    // 2026/03/01 + 6months = 2026/09/01
    expect(result.monitoring.date!.getMonth()).toBe(8); // Sep
  });
});

import { describe, expect, it } from 'vitest';
import { computeSnoozeUntil } from '../computeSnoozeUntil';

describe('computeSnoozeUntil', () => {
  it('tomorrow は翌日の 00:00:00.000 を返す', () => {
    const now = new Date(2026, 2, 21, 10, 15, 30, 123);
    const until = new Date(computeSnoozeUntil('tomorrow', now));

    expect(until.getFullYear()).toBe(2026);
    expect(until.getMonth()).toBe(2);
    expect(until.getDate()).toBe(22);
    expect(until.getHours()).toBe(0);
    expect(until.getMinutes()).toBe(0);
    expect(until.getSeconds()).toBe(0);
    expect(until.getMilliseconds()).toBe(0);
  });

  it('three-days は 72時間後を返す', () => {
    const now = new Date(2026, 2, 21, 10, 15, 30, 123);
    const untilIso = computeSnoozeUntil('three-days', now);

    expect(new Date(untilIso).getTime() - now.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it('end-of-week は当該週の日曜 23:59:59.999 を返す', () => {
    const now = new Date(2026, 2, 18, 9, 0, 0, 0); // 水曜
    const until = new Date(computeSnoozeUntil('end-of-week', now));

    expect(until.getDay()).toBe(0);
    expect(until.getHours()).toBe(23);
    expect(until.getMinutes()).toBe(59);
    expect(until.getSeconds()).toBe(59);
    expect(until.getMilliseconds()).toBe(999);
  });

  it('end-of-week は日曜日の場合も当日末を返す', () => {
    const now = new Date(2026, 2, 22, 8, 0, 0, 0); // 日曜
    const until = new Date(computeSnoozeUntil('end-of-week', now));

    expect(until.getDate()).toBe(22);
    expect(until.getDay()).toBe(0);
    expect(until.getHours()).toBe(23);
    expect(until.getMinutes()).toBe(59);
    expect(until.getSeconds()).toBe(59);
    expect(until.getMilliseconds()).toBe(999);
  });
});

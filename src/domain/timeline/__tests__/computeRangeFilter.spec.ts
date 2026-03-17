/**
 * computeRangeFilter のテスト
 *
 * 期間プリセットから from/to を正しく計算できることを検証する。
 */

import { describe, it, expect } from 'vitest';
import { computeRangeFilter } from '../types';

describe('computeRangeFilter', () => {
  // 固定基準日時: 2026-03-17T12:00:00.000Z
  const now = new Date('2026-03-17T12:00:00.000Z');

  it('7d プリセットで直近7日の from/to を計算する', () => {
    const { from, to } = computeRangeFilter('7d', now);

    expect(to).toBe(now.toISOString());
    // from は 6日前の 00:00:00（= 3/11）
    const fromDate = new Date(from);
    expect(fromDate.getDate()).toBe(11);
    expect(fromDate.getHours()).toBe(0);
    expect(fromDate.getMinutes()).toBe(0);
    expect(fromDate.getSeconds()).toBe(0);
  });

  it('30d プリセットで直近30日の from/to を計算する', () => {
    const { from, to } = computeRangeFilter('30d', now);

    expect(to).toBe(now.toISOString());
    // from は 29日前の 00:00:00（= 2/16）
    const fromDate = new Date(from);
    expect(fromDate.getMonth()).toBe(1); // 2月 (0-indexed)
    expect(fromDate.getDate()).toBe(16);
    expect(fromDate.getHours()).toBe(0);
  });

  it('90d プリセットで直近90日の from/to を計算する', () => {
    const { from, to } = computeRangeFilter('90d', now);

    expect(to).toBe(now.toISOString());
    // from は 89日前の 00:00:00（= 12/18）
    const fromDate = new Date(from);
    expect(fromDate.getMonth()).toBe(11); // 12月 (0-indexed)
    expect(fromDate.getDate()).toBe(18);
    expect(fromDate.getHours()).toBe(0);
  });

  it('to は now の ISO 文字列と一致する', () => {
    const { to } = computeRangeFilter('7d', now);
    expect(to).toBe('2026-03-17T12:00:00.000Z');
  });

  it('from は当日を含む（days - 1 日前）', () => {
    // 7d = 今日を含む7日間 = 6日前の 0時から
    const { from } = computeRangeFilter('7d', now);
    const fromDate = new Date(from);

    // now (3/17) から from (3/11) まで 6日差
    const diffMs = now.getTime() - fromDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // from が 00:00 で now が 12:00 なので 6.5日差
    expect(diffDays).toBeGreaterThanOrEqual(6);
    expect(diffDays).toBeLessThan(7);
  });
});

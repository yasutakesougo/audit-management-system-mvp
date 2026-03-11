/**
 * dayViewHelpers.spec.ts — focused unit tests for day-view pure helper functions.
 *
 * No mocks, no React, no MSW.
 * All assertions are pure input/output.
 */
import { describe, expect, it } from 'vitest';
import {
    endOfDay,
    formatDayLabel,
    formatTimeRange,
    startOfDay,
    toLocalDateIso,
} from '../dayViewHelpers';

// ---------------------------------------------------------------------------
// toLocalDateIso
// ---------------------------------------------------------------------------

describe('toLocalDateIso', () => {
  it('returns empty string for undefined', () => {
    expect(toLocalDateIso(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(toLocalDateIso('')).toBe('');
  });

  it('converts a UTC ISO datetime string to local YYYY-MM-DD', () => {
    // 2026-03-11T00:00:00+09:00 is unambiguous local date
    const result = toLocalDateIso('2026-03-11T00:00:00+09:00');
    expect(result).toBe('2026-03-11');
  });

  it('converts a date-only string via Date constructor', () => {
    const result = toLocalDateIso('2026-01-05T00:00:00+09:00');
    expect(result).toBe('2026-01-05');
  });

  it('falls back to slicing first 10 chars for unparseable strings', () => {
    // new Date('not-a-date') is NaN, so we expect slice(0,10)
    const result = toLocalDateIso('not-a-date-extra');
    expect(result).toBe('not-a-date');
  });

  it('returns the full value sliced to 10 when Date is NaN', () => {
    expect(toLocalDateIso('2026-AB-XY-garbage')).toBe('2026-AB-XY');
  });

  it('returns YYYY-MM-DD format with zero-padded month and day', () => {
    const result = toLocalDateIso('2026-02-05T06:00:00+09:00');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe('2026-02-05');
  });
});

// ---------------------------------------------------------------------------
// formatDayLabel
// ---------------------------------------------------------------------------

describe('formatDayLabel', () => {
  it('formats a Monday date with 月 weekday', () => {
    // 2026-03-09 is a Monday
    const result = formatDayLabel('2026-03-09T12:00:00+09:00');
    expect(result).toContain('月');
    expect(result).toContain('（月）');
  });

  it('formats a Sunday date with 日 weekday', () => {
    // 2026-03-08 is a Sunday
    const result = formatDayLabel('2026-03-08T12:00:00+09:00');
    expect(result).toContain('（日）');
  });

  it('formats a Saturday date with 土 weekday', () => {
    // 2026-03-07 is a Saturday
    const result = formatDayLabel('2026-03-07T12:00:00+09:00');
    expect(result).toContain('（土）');
  });

  it('includes the year in Japanese format', () => {
    const result = formatDayLabel('2026-03-11T09:00:00+09:00');
    expect(result).toContain('2026');
  });

  it('wraps the weekday in Japanese parentheses （）', () => {
    const result = formatDayLabel('2026-03-11T09:00:00+09:00');
    expect(result).toMatch(/（[日月火水木金土]）/);
  });
});

// ---------------------------------------------------------------------------
// formatTimeRange
// ---------------------------------------------------------------------------

describe('formatTimeRange', () => {
  it('returns a single time when toIso is omitted', () => {
    const result = formatTimeRange('2026-03-11T09:00:00+09:00');
    // Should contain just one time, no 〜
    expect(result).not.toContain('〜');
    expect(result).toMatch(/\d{2}:\d{2}/);
  });

  it('returns "from〜to" when both args are given', () => {
    const result = formatTimeRange(
      '2026-03-11T09:00:00+09:00',
      '2026-03-11T10:30:00+09:00',
    );
    expect(result).toContain('〜');
    const parts = result.split('〜');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/\d{2}:\d{2}/);
    expect(parts[1]).toMatch(/\d{2}:\d{2}/);
  });

  it('formats times in HH:MM two-digit form', () => {
    const result = formatTimeRange('2026-03-11T08:05:00+09:00');
    expect(result).toMatch(/08:05/);
  });

  it('handles midnight correctly', () => {
    const result = formatTimeRange('2026-03-11T00:00:00+09:00');
    expect(result).toMatch(/00:00/);
  });

  it('from and to times are ordered correctly in the range string', () => {
    const result = formatTimeRange(
      '2026-03-11T09:00:00+09:00',
      '2026-03-11T17:00:00+09:00',
    );
    const [from, to] = result.split('〜');
    // from should be earlier (09:xx < 17:xx when compared lexicographically for HH:MM)
    expect(from! < to!).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// startOfDay
// ---------------------------------------------------------------------------

describe('startOfDay', () => {
  it('returns a Date with time set to 00:00:00.000', () => {
    const input = new Date('2026-03-11T15:30:45.123');
    const result = startOfDay(input);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('does not mutate the original date', () => {
    const input = new Date('2026-03-11T15:30:00');
    startOfDay(input);
    expect(input.getHours()).toBe(15); // unchanged
  });

  it('returns a new Date object (not the same reference)', () => {
    const input = new Date('2026-03-11T12:00:00');
    const result = startOfDay(input);
    expect(result).not.toBe(input);
  });

  it('preserves the date (year, month, day)', () => {
    const input = new Date('2026-03-11T23:59:59');
    const result = startOfDay(input);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2); // 0-indexed (March)
    expect(result.getDate()).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// endOfDay
// ---------------------------------------------------------------------------

describe('endOfDay', () => {
  it('returns a Date with time set to next midnight (24:00 = setHours(24,0,0,0))', () => {
    const input = new Date('2026-03-11T08:00:00');
    const result = endOfDay(input);
    // setHours(24) advances to next day at 00:00:00
    const nextDay = new Date('2026-03-12T00:00:00');
    expect(result.getTime()).toBe(nextDay.getTime());
  });

  it('does not mutate the original date', () => {
    const input = new Date('2026-03-11T08:00:00');
    const originalTime = input.getTime();
    endOfDay(input);
    expect(input.getTime()).toBe(originalTime); // unchanged
  });

  it('returns a new Date object (not the same reference)', () => {
    const input = new Date('2026-03-11T12:00:00');
    const result = endOfDay(input);
    expect(result).not.toBe(input);
  });

  it('endOfDay is strictly after startOfDay for the same date', () => {
    const input = new Date('2026-03-11T12:00:00');
    const start = startOfDay(input);
    const end = endOfDay(input);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it('end of day for March 31 rolls into April 1', () => {
    const input = new Date('2026-03-31T10:00:00');
    const result = endOfDay(input);
    expect(result.getMonth()).toBe(3); // April (0-indexed)
    expect(result.getDate()).toBe(1);
  });
});

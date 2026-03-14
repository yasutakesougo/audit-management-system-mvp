/**
 * Tests for staffAttendanceDateUtils — date utility functions for staff
 * attendance page.
 *
 * Covers: toISODate, startOfMonthISO, endOfMonthISO, startOfWeekISO, endOfWeekISO
 */
import { describe, expect, it } from 'vitest';
import {
  toISODate,
  startOfMonthISO,
  endOfMonthISO,
  startOfWeekISO,
  endOfWeekISO,
} from '@/features/staff/attendance/utils/staffAttendanceDateUtils';

// ─────────────────────────────────────────────────────────────────────────────
// toISODate
// ─────────────────────────────────────────────────────────────────────────────
describe('toISODate', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toISODate(new Date(2026, 2, 14))).toBe('2026-03-14');
  });

  it('pads single-digit month and day', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('handles Dec 31', () => {
    expect(toISODate(new Date(2025, 11, 31))).toBe('2025-12-31');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// startOfMonthISO
// ─────────────────────────────────────────────────────────────────────────────
describe('startOfMonthISO', () => {
  it('returns the first day of the month', () => {
    expect(startOfMonthISO(new Date(2026, 2, 14))).toBe('2026-03-01');
  });

  it('works for January', () => {
    expect(startOfMonthISO(new Date(2026, 0, 15))).toBe('2026-01-01');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// endOfMonthISO
// ─────────────────────────────────────────────────────────────────────────────
describe('endOfMonthISO', () => {
  it('returns last day of March (31 days)', () => {
    expect(endOfMonthISO(new Date(2026, 2, 14))).toBe('2026-03-31');
  });

  it('returns last day of February (non-leap)', () => {
    expect(endOfMonthISO(new Date(2025, 1, 10))).toBe('2025-02-28');
  });

  it('returns last day of February (leap year)', () => {
    expect(endOfMonthISO(new Date(2028, 1, 10))).toBe('2028-02-29');
  });

  it('returns last day of April (30 days)', () => {
    expect(endOfMonthISO(new Date(2026, 3, 5))).toBe('2026-04-30');
  });

  it('returns last day of December', () => {
    expect(endOfMonthISO(new Date(2026, 11, 1))).toBe('2026-12-31');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// startOfWeekISO (月曜始まり)
// ─────────────────────────────────────────────────────────────────────────────
describe('startOfWeekISO (月曜始まり)', () => {
  it('returns Monday for a Wednesday input', () => {
    // 2026-03-11 = Wednesday → Monday = 2026-03-09
    expect(startOfWeekISO(new Date(2026, 2, 11))).toBe('2026-03-09');
  });

  it('returns same day for a Monday input', () => {
    // 2026-03-09 = Monday
    expect(startOfWeekISO(new Date(2026, 2, 9))).toBe('2026-03-09');
  });

  it('returns previous Monday for a Sunday input', () => {
    // 2026-03-15 = Sunday → Monday = 2026-03-09
    expect(startOfWeekISO(new Date(2026, 2, 15))).toBe('2026-03-09');
  });

  it('crosses month boundary correctly', () => {
    // 2026-03-01 = Sunday → Monday = 2026-02-23
    expect(startOfWeekISO(new Date(2026, 2, 1))).toBe('2026-02-23');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// endOfWeekISO (日曜終わり)
// ─────────────────────────────────────────────────────────────────────────────
describe('endOfWeekISO (日曜終わり)', () => {
  it('returns Sunday for a Wednesday input', () => {
    // 2026-03-11 = Wednesday → Sunday = 2026-03-15
    expect(endOfWeekISO(new Date(2026, 2, 11))).toBe('2026-03-15');
  });

  it('returns same day for a Sunday input', () => {
    // 2026-03-15 = Sunday
    expect(endOfWeekISO(new Date(2026, 2, 15))).toBe('2026-03-15');
  });

  it('returns coming Sunday for a Monday input', () => {
    // 2026-03-09 = Monday → Sunday = 2026-03-15
    expect(endOfWeekISO(new Date(2026, 2, 9))).toBe('2026-03-15');
  });

  it('crosses month boundary correctly', () => {
    // 2026-02-27 = Friday → Sunday = 2026-03-01
    expect(endOfWeekISO(new Date(2026, 1, 27))).toBe('2026-03-01');
  });
});

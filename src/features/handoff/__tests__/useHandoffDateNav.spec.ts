import { describe, expect, it } from 'vitest';
import {
  addDays,
  addWeeks,
  dateToDayScope,
  dayScopeToDate,
  formatDateLabel,
  formatWeekLabel,
  getWeekRange,
  parseDateString,
  parseRange,
} from '../hooks/useHandoffDateNav';
import { formatDateIso } from '@/lib/dateFormat';

describe('useHandoffDateNav pure helpers', () => {
  // ── formatDateIso ──
  describe('formatDateIso', () => {
    it('returns YYYY-MM-DD format', () => {
      const d = new Date(2026, 2, 11); // 2026-03-11
      expect(formatDateIso(d)).toBe('2026-03-11');
    });

    it('zero-pads month and day', () => {
      const d = new Date(2026, 0, 5); // 2026-01-05
      expect(formatDateIso(d)).toBe('2026-01-05');
    });
  });

  // ── parseDateString ──
  describe('parseDateString', () => {
    it('parses valid YYYY-MM-DD', () => {
      const d = parseDateString('2026-03-11');
      expect(d).toBeInstanceOf(Date);
      expect(d!.getFullYear()).toBe(2026);
      expect(d!.getMonth()).toBe(2); // 0-indexed
      expect(d!.getDate()).toBe(11);
    });

    it('returns null for invalid format', () => {
      expect(parseDateString('2026/03/11')).toBeNull();
      expect(parseDateString('not-a-date')).toBeNull();
      expect(parseDateString('')).toBeNull();
    });
  });

  // ── addDays ──
  describe('addDays', () => {
    it('adds positive days', () => {
      expect(addDays('2026-03-11', 1)).toBe('2026-03-12');
    });

    it('subtracts days', () => {
      expect(addDays('2026-03-11', -1)).toBe('2026-03-10');
    });

    it('crosses month boundary', () => {
      expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    });

    it('returns original for invalid input', () => {
      expect(addDays('invalid', 1)).toBe('invalid');
    });
  });

  // ── dayScopeToDate / dateToDayScope ──
  describe('dayScopeToDate', () => {
    it('today returns today\'s date', () => {
      const today = formatDateIso(new Date());
      expect(dayScopeToDate('today')).toBe(today);
    });

    it('yesterday returns yesterday\'s date', () => {
      const yesterday = addDays(formatDateIso(new Date()), -1);
      expect(dayScopeToDate('yesterday')).toBe(yesterday);
    });
  });

  describe('dateToDayScope', () => {
    it('returns "today" for today\'s date', () => {
      const today = formatDateIso(new Date());
      expect(dateToDayScope(today)).toBe('today');
    });

    it('returns "yesterday" for yesterday', () => {
      const yesterday = addDays(formatDateIso(new Date()), -1);
      expect(dateToDayScope(yesterday)).toBe('yesterday');
    });

    it('returns "today" for arbitrary past date (compatibility fallback)', () => {
      expect(dateToDayScope('2026-01-01')).toBe('today');
    });
  });

  // ── formatDateLabel ──
  describe('formatDateLabel', () => {
    it('shows 今日 for today', () => {
      const today = formatDateIso(new Date());
      expect(formatDateLabel(today)).toBe('今日');
    });

    it('shows 昨日 for yesterday', () => {
      const yesterday = addDays(formatDateIso(new Date()), -1);
      expect(formatDateLabel(yesterday)).toBe('昨日');
    });

    it('formats arbitrary date with Japanese month/day/dow', () => {
      // 2026-03-09 is a Monday
      const label = formatDateLabel('2026-03-09');
      expect(label).toBe('3月9日（月）');
    });
  });

  // ── parseRange ──
  describe('parseRange', () => {
    it('returns "day" for null or unknown', () => {
      expect(parseRange(null)).toBe('day');
      expect(parseRange('unknown')).toBe('day');
    });

    it('accepts valid ranges', () => {
      expect(parseRange('day')).toBe('day');
      expect(parseRange('week')).toBe('week');
      expect(parseRange('month')).toBe('month');
    });
  });

  // ── getWeekRange (月曜始まり) ──
  describe('getWeekRange', () => {
    it('月曜入力 → 自身が start', () => {
      // 2026-03-09 is Monday
      expect(getWeekRange('2026-03-09')).toEqual(['2026-03-09', '2026-03-15']);
    });

    it('水曜入力 → 月曜〜日曜', () => {
      // 2026-03-11 is Wednesday
      expect(getWeekRange('2026-03-11')).toEqual(['2026-03-09', '2026-03-15']);
    });

    it('日曜入力 → 前の月曜〜自身が end', () => {
      // 2026-03-15 is Sunday
      expect(getWeekRange('2026-03-15')).toEqual(['2026-03-09', '2026-03-15']);
    });

    it('土曜入力 → 月曜〜日曜', () => {
      // 2026-03-14 is Saturday
      expect(getWeekRange('2026-03-14')).toEqual(['2026-03-09', '2026-03-15']);
    });

    it('月跨ぎ対応', () => {
      // 2026-03-02 is Monday, week ends 2026-03-08
      expect(getWeekRange('2026-03-01')).toEqual(['2026-02-23', '2026-03-01']);
    });

    it('年跨ぎ対応', () => {
      // 2026-01-01 is Thursday
      expect(getWeekRange('2026-01-01')).toEqual(['2025-12-29', '2026-01-04']);
    });
  });

  // ── addWeeks ──
  describe('addWeeks', () => {
    it('+1 week = +7 days', () => {
      expect(addWeeks('2026-03-09', 1)).toBe('2026-03-16');
    });

    it('-1 week = -7 days', () => {
      expect(addWeeks('2026-03-09', -1)).toBe('2026-03-02');
    });

    it('crosses month boundary', () => {
      expect(addWeeks('2026-02-25', 1)).toBe('2026-03-04');
    });
  });

  // ── formatWeekLabel ──
  describe('formatWeekLabel', () => {
    it('formats week range in Japanese', () => {
      const label = formatWeekLabel('2026-03-09', '2026-03-15');
      expect(label).toBe('3/9（月）〜 3/15（日）');
    });

    it('handles month-crossing label', () => {
      const label = formatWeekLabel('2025-12-29', '2026-01-04');
      expect(label).toBe('12/29（月）〜 1/4（日）');
    });

    it('falls back for invalid input', () => {
      const label = formatWeekLabel('invalid', 'bad');
      expect(label).toBe('invalid 〜 bad');
    });
  });
});

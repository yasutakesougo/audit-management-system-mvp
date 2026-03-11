import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateToDayScope,
  dayScopeToDate,
  formatDateLabel,
  formatDateLocal,
  parseDateString,
  parseRange,
} from '../hooks/useHandoffDateNav';

describe('useHandoffDateNav pure helpers', () => {
  // ── formatDateLocal ──
  describe('formatDateLocal', () => {
    it('returns YYYY-MM-DD format', () => {
      const d = new Date(2026, 2, 11); // 2026-03-11
      expect(formatDateLocal(d)).toBe('2026-03-11');
    });

    it('zero-pads month and day', () => {
      const d = new Date(2026, 0, 5); // 2026-01-05
      expect(formatDateLocal(d)).toBe('2026-01-05');
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
      const today = formatDateLocal();
      expect(dayScopeToDate('today')).toBe(today);
    });

    it('yesterday returns yesterday\'s date', () => {
      const yesterday = addDays(formatDateLocal(), -1);
      expect(dayScopeToDate('yesterday')).toBe(yesterday);
    });
  });

  describe('dateToDayScope', () => {
    it('returns "today" for today\'s date', () => {
      const today = formatDateLocal();
      expect(dateToDayScope(today)).toBe('today');
    });

    it('returns "yesterday" for yesterday', () => {
      const yesterday = addDays(formatDateLocal(), -1);
      expect(dateToDayScope(yesterday)).toBe('yesterday');
    });

    it('returns "today" for arbitrary past date (compatibility fallback)', () => {
      expect(dateToDayScope('2026-01-01')).toBe('today');
    });
  });

  // ── formatDateLabel ──
  describe('formatDateLabel', () => {
    it('shows 今日 for today', () => {
      const today = formatDateLocal();
      expect(formatDateLabel(today)).toBe('今日');
    });

    it('shows 昨日 for yesterday', () => {
      const yesterday = addDays(formatDateLocal(), -1);
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
});

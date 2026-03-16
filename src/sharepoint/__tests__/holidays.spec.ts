import { describe, it, expect, beforeEach } from 'vitest';
import {
  HOLIDAYS,
  getHolidayLabel,
  setDynamicHolidays,
  resetDynamicHolidays,
} from '../holidays';

describe('holidays', () => {
  beforeEach(() => {
    resetDynamicHolidays();
  });

  describe('HOLIDAYS static table', () => {
    it('contains 2025 national holidays', () => {
      expect(HOLIDAYS['2025-01-01']).toBe('元日');
      expect(HOLIDAYS['2025-05-03']).toBe('憲法記念日');
      expect(HOLIDAYS['2025-11-23']).toBe('勤労感謝の日');
    });

    it('contains 2026 national holidays', () => {
      expect(HOLIDAYS['2026-01-01']).toBe('元日');
      expect(HOLIDAYS['2026-07-20']).toBe('海の日');
      expect(HOLIDAYS['2026-11-23']).toBe('勤労感謝の日');
    });

    it('does not contain non-holiday dates', () => {
      expect(HOLIDAYS['2026-06-15']).toBeUndefined();
      expect(HOLIDAYS['2025-12-25']).toBeUndefined();
    });

    it('has correct count of holidays', () => {
      const count = Object.keys(HOLIDAYS).length;
      // 2025: 19件 + 2026: 17件 = 36件
      expect(count).toBe(36);
    });
  });

  describe('getHolidayLabel', () => {
    it('returns holiday label from static table', () => {
      expect(getHolidayLabel('2026-01-01')).toBe('元日');
    });

    it('returns undefined for non-holiday dates', () => {
      expect(getHolidayLabel('2026-06-15')).toBeUndefined();
    });

    it('prioritizes dynamic holidays over static', () => {
      setDynamicHolidays({
        '2026-01-01': 'カスタム元日',
        '2026-12-29': '年末休業',
      });

      // dynamic で上書き
      expect(getHolidayLabel('2026-01-01')).toBe('カスタム元日');
      // dynamic にのみ存在
      expect(getHolidayLabel('2026-12-29')).toBe('年末休業');
      // dynamic には存在しない → undefined (static にフォールバックしない)
      expect(getHolidayLabel('2026-07-20')).toBeUndefined();
    });

    it('falls back to static after resetDynamicHolidays', () => {
      setDynamicHolidays({ '2026-01-01': 'overridden' });
      expect(getHolidayLabel('2026-01-01')).toBe('overridden');

      resetDynamicHolidays();
      expect(getHolidayLabel('2026-01-01')).toBe('元日');
    });
  });
});

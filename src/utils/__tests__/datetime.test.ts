import { describe, expect, it } from 'vitest';
import { formatRangeLocal } from '../datetime';

describe('formatRangeLocal', () => {
  describe('basic functionality', () => {
    it('should format single date', () => {
      const result = formatRangeLocal('2025-01-15T09:30:00Z');
      expect(result).toBe('2025-01-15 18:30 (Asia/Tokyo)');
    });

    it('should format date range', () => {
      const result = formatRangeLocal(
        '2025-01-15T09:30:00Z',
        '2025-01-15T10:30:00Z'
      );
      expect(result).toBe('2025-01-15 18:30 – 2025-01-15 19:30 (Asia/Tokyo)');
    });
  });

  describe('improved single-side handling', () => {
    it('should show only end date when start is null', () => {
      const result = formatRangeLocal(null, '2025-01-15T10:30:00Z');
      expect(result).toBe('2025-01-15 19:30 (Asia/Tokyo)');
    });

    it('should show only start date when end is null', () => {
      const result = formatRangeLocal('2025-01-15T09:30:00Z', null);
      expect(result).toBe('2025-01-15 18:30 (Asia/Tokyo)');
    });
  });

  describe('timezone error handling', () => {
    it('should fallback to Asia/Tokyo for invalid timezone', () => {
      const result = formatRangeLocal('2025-01-15T09:30:00Z', {
        tz: 'Invalid/Timezone'
      });
      expect(result).toBe('2025-01-15 18:30 (Invalid/Timezone)');
    });
  });

  describe('rounding modes', () => {
    const testDate = '2025-01-15T09:37:00Z'; // 18:37 JST
    const roundTo = 15; // 15分刻み

    it('should round to nearest by default', () => {
      const result = formatRangeLocal(testDate, { roundTo });
      expect(result).toBe('2025-01-15 18:30 (Asia/Tokyo)'); // 37分 → 30分
    });

    it('should floor when roundMode is floor', () => {
      const result = formatRangeLocal(testDate, {
        roundTo,
        roundMode: 'floor'
      });
      expect(result).toBe('2025-01-15 18:30 (Asia/Tokyo)'); // 37分 → 30分
    });

    it('should ceil when roundMode is ceil', () => {
      const result = formatRangeLocal(testDate, {
        roundTo,
        roundMode: 'ceil'
      });
      expect(result).toBe('2025-01-15 18:45 (Asia/Tokyo)'); // 37分 → 45分
    });

    it('should handle edge case at exact boundary', () => {
      const exactDate = '2025-01-15T09:30:00Z'; // 18:30 JST (exact 15min boundary)

      const nearest = formatRangeLocal(exactDate, { roundTo, roundMode: 'nearest' });
      const floor = formatRangeLocal(exactDate, { roundTo, roundMode: 'floor' });
      const ceil = formatRangeLocal(exactDate, { roundTo, roundMode: 'ceil' });

      expect(nearest).toBe('2025-01-15 18:30 (Asia/Tokyo)');
      expect(floor).toBe('2025-01-15 18:30 (Asia/Tokyo)');
      expect(ceil).toBe('2025-01-15 18:30 (Asia/Tokyo)');
    });
  });

  describe('fallback handling', () => {
    it('should return fallback when both dates are invalid', () => {
      const result = formatRangeLocal(null, null, {
        fallback: 'No dates available'
      });
      expect(result).toBe('No dates available');
    });

    it('should return empty string by default when both dates are invalid', () => {
      const result = formatRangeLocal(null, null);
      expect(result).toBe('');
    });
  });

  describe('overload type safety', () => {
    it('should work with single parameter (options)', () => {
      const result = formatRangeLocal('2025-01-15T09:30:00Z', {
        tz: 'UTC',
        roundTo: 30
      });
      expect(result).toBe('2025-01-15 09:30 (UTC)');
    });

    it('should work with two parameters (start, end)', () => {
      const result = formatRangeLocal(
        '2025-01-15T09:30:00Z',
        '2025-01-15T10:30:00Z'
      );
      expect(result).toBe('2025-01-15 18:30 – 2025-01-15 19:30 (Asia/Tokyo)');
    });

    it('should work with three parameters (start, end, options)', () => {
      const result = formatRangeLocal(
        '2025-01-15T09:30:00Z',
        '2025-01-15T10:30:00Z',
        { tz: 'UTC' }
      );
      expect(result).toBe('2025-01-15 09:30 – 2025-01-15 10:30 (UTC)');
    });
  });
});
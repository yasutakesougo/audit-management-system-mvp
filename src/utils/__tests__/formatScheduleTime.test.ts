import { describe, expect, it } from 'vitest';
import { formatScheduleRange, formatScheduleTime, SCHEDULE_TIME_FALLBACK } from '../formatScheduleTime';

describe('formatScheduleTime', () => {
  const ASIA_TOKYO = 'Asia/Tokyo';
  const UTC = 'UTC';

  describe('basic functionality', () => {
    it('should format valid ISO string to time', () => {
      const result = formatScheduleTime('2025-01-15T09:30:00Z', ASIA_TOKYO);
      expect(result).toBe('18:30');
    });

    it('should use custom format', () => {
      const result = formatScheduleTime('2025-01-15T09:30:45Z', ASIA_TOKYO, 'HH:mm:ss');
      expect(result).toBe('18:30:45');
    });

    it('should handle UTC timezone', () => {
      const result = formatScheduleTime('2025-01-15T09:30:00Z', UTC);
      expect(result).toBe('09:30');
    });
  });

  describe('error handling', () => {
    it('should return fallback for null input', () => {
      const result = formatScheduleTime(null, ASIA_TOKYO);
      expect(result).toBe(SCHEDULE_TIME_FALLBACK);
    });

    it('should return fallback for undefined input', () => {
      const result = formatScheduleTime(undefined, ASIA_TOKYO);
      expect(result).toBe(SCHEDULE_TIME_FALLBACK);
    });

    it('should return fallback for empty timezone', () => {
      const result = formatScheduleTime('2025-01-15T09:30:00Z', '');
      expect(result).toBe(SCHEDULE_TIME_FALLBACK);
    });

    it('should return fallback for invalid ISO string', () => {
      const result = formatScheduleTime('invalid-date', ASIA_TOKYO);
      expect(result).toBe(SCHEDULE_TIME_FALLBACK);
    });
  });
});

describe('formatScheduleRange', () => {
  const ASIA_TOKYO = 'Asia/Tokyo';

  describe('same day range', () => {
    it('should format same day schedule correctly', () => {
      const result = formatScheduleRange(
        '2025-01-15T09:30:00Z', // 18:30 JST
        '2025-01-15T10:30:00Z', // 19:30 JST
        ASIA_TOKYO
      );

      expect(result.text).toBe('18:30–19:30');
      expect(result.aria).toBe('18:30 から 19:30 (Asia/Tokyo)');
      expect(result.crossesMidnight).toBe(false);
      expect(result.spansDays).toBe(0);
      expect(result.valid).toBe(true);
    });
  });

  describe('next day crossing', () => {
    it('should format next day crossing correctly', () => {
      const result = formatScheduleRange(
        '2025-01-15T14:00:00Z', // 23:00 JST (Jan 15)
        '2025-01-16T00:30:00Z', // 09:30 JST (Jan 16)
        ASIA_TOKYO
      );

      expect(result.text).toBe('23:00–翌 09:30');
      expect(result.aria).toBe('23:00 から 翌 09:30 (Asia/Tokyo)');
      expect(result.crossesMidnight).toBe(true);
      expect(result.spansDays).toBe(1);
      expect(result.valid).toBe(true);
    });
  });

  describe('multi-day crossing', () => {
    it('should format multi-day crossing with date', () => {
      const result = formatScheduleRange(
        '2025-01-15T14:00:00Z', // 23:00 JST (Jan 15)
        '2025-01-17T01:00:00Z', // 10:00 JST (Jan 17)
        ASIA_TOKYO
      );

      expect(result.text).toBe('23:00–1/17 10:00');
      expect(result.aria).toBe('23:00 から 1/17 10:00 (Asia/Tokyo)');
      expect(result.crossesMidnight).toBe(true);
      expect(result.spansDays).toBe(2);
      expect(result.valid).toBe(true);
    });
  });

  describe('partial invalid inputs', () => {
    it('should handle start-only valid case', () => {
      const result = formatScheduleRange(
        '2025-01-15T09:30:00Z',
        null,
        ASIA_TOKYO
      );

      expect(result.text).toBe('18:30–--:--');
      expect(result.aria).toBe('開始時刻 18:30 (Asia/Tokyo)');
      expect(result.valid).toBe(false);
    });

    it('should handle end-only valid case', () => {
      const result = formatScheduleRange(
        null,
        '2025-01-15T09:30:00Z',
        ASIA_TOKYO
      );

      expect(result.text).toBe('--:--–18:30');
      expect(result.aria).toBe('終了時刻 18:30 (Asia/Tokyo)');
      expect(result.valid).toBe(false);
    });

    it('should handle both invalid case', () => {
      const result = formatScheduleRange(
        null,
        null,
        ASIA_TOKYO
      );

      expect(result.text).toBe('--:--–--:--');
      expect(result.aria).toBe('--:--–--:-- (Asia/Tokyo)');
      expect(result.valid).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle invalid timezone gracefully', () => {
      const result = formatScheduleRange(
        '2025-01-15T09:30:00Z',
        '2025-01-15T10:30:00Z',
        'Invalid/Timezone'
      );

      // formatInTimeZone の実装によって "--:--" になるか、フォールバックするかは実装次第
      expect(result.tz).toBe('Invalid/Timezone');
    });

    it('should handle exactly midnight boundary', () => {
      const result = formatScheduleRange(
        '2025-01-15T15:00:00Z', // 00:00 JST (Jan 16)
        '2025-01-16T00:00:00Z', // 09:00 JST (Jan 16)
        ASIA_TOKYO
      );

      expect(result.spansDays).toBe(0); // 同日内扱い
      expect(result.crossesMidnight).toBe(false);
    });
  });

  describe('metadata completeness', () => {
    it('should return complete ScheduleRange object', () => {
      const result = formatScheduleRange(
        '2025-01-15T09:30:00Z',
        '2025-01-15T10:30:00Z',
        ASIA_TOKYO
      );

      expect(result).toHaveProperty('text');
      expect(result).toHaveProperty('aria');
      expect(result).toHaveProperty('start');
      expect(result).toHaveProperty('end');
      expect(result).toHaveProperty('crossesMidnight');
      expect(result).toHaveProperty('spansDays');
      expect(result).toHaveProperty('tz');
      expect(result).toHaveProperty('valid');

      expect(result.start).toBeInstanceOf(Date);
      expect(result.end).toBeInstanceOf(Date);
      expect(result.tz).toBe(ASIA_TOKYO);
    });
  });
});
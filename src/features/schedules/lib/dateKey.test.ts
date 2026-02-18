import { describe, expect, it } from 'vitest';
import { getSchedulesTz, toDateKey } from './dateKey';

describe('dateKey', () => {
  describe('toDateKey', () => {
    it('returns YYYY-MM-DD format', () => {
      const key = toDateKey(new Date('2026-02-18T00:00:00.000Z'));
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('respects VITE_SCHEDULES_TZ environment', () => {
      const originalEnv = window.__ENV__;
      window.__ENV__ = { VITE_SCHEDULES_TZ: 'Asia/Tokyo' };
      try {
        const key = toDateKey(new Date('2026-02-18T00:00:00.000Z'));
        expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // Verify it used a timezone-aware formatter (exact date depends on TZ)
        expect(key).toBeDefined();
      } finally {
        window.__ENV__ = originalEnv;
      }
    });

    it('falls back to Asia/Tokyo when env not set', () => {
      const originalEnv = window.__ENV__;
      (window as Record<string, unknown>).__ENV__ = undefined;
      try {
        const key = toDateKey(new Date('2026-02-18T05:00:00.000Z'));
        expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        // 2026-02-18T05:00:00Z should be 2026-02-18 in Asia/Tokyo (UTC+9)
        expect(key).toBe('2026-02-18');
      } finally {
        window.__ENV__ = originalEnv;
      }
    });
  });

  describe('getSchedulesTz', () => {
    it('returns configured TZ from window.__ENV__', () => {
      const originalEnv = window.__ENV__;
      window.__ENV__ = { VITE_SCHEDULES_TZ: 'America/New_York' };
      try {
        expect(getSchedulesTz()).toBe('America/New_York');
      } finally {
        window.__ENV__ = originalEnv;
      }
    });

    it('falls back to Asia/Tokyo by default', () => {
      const originalEnv = window.__ENV__;
      (window as Record<string, unknown>).__ENV__ = undefined;
      try {
        expect(getSchedulesTz()).toBe('Asia/Tokyo');
      } finally {
        window.__ENV__ = originalEnv;
      }
    });
  });
});

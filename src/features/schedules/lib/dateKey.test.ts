import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearEnvCache } from '@/env';
import { getSchedulesTz, toDateKey } from './dateKey';

describe('dateKey', () => {
  let originalWindowEnv: typeof window.__ENV__;
  let originalProcessEnv: string | undefined;

  beforeEach(() => {
    originalWindowEnv = window.__ENV__;
    originalProcessEnv = process.env.VITE_SCHEDULES_TZ;
    // Clear env cache so each test starts fresh
    clearEnvCache();
  });

  afterEach(() => {
    window.__ENV__ = originalWindowEnv;
    if (originalProcessEnv === undefined) {
      delete process.env.VITE_SCHEDULES_TZ;
    } else {
      process.env.VITE_SCHEDULES_TZ = originalProcessEnv;
    }
    clearEnvCache();
  });

  describe('toDateKey', () => {
    it('returns YYYY-MM-DD format', () => {
      const key = toDateKey(new Date('2026-02-18T00:00:00.000Z'));
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('respects VITE_SCHEDULES_TZ environment', () => {
      window.__ENV__ = { VITE_SCHEDULES_TZ: 'Asia/Tokyo' };
      clearEnvCache();
      const key = toDateKey(new Date('2026-02-18T00:00:00.000Z'));
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(key).toBeDefined();
    });

    it('falls back to Asia/Tokyo when env not set', () => {
      (window as unknown as Record<string, unknown>).__ENV__ = undefined;
      delete process.env.VITE_SCHEDULES_TZ;
      clearEnvCache();
      const key = toDateKey(new Date('2026-02-18T05:00:00.000Z'));
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // 2026-02-18T05:00:00Z should be 2026-02-18 in Asia/Tokyo (UTC+9)
      expect(key).toBe('2026-02-18');
    });
  });

  describe('getSchedulesTz', () => {
    it('returns configured TZ from window.__ENV__', () => {
      window.__ENV__ = { VITE_SCHEDULES_TZ: 'America/New_York' };
      clearEnvCache();
      expect(getSchedulesTz()).toBe('America/New_York');
    });

    it('falls back to Asia/Tokyo by default', () => {
      (window as unknown as Record<string, unknown>).__ENV__ = undefined;
      delete process.env.VITE_SCHEDULES_TZ;
      clearEnvCache();
      expect(getSchedulesTz()).toBe('Asia/Tokyo');
    });
  });
});

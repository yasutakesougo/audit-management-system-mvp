import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvRecord } from '@/lib/env';
import { isSchedulesFeatureEnabled } from '@/lib/env';

const createStorage = (): Storage => {
  const store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    key(index: number) {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
    getItem(key: string) {
      return key in store ? store[key] : null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      Object.keys(store).forEach((key) => delete store[key]);
    },
  };
};

const baseEnv = (overrides: Partial<EnvRecord> = {}): EnvRecord => ({
  VITE_FEATURE_SCHEDULES: 'false',
  ...overrides,
});

describe('env storage precedence', () => {
  beforeEach(() => {
  vi.stubGlobal('localStorage', createStorage());
  });

  it('ignores malformed JSON and falls back to env defaults', () => {
    localStorage.setItem('feature:schedules', '{bad json');

    expect(isSchedulesFeatureEnabled(baseEnv())).toBe(false);
    expect(isSchedulesFeatureEnabled(baseEnv({ VITE_FEATURE_SCHEDULES: 'true' }))).toBe(true);
  });

  it('gives precedence to env overrides over stored values', () => {
    localStorage.setItem('feature:schedules', 'false');
    expect(isSchedulesFeatureEnabled(baseEnv({ VITE_FEATURE_SCHEDULES: 'true' }))).toBe(true);
  });
});

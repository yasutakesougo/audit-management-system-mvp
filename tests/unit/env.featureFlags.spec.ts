import { isSchedulesFeatureEnabled, shouldSkipLogin, type EnvRecord } from '@/lib/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('env feature toggles', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined' && localStorage.clear) {
      localStorage.clear();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseEnv = (overrides: Partial<EnvRecord> = {}): EnvRecord => ({
    ...overrides,
  });

  it('returns true when env overrides enable schedules feature flags', () => {
    expect(isSchedulesFeatureEnabled(baseEnv())).toBe(false);
    expect(isSchedulesFeatureEnabled(baseEnv({ VITE_FEATURE_SCHEDULES: 'true' }))).toBe(true);
  });

  it('falls back to localStorage flag values when env values are falsey', () => {
    localStorage.setItem('feature:schedules', 'true');
    expect(isSchedulesFeatureEnabled(baseEnv())).toBe(true);

    localStorage.setItem('feature:schedules', 'false');
    expect(isSchedulesFeatureEnabled(baseEnv())).toBe(false);
  });

  it('shouldSkipLogin respects env toggles and localStorage overrides', () => {
    expect(shouldSkipLogin(baseEnv())).toBe(false);
    expect(shouldSkipLogin(baseEnv({ VITE_SKIP_LOGIN: 'true' }))).toBe(true);

    localStorage.setItem('SKIP_LOGIN', 'YES');
    expect(shouldSkipLogin(baseEnv())).toBe(true);

    localStorage.setItem('SKIP_LOGIN', 'no');
    expect(shouldSkipLogin(baseEnv())).toBe(false);
  });
});

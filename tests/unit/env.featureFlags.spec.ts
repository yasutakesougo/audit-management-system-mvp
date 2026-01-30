import { getMsalLoginScopes, isComplianceFormEnabled, isSchedulesFeatureEnabled, shouldSkipLogin, type EnvRecord } from '@/lib/env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('env feature toggles', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseEnv = (overrides: Partial<EnvRecord> = {}): EnvRecord => ({
    VITE_FEATURE_SCHEDULES: 'false',
    VITE_FEATURE_COMPLIANCE_FORM: 'false',
    VITE_DEMO_MODE: 'false',
    VITE_SKIP_LOGIN: 'false',
    VITE_E2E: 'false',
    VITE_E2E_MSAL_MOCK: 'false',
    ...overrides,
  });

  it('returns true when env overrides enable schedules feature flags', () => {
    expect(isSchedulesFeatureEnabled(baseEnv())).toBe(false);
    expect(isSchedulesFeatureEnabled(baseEnv({ VITE_FEATURE_SCHEDULES: 'true' }))).toBe(true);

    expect(isComplianceFormEnabled(baseEnv())).toBe(false);
    expect(isComplianceFormEnabled(baseEnv({ VITE_FEATURE_COMPLIANCE_FORM: 'on' }))).toBe(true);
  });

  it('falls back to localStorage flag values when env values are falsey', () => {
    localStorage.setItem('feature:schedules', 'TrUe');
    localStorage.setItem('feature:complianceForm', 'enabled');

    expect(isSchedulesFeatureEnabled(baseEnv())).toBe(true);
    expect(isComplianceFormEnabled(baseEnv())).toBe(true);

    localStorage.setItem('feature:schedules', 'disabled');
    localStorage.setItem('feature:complianceForm', 'no');

    expect(isSchedulesFeatureEnabled(baseEnv())).toBe(false);
    expect(isComplianceFormEnabled(baseEnv())).toBe(false);
  });

  it('shouldSkipLogin respects env toggles and localStorage overrides', () => {
    expect(shouldSkipLogin(baseEnv())).toBe(false);
    expect(shouldSkipLogin(baseEnv({ VITE_DEMO_MODE: '1' }))).toBe(true);
    expect(shouldSkipLogin(baseEnv({ VITE_SKIP_LOGIN: 'true' }))).toBe(true);
    expect(shouldSkipLogin(baseEnv({ VITE_E2E: '1' }))).toBe(true);
    expect(shouldSkipLogin(baseEnv({ VITE_E2E_MSAL_MOCK: '1' }))).toBe(true);

    localStorage.setItem('skipLogin', 'YES');
    expect(shouldSkipLogin(baseEnv())).toBe(true);

    localStorage.setItem('skipLogin', 'no');
    expect(shouldSkipLogin(baseEnv())).toBe(false);
  });

  it('getMsalLoginScopes keeps only identity scopes and warns on extras', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const snapshot = baseEnv({
      VITE_LOGIN_SCOPES: 'openid profile User.Read',
      VITE_MSAL_LOGIN_SCOPES: 'profile offline_access',
    });

    const scopes = getMsalLoginScopes(snapshot);

    expect(scopes).toEqual(['openid', 'profile']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Ignoring non-identity login scope'));
  });
});

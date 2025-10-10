import { beforeEach, describe, expect, it } from 'vitest';

import { __resetAppConfigForTests, getAppConfig } from '@/lib/env';

describe('getAppConfig', () => {
  beforeEach(() => {
    __resetAppConfigForTests();
  });

  it('returns memoized instance when called without override', () => {
    const first = getAppConfig();
    const second = getAppConfig();
    expect(second).toBe(first);
  });

  it('maps environment variables with sensible defaults', () => {
    const cfg = getAppConfig();
    expect(typeof cfg.VITE_MSAL_CLIENT_ID).toBe('string');
    expect(typeof cfg.VITE_MSAL_TENANT_ID).toBe('string');
    expect(Number(cfg.VITE_SP_RETRY_MAX)).toBeGreaterThan(0);
    expect(Number(cfg.VITE_SP_RETRY_BASE_MS)).toBeGreaterThan(0);
    expect(Number(cfg.VITE_SP_RETRY_MAX_DELAY_MS)).toBeGreaterThan(0);
    expect(Number(cfg.VITE_MSAL_TOKEN_REFRESH_MIN)).toBeGreaterThan(0);
  });

  it('bypasses cache when override is provided', () => {
    const base = getAppConfig();
    const override = getAppConfig({
      VITE_SP_RESOURCE: 'https://override.example.com',
      VITE_SP_SITE_RELATIVE: '/sites/Override',
    });
    expect(override).not.toBe(base);
    expect(override.VITE_SP_RESOURCE).toBe('https://override.example.com');
    expect(override.VITE_SP_SITE_RELATIVE).toBe('/sites/Override');
  });
});

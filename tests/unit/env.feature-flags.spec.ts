import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const importEnvModule = async () => {
  const module = await import('@/lib/env');
  if (typeof module.__resetAppConfigForTests === 'function') {
    module.__resetAppConfigForTests();
  }
  return module;
};

const mockRuntimeEnv = (env: Record<string, string | undefined> = {}) => {
  vi.doMock('@/env', () => ({
    getRuntimeEnv: () => ({ ...env }),
    isDev: false,
  }));
};

const trackedEnvKeys = [
  'VITE_FEATURE_SCHEDULES',
  'VITE_FEATURE_SCHEDULES_CREATE',
  'VITE_DEMO_MODE',
  'VITE_SKIP_LOGIN',
  'VITE_SP_SCOPE_DEFAULT',
  'VITE_SP_RESOURCE',
  'VITE_MSAL_SCOPES',
] as const;

const originalEnv = trackedEnvKeys.reduce<Record<string, string | undefined>>((acc, key) => {
  acc[key] = process.env[key];
  return acc;
}, {});

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.resetModules();
  for (const key of trackedEnvKeys) {
    delete process.env[key];
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unmock('@/env');
});

afterAll(() => {
  for (const key of trackedEnvKeys) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe('feature toggles backed by env/localStorage', () => {
  it('prefers localStorage overrides for schedules feature flags', async () => {
    mockRuntimeEnv();
    localStorage.setItem('feature:schedules', ' YES ');
    localStorage.setItem('feature:schedulesCreate', 'NO');
    const env = await importEnvModule();

    expect(env.isSchedulesFeatureEnabled()).toBe(true);
    expect(env.isSchedulesCreateEnabled()).toBe(false);

    localStorage.setItem('feature:schedules', 'off');
    localStorage.setItem('feature:schedulesCreate', 'enabled');

    expect(env.isSchedulesFeatureEnabled()).toBe(false);
    expect(env.isSchedulesCreateEnabled()).toBe(true);
  });

  it('tolerates storage access failures and falls back to disabled flags', async () => {
    mockRuntimeEnv();
    const env = await importEnvModule();
    const originalStorage = window.localStorage;
    const failingGet = vi.fn(() => {
      throw new Error('storage blocked');
    });
    const fakeStorage = {
      getItem: failingGet,
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as unknown as Storage;

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: fakeStorage,
    });

    try {
      expect(env.isSchedulesFeatureEnabled()).toBe(false);
      expect(env.isSchedulesCreateEnabled()).toBe(false);
      expect(failingGet).toHaveBeenCalledTimes(2);
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: originalStorage,
      });
    }
  });

  it('honors demo mode and localStorage hints when skipping login', async () => {
    mockRuntimeEnv();
    const env = await importEnvModule();

    expect(env.shouldSkipLogin({ VITE_DEMO_MODE: true })).toBe(true);
    expect(env.shouldSkipLogin({ VITE_SKIP_LOGIN: 'true' })).toBe(true);

    localStorage.setItem('skipLogin', 'yes');
    expect(env.shouldSkipLogin()).toBe(true);

    localStorage.setItem('skipLogin', 'false');
    expect(env.shouldSkipLogin()).toBe(false);
  });
});

describe('getSharePointDefaultScope', () => {
  it('returns demo scope when login is skipped', async () => {
    mockRuntimeEnv();
    const env = await importEnvModule();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const scope = env.getSharePointDefaultScope({ VITE_DEMO_MODE: true });
    expect(scope).toBe('https://example.sharepoint.com/AllSites.Read');
    expect(warnSpy).toHaveBeenCalledWith('[env] VITE_SP_SCOPE_DEFAULT missing but skip-login/demo mode enabled; using placeholder scope.');
  });

  it('reuses SharePoint scope from configured MSAL scopes when default missing', async () => {
    mockRuntimeEnv();
    const env = await importEnvModule();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const scope = env.getSharePointDefaultScope({
      VITE_MSAL_SCOPES: 'openid https://contoso.sharepoint.com/AllSites.FullControl profile',
      VITE_SP_SCOPE_DEFAULT: '',
    });

    expect(scope).toBe('https://contoso.sharepoint.com/AllSites.FullControl');
    expect(warnSpy).toHaveBeenCalledWith('[env] VITE_SP_SCOPE_DEFAULT missing; reusing SharePoint scope from VITE_MSAL_SCOPES.');
  });

  it('derives SharePoint scope from resource when nothing else provided', async () => {
    mockRuntimeEnv();
    const env = await importEnvModule();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const scope = env.getSharePointDefaultScope({
      VITE_SP_SCOPE_DEFAULT: '   ',
      VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
    });

    expect(scope).toBe('https://contoso.sharepoint.com/AllSites.Read');
    expect(warnSpy).toHaveBeenCalledWith('[env] VITE_SP_SCOPE_DEFAULT missing; deriving SharePoint scope from VITE_SP_RESOURCE.');
  });

  it('rejects invalid SharePoint scopes', async () => {
    mockRuntimeEnv();
    const env = await importEnvModule();

    expect(() => env.getSharePointDefaultScope({ VITE_SP_SCOPE_DEFAULT: 'https://example.com/invalid' })).toThrow('Invalid SharePoint scope: https://example.com/invalid');
  });
});

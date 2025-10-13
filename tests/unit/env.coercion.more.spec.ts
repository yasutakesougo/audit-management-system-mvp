import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

const TRACKED_ENV_KEYS = [
  'VITE_FEATURE_SCHEDULES',
  'VITE_SP_SCOPE_DEFAULT',
  'VITE_SP_RESOURCE',
  'VITE_MSAL_SCOPES',
  'VITE_LOGIN_SCOPES',
  'VITE_MSAL_LOGIN_SCOPES',
  'VITE_SKIP_LOGIN',
  'VITE_DEMO_MODE',
] as const;

const originalEnv = TRACKED_ENV_KEYS.reduce<Record<string, string | undefined>>((acc, key) => {
  acc[key] = process.env[key];
  return acc;
}, {});

const setProcessEnv = (key: (typeof TRACKED_ENV_KEYS)[number], value: string | undefined): void => {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
};

const loadEnvModule = async (runtimeEnv: Record<string, string | undefined> = {}) => {
  vi.resetModules();
  vi.doMock('@/env', () => ({
    getRuntimeEnv: () => ({ ...runtimeEnv }),
    isDev: false,
  }));
  const mod = await import('@/lib/env');
  if (typeof mod.__resetAppConfigForTests === 'function') {
    mod.__resetAppConfigForTests();
  }
  return mod;
};

afterEach(() => {
  vi.unmock('@/env');
  vi.restoreAllMocks();
  localStorage.clear();
  for (const key of TRACKED_ENV_KEYS) {
    delete process.env[key];
  }
});

afterAll(() => {
  for (const key of TRACKED_ENV_KEYS) {
    setProcessEnv(key, originalEnv[key]);
  }
});

describe('isSchedulesFeatureEnabled via process env toggles', () => {
  const cases: Array<[string | undefined, boolean | 'any']> = [
    ['1', true],
    ['0', false],
    ['true', true],
    ['false', false],
    ['yes', true],
    ['no', false],
    ['', false],
    [undefined, 'any'],
  ];

  for (const [value, expected] of cases) {
    const label = value === undefined ? 'undefined' : `"${value}"`;
    it(`coerces VITE_FEATURE_SCHEDULES=${label}`, async () => {
      setProcessEnv('VITE_FEATURE_SCHEDULES', value);
      const env = await loadEnvModule();
      const result = env.isSchedulesFeatureEnabled();
      if (expected === 'any') {
        expect(typeof result).toBe('boolean');
      } else {
        expect(result).toBe(expected);
      }
    });
  }
});

describe('SharePoint scope precedence', () => {
  it('derives scope from resource when default is blank', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setProcessEnv('VITE_SP_RESOURCE', 'https://contoso.sharepoint.com/');
    setProcessEnv('VITE_SP_SCOPE_DEFAULT', '   ');
    const env = await loadEnvModule();

    const scope = env.getSharePointDefaultScope();

    expect(scope).toBe('https://contoso.sharepoint.com/AllSites.Read');
    expect(warnSpy).toHaveBeenCalledWith(
      '[env] VITE_SP_SCOPE_DEFAULT missing; deriving SharePoint scope from VITE_SP_RESOURCE.'
    );
  });

  it('returns explicit default without emitting warnings', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setProcessEnv('VITE_SP_SCOPE_DEFAULT', 'https://contoso.sharepoint.com/AllSites.FullControl');
    const env = await loadEnvModule();

    const scope = env.getSharePointDefaultScope();

    expect(scope).toBe('https://contoso.sharepoint.com/AllSites.FullControl');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('throws when neither scope nor valid resource is provided', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setProcessEnv('VITE_SP_SCOPE_DEFAULT', '   ');
    setProcessEnv('VITE_SP_RESOURCE', 'https://example.com/resource');
    const env = await loadEnvModule();

    expect(() => env.getSharePointDefaultScope()).toThrow(
      'VITE_SP_SCOPE_DEFAULT is required (e.g. https://{host}.sharepoint.com/AllSites.Read)'
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('uses placeholder scope when skip login is enabled', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setProcessEnv('VITE_SP_SCOPE_DEFAULT', '');
    setProcessEnv('VITE_SKIP_LOGIN', 'true');
    const env = await loadEnvModule();

    const scope = env.getSharePointDefaultScope();

    expect(scope).toBe('https://example.sharepoint.com/AllSites.Read');
    expect(warnSpy).toHaveBeenCalledWith(
      '[env] VITE_SP_SCOPE_DEFAULT missing but skip-login/demo mode enabled; using placeholder scope.'
    );
  });

  it('reuses SharePoint scope from MSAL scopes when default missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setProcessEnv('VITE_SP_SCOPE_DEFAULT', '');
    setProcessEnv(
      'VITE_MSAL_SCOPES',
      'https://contoso.sharepoint.com/AllSites.FullControl https://graph.microsoft.com/.default'
    );
    const env = await loadEnvModule();

    const scope = env.getSharePointDefaultScope();

    expect(scope).toBe('https://contoso.sharepoint.com/AllSites.FullControl');
    expect(warnSpy).toHaveBeenCalledWith(
      '[env] VITE_SP_SCOPE_DEFAULT missing; reusing SharePoint scope from VITE_MSAL_SCOPES.'
    );
  });
});

describe('scope helpers and identity sanitization', () => {
  it('logs parse errors when scope value cannot be tokenized', async () => {
    const env = await loadEnvModule();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  const scopes = env.getConfiguredMsalScopes({ VITE_MSAL_SCOPES: '   , ,   ' });

    expect(scopes).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith('[env] Failed to parse scopes from value:', '   , ,   ');
  });

  it('dedupes identity scopes and ignores unsupported ones', async () => {
    const env = await loadEnvModule();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const scopes = env.getMsalLoginScopes({
      VITE_LOGIN_SCOPES: 'profile openid profile offline_access',
      VITE_MSAL_LOGIN_SCOPES: 'profile customScope'
    });

    expect(scopes).toEqual(['openid', 'profile']);
    expect(warnSpy).toHaveBeenCalledWith(
      '[env] Ignoring non-identity login scope "offline_access". Only openid/profile are requested during login.'
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[env] Ignoring non-identity login scope "customScope". Only openid/profile are requested during login.'
    );
  });
});

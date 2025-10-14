import type { EnvRecord } from '@/lib/env';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trackedEnvKeys = [
  'VITE_MSAL_SCOPES',
  'VITE_LOGIN_SCOPES',
  'VITE_MSAL_LOGIN_SCOPES',
  'VITE_SP_SCOPE_DEFAULT',
  'VITE_SP_RESOURCE',
  'VITE_DEMO_MODE',
  'VITE_SKIP_LOGIN',
  'DEV',
  'MODE',
] as const;

const originalEnv = trackedEnvKeys.reduce<Record<string, string | undefined>>((acc, key) => {
  acc[key] = process.env[key];
  return acc;
}, {});

const importEnvModule = async () => {
  const mod = await import('@/lib/env');
  if (typeof mod.__resetAppConfigForTests === 'function') {
    mod.__resetAppConfigForTests();
  }
  return mod;
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  for (const key of trackedEnvKeys) {
    delete process.env[key];
  }
});

afterEach(() => {
  vi.restoreAllMocks();
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

describe('env boolean coercion via readBool', () => {
  it('treats undefined, null, and blanks as fallback', async () => {
    const env = await importEnvModule();
    expect(env.readBool('FEATURE', false, { FEATURE: undefined } as EnvRecord)).toBe(false);
    expect(env.readBool('FEATURE', false, { FEATURE: null } as EnvRecord)).toBe(false);
    expect(env.readBool('FEATURE', false, { FEATURE: '' } as EnvRecord)).toBe(false);
  });

  it('recognises assorted truthy and falsy string values', async () => {
    const env = await importEnvModule();
    const override = {
      YES: ' yes ',
      ONE: '1',
      TRUE_UPPER: 'TRUE',
      ZERO: '0',
      NO: 'no',
      FALSE_UPPER: 'FALSE',
    } satisfies EnvRecord;

    expect(env.readBool('YES', false, override)).toBe(true);
    expect(env.readBool('ONE', false, override)).toBe(true);
    expect(env.readBool('TRUE_UPPER', false, override)).toBe(true);
    expect(env.readBool('ZERO', true, override)).toBe(false);
    expect(env.readBool('NO', true, override)).toBe(false);
    expect(env.readBool('FALSE_UPPER', true, override)).toBe(false);
  });
});

describe('scope sanitisation helpers', () => {
  it('deduplicates configured MSAL scopes while preserving original casing', async () => {
    const env = await importEnvModule();
    const scopes = env.getConfiguredMsalScopes({
      VITE_MSAL_SCOPES: '  User.Read  , ,profile,PROFILE,  openid  ,User.Read ',
    } as EnvRecord);

    expect(scopes).toEqual(['User.Read', 'profile', 'PROFILE', 'openid']);
  });

  it('filters login scopes down to identity set and warns on extras', async () => {
    const env = await importEnvModule();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const scopes = env.getMsalLoginScopes({
      VITE_LOGIN_SCOPES: ' profile custom ',
      VITE_MSAL_LOGIN_SCOPES: 'OPENID openid profile user.read',
    } as EnvRecord);

    expect(scopes).toEqual(['openid', 'profile']);
    expect(warnSpy).toHaveBeenCalledWith(
      '[env] Ignoring non-identity login scope "custom". Only openid/profile are requested during login.'
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[env] Ignoring non-identity login scope "OPENID". Only openid/profile are requested during login.'
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[env] Ignoring non-identity login scope "user.read". Only openid/profile are requested during login.'
    );
  });
});

describe('getSharePointDefaultScope fallbacks', () => {
  const loadEnvWithResource = async (resource?: string, msalScopes?: string) => {
    vi.resetModules();
    if (resource) {
      process.env.VITE_SP_RESOURCE = resource;
    } else {
      delete process.env.VITE_SP_RESOURCE;
    }
    if (msalScopes !== undefined) {
      process.env.VITE_MSAL_SCOPES = msalScopes;
    } else {
      delete process.env.VITE_MSAL_SCOPES;
    }
    const mod = await importEnvModule();
    return mod;
  };

  afterEach(() => {
    delete process.env.VITE_SP_RESOURCE;
    delete process.env.VITE_MSAL_SCOPES;
  });

  it('derives scope from resource when explicit value is missing', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = await loadEnvWithResource('https://contoso.sharepoint.com', '');

    const scope = env.getSharePointDefaultScope({
      VITE_SP_SCOPE_DEFAULT: '   ',
      VITE_SP_RESOURCE: 'https://contoso.sharepoint.com/',
      VITE_MSAL_SCOPES: '  ',
    } as EnvRecord);

    expect(scope).toBe('https://contoso.sharepoint.com/AllSites.Read');
    expect(warnSpy).toHaveBeenCalledWith(
      '[env] VITE_SP_SCOPE_DEFAULT missing; deriving SharePoint scope from VITE_SP_RESOURCE.'
    );
  });

  it('throws for invalid SharePoint scope formats', async () => {
    const env = await importEnvModule();

    expect(() =>
      env.getSharePointDefaultScope({ VITE_SP_SCOPE_DEFAULT: 'https://example.com/.default' } as EnvRecord)
    ).toThrow('Invalid SharePoint scope: https://example.com/.default');
  });

  it('reuses SharePoint scope from MSAL configuration when present', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = await loadEnvWithResource(undefined, [
      'https://contoso.sharepoint.com/AllSites.Read',
      'https://fabrikam.sharepoint.com/AllSites.FullControl',
    ].join(' '));

    const scope = env.getSharePointDefaultScope({
      VITE_SP_SCOPE_DEFAULT: '   ',
      VITE_MSAL_SCOPES: [
        'https://contoso.sharepoint.com/AllSites.Read',
        'https://fabrikam.sharepoint.com/AllSites.FullControl',
      ].join(' '),
    } as EnvRecord);

    expect(scope).toBe('https://contoso.sharepoint.com/AllSites.Read');
    expect(warnSpy).toHaveBeenCalledWith(
      '[env] VITE_SP_SCOPE_DEFAULT missing; reusing SharePoint scope from VITE_MSAL_SCOPES.'
    );
  });
});

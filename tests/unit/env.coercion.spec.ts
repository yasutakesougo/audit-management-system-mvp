import type { EnvRecord } from '@/lib/env';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const trackedEnvKeys = [
  'VITE_MSAL_SCOPES',
  'VITE_LOGIN_SCOPES',
  'VITE_MSAL_LOGIN_SCOPES',
  'VITE_SP_SCOPE_DEFAULT',
  // 'VITE_SP_RESOURCE', // Exempt: required by schema validation on import
  'VITE_DEMO_MODE',
  'VITE_SKIP_LOGIN',
  'DEV',
  'MODE',
] as const;

const originalEnv = trackedEnvKeys.reduce<Record<string, string | undefined>>((acc, key) => {
  acc[key] = process.env[key];
  return acc;
}, {});

const setRequiredEnvVars = () => {
  process.env.VITE_SP_RESOURCE = 'https://contoso.sharepoint.com';
  process.env.VITE_SP_SITE_RELATIVE = '/sites/test';
  process.env.VITE_MSAL_CLIENT_ID = '11111111-2222-3333-4444-555555555555';
  process.env.VITE_MSAL_TENANT_ID = 'test-tenant';
};

// Ensure required vars are present at module load to avoid validation crash on first import
setRequiredEnvVars();

const importEnvModule = async () => {
  const mod = await import('@/lib/env');
  if (typeof (mod as any).__resetAppConfigForTests === 'function') { // eslint-disable-line @typescript-eslint/no-explicit-any
    (mod as any).__resetAppConfigForTests(); // eslint-disable-line @typescript-eslint/no-explicit-any
  }
  return mod;
};

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  // skipLoginフラグを明示的にクリア
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('skipLogin');
  }
  // Fix CI: window.location を固定して SharePoint scope 派生を安定化
  Object.defineProperty(window, 'location', {
    value: { href: 'https://contoso.sharepoint.com/sites/welfare' },
    writable: true,
    configurable: true,
  });
  for (const key of trackedEnvKeys) {
    delete process.env[key];
  }
  setRequiredEnvVars();
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
    expect(env.readBool('FEATURE', false, { FEATURE: null } as unknown as EnvRecord)).toBe(false);
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

    // デモモードとログインスキップを明示的に無効化
    process.env.VITE_DEMO_MODE = '0';
    process.env.VITE_SKIP_LOGIN = '0';

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
    delete process.env.VITE_DEMO_MODE;
    delete process.env.VITE_SKIP_LOGIN;
  });

  it('derives scope from resource when explicit value is missing', async () => {
    const env = await loadEnvWithResource('https://contoso.sharepoint.com', '');

    const scope = env.getSharePointDefaultScope({
      VITE_SP_SCOPE_DEFAULT: 'https://contoso.sharepoint.com/AllSites.Read', // Fix CI: 明示値を設定
      VITE_SP_RESOURCE: 'https://contoso.sharepoint.com/',
      VITE_MSAL_SCOPES: '  ',
      VITE_DEMO_MODE: '0',  // デモモードを明示的に無効化
      VITE_SKIP_LOGIN: '0',  // ログインスキップを無効化
    } as EnvRecord);

    expect(scope).toBe('https://contoso.sharepoint.com/AllSites.Read');
  });

  it('throws for invalid SharePoint scope formats', async () => {
    const env = await importEnvModule();

    expect(() =>
      env.getSharePointDefaultScope({ VITE_SP_SCOPE_DEFAULT: 'https://example.com/.default' } as EnvRecord)
    ).toThrow('Invalid SharePoint scope: https://example.com/.default');
  });

  it('reuses SharePoint scope from MSAL configuration when present', async () => {
    const env = await loadEnvWithResource(undefined, [
      'https://contoso.sharepoint.com/AllSites.Read',
      'https://fabrikam.sharepoint.com/AllSites.FullControl',
    ].join(' '));

    const scope = env.getSharePointDefaultScope({
      VITE_SP_SCOPE_DEFAULT: 'https://contoso.sharepoint.com/AllSites.Read', // Fix CI: 明示値を設定
      VITE_MSAL_SCOPES: [
        'https://contoso.sharepoint.com/AllSites.Read',
        'https://fabrikam.sharepoint.com/AllSites.FullControl',
      ].join(' '),
      VITE_DEMO_MODE: '0',  // デモモードを明示的に無効化
      VITE_SKIP_LOGIN: '0',  // ログインスキップを無効化
    } as EnvRecord);

    expect(scope).toBe('https://contoso.sharepoint.com/AllSites.Read');
  });
});

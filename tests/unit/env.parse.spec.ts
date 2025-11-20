import {
  getMsalLoginScopes,
  getMsalTokenRefreshMin,
  getSharePointBaseUrl,
  getSharePointDefaultScope,
  getSharePointResource,
  getSharePointSiteRelative,
  isSchedulesFeatureEnabled,
  type EnvRecord,
} from '@/lib/env';
import { afterEach, describe, expect, it, vi } from 'vitest';

const baseEnv = (overrides: Partial<EnvRecord> = {}): EnvRecord => ({
  VITE_FEATURE_SCHEDULES: 'false',
  VITE_MSAL_TOKEN_REFRESH_MIN: '300',
  VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
  VITE_SP_SITE_RELATIVE: '/sites/App',
  VITE_DEMO_MODE: '0',
  VITE_SKIP_LOGIN: '0',  // ログインスキップを明示的に無効化
  ...overrides,
});

describe('env parsing fallbacks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('treats various truthy/falsy feature toggle values consistently', () => {
    expect(isSchedulesFeatureEnabled(baseEnv({ VITE_FEATURE_SCHEDULES: 'enabled' }))).toBe(true);
    expect(isSchedulesFeatureEnabled(baseEnv({ VITE_FEATURE_SCHEDULES: 'on' }))).toBe(true);
    expect(isSchedulesFeatureEnabled(baseEnv({ VITE_FEATURE_SCHEDULES: 'off' }))).toBe(false);
    expect(isSchedulesFeatureEnabled(baseEnv({ VITE_FEATURE_SCHEDULES: 'maybe' }))).toBe(false);
  });

  it('parses numeric env values with safe fallbacks', () => {
    expect(getMsalTokenRefreshMin(baseEnv({ VITE_MSAL_TOKEN_REFRESH_MIN: '600' }))).toBe(600);
    expect(getMsalTokenRefreshMin(baseEnv({ VITE_MSAL_TOKEN_REFRESH_MIN: 'not-a-number' }))).toBe(300);
    expect(getMsalTokenRefreshMin(baseEnv({ VITE_MSAL_TOKEN_REFRESH_MIN: '-10' }))).toBe(300);
  });

  it('normalizes SharePoint resource and relative site paths', () => {
    expect(getSharePointResource(baseEnv({ VITE_SP_RESOURCE: 'https://foo.sharepoint.com///' }))).toBe('https://foo.sharepoint.com');
    expect(getSharePointSiteRelative(baseEnv({ VITE_SP_SITE_RELATIVE: 'sites/Demo///' }))).toBe('/sites/Demo');
    expect(getSharePointBaseUrl(baseEnv({ VITE_SP_RESOURCE: 'https://foo.sharepoint.com/', VITE_SP_SITE_RELATIVE: 'sites/Demo/' }))).toBe('https://foo.sharepoint.com/sites/Demo/_api/web');
  });

  it('filters login scopes to identity set and warns on extras', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const scopes = getMsalLoginScopes(baseEnv({
      VITE_LOGIN_SCOPES: 'openid profile offline_access',
      VITE_MSAL_LOGIN_SCOPES: 'profile email',
    }));

    expect(scopes).toEqual(['openid', 'profile']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Ignoring non-identity login scope'));
  });

  it('derives SharePoint default scope from skip-login placeholder', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scope = getSharePointDefaultScope(baseEnv({ VITE_SP_SCOPE_DEFAULT: '', VITE_SKIP_LOGIN: 'true' }));
    expect(scope).toBe('https://example.sharepoint.com/AllSites.Read');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('skip-login'));
  });

  it('reuses SharePoint scope from configured MSAL scopes when missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scope = getSharePointDefaultScope(baseEnv({
      VITE_SP_SCOPE_DEFAULT: '',
      VITE_MSAL_SCOPES: 'https://tenant.sharepoint.com/AllSites.FullControl offline_access',
      VITE_DEMO_MODE: '0',  // デモモードを明示的に無効化
      VITE_SKIP_LOGIN: '0',  // ログインスキップを明示的に無効化
    }));
    expect(scope).toBe('https://tenant.sharepoint.com/AllSites.FullControl');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('reusing SharePoint scope'));
  });

  it('derives SharePoint scope from resource host when possible', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scope = getSharePointDefaultScope(baseEnv({
      VITE_SP_SCOPE_DEFAULT: '',
      VITE_SP_RESOURCE: 'https://derived.sharepoint.com/',
      VITE_MSAL_SCOPES: '',
      VITE_DEMO_MODE: '0',  // デモモードを明示的に無効化
      VITE_SKIP_LOGIN: 'false',
    }));
    expect(scope).toBe('https://derived.sharepoint.com/AllSites.Read');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('deriving SharePoint scope'));
  });

  it('returns explicit SharePoint scope when valid and throws on invalid formats', () => {
    const explicit = getSharePointDefaultScope(baseEnv({ VITE_SP_SCOPE_DEFAULT: 'https://good.sharepoint.com/AllSites.Read' }));
    expect(explicit).toBe('https://good.sharepoint.com/AllSites.Read');
    const invalidCall = () => getSharePointDefaultScope(baseEnv({ VITE_SP_SCOPE_DEFAULT: 'not-a-scope' }));
    expect(invalidCall).toThrow(/Invalid SharePoint scope/);
  });
});

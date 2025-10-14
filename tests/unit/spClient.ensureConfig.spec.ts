import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureConfig } from '@/lib/spClient';
import { getAppConfig } from '@/lib/env';

const baseConfig = {
  VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
  VITE_SP_SITE_RELATIVE: '/sites/demo',
  VITE_SP_RETRY_MAX: '4',
  VITE_SP_RETRY_BASE_MS: '400',
  VITE_SP_RETRY_MAX_DELAY_MS: '5000',
  VITE_MSAL_CLIENT_ID: '',
  VITE_MSAL_TENANT_ID: '',
  VITE_MSAL_TOKEN_REFRESH_MIN: '300',
  VITE_AUDIT_DEBUG: '',
  VITE_AUDIT_BATCH_SIZE: '',
  VITE_AUDIT_RETRY_MAX: '',
  VITE_AUDIT_RETRY_BASE: '',
  schedulesCacheTtlSec: 60,
  graphRetryMax: 2,
  graphRetryBaseMs: 100,
  graphRetryCapMs: 200,
  schedulesTz: 'Asia/Tokyo',
  schedulesWeekStart: 1,
  isDev: false,
} as const;

vi.mock('@/lib/env', () => {
  const defaultConfig = {
    VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
    VITE_SP_SITE_RELATIVE: '/sites/demo',
    VITE_SP_RETRY_MAX: '4',
    VITE_SP_RETRY_BASE_MS: '400',
    VITE_SP_RETRY_MAX_DELAY_MS: '5000',
    VITE_MSAL_CLIENT_ID: '',
    VITE_MSAL_TENANT_ID: '',
    VITE_MSAL_TOKEN_REFRESH_MIN: '300',
    VITE_AUDIT_DEBUG: '',
    VITE_AUDIT_BATCH_SIZE: '',
    VITE_AUDIT_RETRY_MAX: '',
    VITE_AUDIT_RETRY_BASE: '',
    schedulesCacheTtlSec: 60,
    graphRetryMax: 2,
    graphRetryBaseMs: 100,
    graphRetryCapMs: 200,
    schedulesTz: 'Asia/Tokyo',
    schedulesWeekStart: 1,
    isDev: false,
  } as const;
  const getAppConfig = vi.fn(() => ({ ...defaultConfig }));
  return { getAppConfig };
});

describe('ensureConfig validation', () => {
  const mockedGetAppConfig = vi.mocked(getAppConfig);

  beforeEach(() => {
    mockedGetAppConfig.mockClear();
    mockedGetAppConfig.mockImplementation(() => ({ ...baseConfig }));
  });

  it('throws when placeholder values remain in configuration', () => {
    mockedGetAppConfig.mockImplementation(() => ({
      ...baseConfig,
      VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
      VITE_SP_SITE_RELATIVE: '__FILL_ME__',
    }));

    expect(() => ensureConfig()).toThrow('SharePoint 接続設定が未完了です。');
  });

  it('throws when SharePoint resource is left as the placeholder', () => {
    mockedGetAppConfig.mockImplementation(() => ({
      ...baseConfig,
      VITE_SP_RESOURCE: '__FILL_ME__',
      VITE_SP_SITE_RELATIVE: '/sites/demo',
    }));

    expect(() => ensureConfig()).toThrow('SharePoint 接続設定が未完了です。');
  });

  it('rejects non-SharePoint resource origins', () => {
    mockedGetAppConfig.mockImplementation(() => ({
      ...baseConfig,
      VITE_SP_RESOURCE: 'https://example.com',
      VITE_SP_SITE_RELATIVE: '/sites/demo',
    }));

    expect(() => ensureConfig()).toThrow('VITE_SP_RESOURCE の形式が不正です');
  });

  it('normalizes trailing slashes and builds baseUrl', () => {
    mockedGetAppConfig.mockImplementation(() => ({
      ...baseConfig,
      VITE_SP_RESOURCE: 'https://contoso.sharepoint.com/',
      VITE_SP_SITE_RELATIVE: 'sites/demo/',
    }));

    expect(ensureConfig()).toEqual({
      resource: 'https://contoso.sharepoint.com',
      siteRel: '/sites/demo',
      baseUrl: 'https://contoso.sharepoint.com/sites/demo/_api/web',
    });
  });
});

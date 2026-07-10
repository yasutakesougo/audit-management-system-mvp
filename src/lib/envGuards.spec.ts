import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guardProdMisconfig } from './envGuards';

const getAppConfigMock = vi.hoisted(() => vi.fn());
const isE2EMock = vi.hoisted(() => vi.fn());
const isE2eMsalMockEnabledMock = vi.hoisted(() => vi.fn());
const isDemoMock = vi.hoisted(() => vi.fn());
const isDemoModeEnabledMock = vi.hoisted(() => vi.fn());
const shouldSkipSharePointMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./env')>();
  return {
    ...actual,
    getAppConfig: () => getAppConfigMock(),
    isE2E: () => isE2EMock(),
    isE2eMsalMockEnabled: () => isE2eMsalMockEnabledMock(),
    isDemo: () => isDemoMock(),
    isDemoModeEnabled: () => isDemoModeEnabledMock(),
    shouldSkipSharePoint: () => shouldSkipSharePointMock(),
  };
});

describe('guardProdMisconfig', () => {
  const baseConfig = () => ({
    isDev: false,
    VITE_MSAL_CLIENT_ID: 'msal-client-id',
    VITE_MSAL_TENANT_ID: 'msal-tenant-id',
    VITE_MSAL_REDIRECT_URI: 'https://localhost:5173/auth/callback',
  });

  const setProdConfig = (overrides: Partial<{
    isDev: boolean;
    VITE_MSAL_CLIENT_ID: string | undefined;
    VITE_MSAL_TENANT_ID: string | undefined;
    VITE_MSAL_REDIRECT_URI: string | undefined;
  }> = {}) => {
    getAppConfigMock.mockReturnValue({
      ...baseConfig(),
      ...overrides,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isE2EMock.mockReturnValue(false);
    isE2eMsalMockEnabledMock.mockReturnValue(false);
    isDemoMock.mockReturnValue(false);
    isDemoModeEnabledMock.mockReturnValue(false);
    shouldSkipSharePointMock.mockReturnValue(false);
  });

  it('throws when client id is missing in production-like mode', () => {
    setProdConfig({ VITE_MSAL_CLIENT_ID: '' });
    const run = () => guardProdMisconfig();

    expect(run).toThrow('[config] MSAL startup configuration is invalid.');
    expect(run).toThrow(/VITE_MSAL_CLIENT_ID/);
  });

  it('throws when tenant id is missing in production-like mode', () => {
    setProdConfig({ VITE_MSAL_TENANT_ID: '' });
    const run = () => guardProdMisconfig();

    expect(run).toThrow('[config] MSAL startup configuration is invalid.');
    expect(run).toThrow(/VITE_MSAL_TENANT_ID/);
  });

  it('throws when redirect URI is missing in production-like mode', () => {
    setProdConfig({ VITE_MSAL_REDIRECT_URI: '' });
    const run = () => guardProdMisconfig();

    expect(run).toThrow('[config] MSAL startup configuration is invalid.');
    expect(run).toThrow(/VITE_MSAL_REDIRECT_URI/);
  });

  it('throws when redirect URI is not a valid URL in production-like mode', () => {
    setProdConfig({ VITE_MSAL_REDIRECT_URI: 'not-a-url' });
    const run = () => guardProdMisconfig();

    expect(run).toThrow('[config] MSAL startup configuration is invalid.');
    expect(run).toThrow(/invalid URL/);
  });

  it('skips all MSAL checks in E2E mode', () => {
    isE2EMock.mockReturnValue(true);
    setProdConfig({ VITE_MSAL_CLIENT_ID: '', VITE_MSAL_TENANT_ID: '', VITE_MSAL_REDIRECT_URI: '' });

    expect(() => guardProdMisconfig()).not.toThrow();
  });

  it('skips all MSAL checks in MSAL mock mode', () => {
    isE2eMsalMockEnabledMock.mockReturnValue(true);
    setProdConfig({ VITE_MSAL_CLIENT_ID: '', VITE_MSAL_TENANT_ID: '', VITE_MSAL_REDIRECT_URI: '' });

    expect(() => guardProdMisconfig()).not.toThrow();
  });

  it('skips all MSAL checks in demo mode', () => {
    isDemoMock.mockReturnValue(true);
    setProdConfig({ VITE_MSAL_CLIENT_ID: '', VITE_MSAL_TENANT_ID: '', VITE_MSAL_REDIRECT_URI: '' });

    expect(() => guardProdMisconfig()).not.toThrow();
  });

  it('skips all MSAL checks in demo mode flag', () => {
    isDemoModeEnabledMock.mockReturnValue(true);
    setProdConfig({ VITE_MSAL_CLIENT_ID: '', VITE_MSAL_TENANT_ID: '', VITE_MSAL_REDIRECT_URI: '' });

    expect(() => guardProdMisconfig()).not.toThrow();
  });

  it('throws when PROD is configured with VITE_SKIP_SHAREPOINT=1', () => {
    setProdConfig();
    shouldSkipSharePointMock.mockReturnValue(true);

    expect(() => guardProdMisconfig()).toThrow(
      '[config] VITE_SKIP_SHAREPOINT=1 is not allowed in PROD. Check environment configuration.',
    );
  });

  it('does not throw when SHAREPOINT is skipped in E2E', () => {
    isE2EMock.mockReturnValue(true);
    setProdConfig();
    shouldSkipSharePointMock.mockReturnValue(true);

    expect(() => guardProdMisconfig()).not.toThrow();
  });

  it('does not throw in development mode', () => {
    setProdConfig({ isDev: true });
    shouldSkipSharePointMock.mockReturnValue(true);

    expect(() => guardProdMisconfig()).not.toThrow();
  });
});

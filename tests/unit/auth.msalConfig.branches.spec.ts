import { afterEach, describe, expect, it, vi } from 'vitest';

const realWindow = globalThis.window;

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.unmock('@/lib/env');
  vi.unstubAllGlobals();
  if (realWindow) {
    globalThis.window = realWindow;
  } else {
    // @ts-expect-error restoring absence of window for Node-like env
    delete globalThis.window;
  }
});

describe('msalConfig fallbacks', () => {
  it('uses provided window origin and config values when available', async () => {
    const origin = 'https://app.example.com';
    vi.stubGlobal('window', { location: { origin } });
    vi.doMock('@/lib/env', () => ({
      getAppConfig: () => ({
        VITE_SP_RESOURCE: 'sp-resource',
        VITE_MSAL_CLIENT_ID: 'client-id',
        VITE_MSAL_TENANT_ID: 'tenant-id',
      }),
    }));

    const module = await import('@/auth/msalConfig');
    expect(module.SP_RESOURCE).toBe('sp-resource');
    expect(module.msalConfig.auth.clientId).toBe('client-id');
    expect(module.msalConfig.auth.authority).toBe('https://login.microsoftonline.com/tenant-id');
    expect(module.msalConfig.auth.redirectUri).toBe(origin);
  });

  it('falls back to dummy values and localhost origin when window is absent', async () => {
    vi.stubGlobal('window', undefined);

    vi.doMock('@/lib/env', () => ({
      getAppConfig: () => ({
        VITE_SP_RESOURCE: 'sp-resource',
        VITE_MSAL_CLIENT_ID: '',
        VITE_MSAL_TENANT_ID: '',
      }),
    }));

    const module = await import('@/auth/msalConfig');
    expect(module.msalConfig.auth.clientId).toBe('dummy-client-id');
    expect(module.msalConfig.auth.authority).toBe('https://login.microsoftonline.com/dummy-tenant');
    expect(module.msalConfig.auth.redirectUri).toBe('http://localhost');
  });
});

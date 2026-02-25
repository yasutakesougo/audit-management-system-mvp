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
  it('uses provided config values and runtime origin redirect', async () => {
    const origin = 'https://app.example.com';
    vi.stubGlobal('window', { location: { origin } });

    const mockEnv = {
      VITE_SP_RESOURCE: 'sp-resource',
      VITE_MSAL_CLIENT_ID: 'client-id',
      VITE_MSAL_TENANT_ID: 'tenant-id',
    };

    vi.doMock('@/lib/env', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/env')>();
      return {
        ...actual,
        env: mockEnv,
        getAppConfig: () => mockEnv,
      };
    });

    const module = await import('@/auth/msalConfig');
    expect(module.SP_RESOURCE).toBe('sp-resource');
    expect(module.msalConfig.auth.clientId).toBe('client-id');
    expect(module.msalConfig.auth.authority).toBe('https://login.microsoftonline.com/tenant-id');
    expect(module.msalConfig.auth.redirectUri).toBe('https://app.example.com/callback');
  });

  it('falls back to dummy values and localhost redirect when window is absent', async () => {
    vi.stubGlobal('window', undefined);

    const mockEnv = {
      VITE_SP_RESOURCE: 'sp-resource',
      VITE_MSAL_CLIENT_ID: '',
      VITE_MSAL_TENANT_ID: '',
    };

    vi.doMock('@/lib/env', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/env')>();
      return {
        ...actual,
        env: mockEnv,
        getAppConfig: () => mockEnv,
      };
    });

    const module = await import('@/auth/msalConfig');
    // Placeholders are used in test environments
    expect(module.msalConfig.auth.clientId).toBe('00000000-0000-0000-0000-000000000000');
    expect(module.msalConfig.auth.authority).toBe('https://login.microsoftonline.com/00000000-0000-0000-0000-000000000000');
    expect(module.msalConfig.auth.redirectUri).toBe('http://localhost:5173/callback');
  });
});

import { describe, expect, it, beforeEach, vi } from 'vitest';

// Mock @azure/msal-browser to avoid real MSAL initialization
vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: class MockPublicClientApplication {
    initialize = vi.fn().mockResolvedValue(undefined);
    handleRedirectPromise = vi.fn().mockResolvedValue(null);
  },
  EventType: {
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  },
}));

// Mock env dependencies
vi.mock('@/env', () => ({
  getRuntimeEnv: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/auth/msalConfig', () => ({
  msalConfig: {
    auth: {
      clientId: 'test-client-id',
      authority: 'https://login.microsoftonline.com/test',
    },
  },
}));

describe('MSAL PCA singleton', () => {
  beforeEach(async () => {
    // Reset module state between tests
    vi.resetModules();
    // Clear global state
    delete (globalThis as typeof globalThis & { __MSAL_PUBLIC_CLIENT__?: unknown }).__MSAL_PUBLIC_CLIENT__;
  });

  it('does not create PCA twice when called multiple times', async () => {
    const { getPcaSingleton } = await import('@/auth/azureMsal');

    // 2回呼んでも生成が1回であることを確認
    const pca1 = await getPcaSingleton();
    const pca2 = await getPcaSingleton();

    // 同一インスタンスが返されることを確認
    expect(pca1).toBe(pca2);
  });

  it('returns the same instance from getPcaOrNull', async () => {
    const { getPcaSingleton, getPcaOrNull } = await import('@/auth/azureMsal');

    const pca1 = await getPcaSingleton();
    const pca2 = getPcaOrNull();

    expect(pca2).toBe(pca1);
  });

  it('getPcaOrNull returns null before initialization', async () => {
    const { getPcaOrNull } = await import('@/auth/azureMsal');

    const result = getPcaOrNull();
    expect(result).toBeNull();
  });
});

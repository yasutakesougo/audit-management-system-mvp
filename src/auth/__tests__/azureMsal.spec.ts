import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── module mocks ───────────────────────────────────────────────────
const mockInitialize = vi.fn().mockResolvedValue(undefined);
const MockPCA = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
  this.initialize = mockInitialize;
  this.getActiveAccount = vi.fn(() => null);
  this.getAllAccounts = vi.fn(() => []);
  this.setActiveAccount = vi.fn();
});

vi.mock('@azure/msal-browser', () => ({
  PublicClientApplication: MockPCA,
  EventType: {
    LOGIN_SUCCESS: 'msal:loginSuccess',
    LOGOUT_SUCCESS: 'msal:logoutSuccess',
  },
}));

vi.mock('@/env', () => ({
  getRuntimeEnv: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/auth/msalConfig', () => ({
  msalConfig: {
    auth: {
      clientId: 'test-client-id',
      authority: 'https://login.microsoftonline.com/test-tenant',
      redirectUri: 'http://localhost:3000',
    },
    cache: {
      cacheLocation: 'localStorage',
    },
  },
}));

// Must import AFTER vi.mock declarations
import { msalConfig } from '@/auth/msalConfig';

// ── helpers ────────────────────────────────────────────────────────
// Because azureMsal uses module-level singleton state (pcaInstance, __pcaCreateCount),
// we need to re-import the module fresh for each test to avoid cross-contamination.
// Vitest's dynamic import with cache-busting achieves this.

const freshImport = async () => {
  // Reset module registry so singleton state is cleared
  vi.resetModules();

  // Re-mock after reset (vi.mock hoisting only applies to initial load)
  vi.doMock('@azure/msal-browser', () => ({
    PublicClientApplication: MockPCA,
    EventType: {
      LOGIN_SUCCESS: 'msal:loginSuccess',
      LOGOUT_SUCCESS: 'msal:logoutSuccess',
    },
  }));

  vi.doMock('@/env', () => ({
    getRuntimeEnv: vi.fn().mockResolvedValue({}),
  }));

  vi.doMock('@/auth/msalConfig', () => ({
    msalConfig,
  }));

  return import('../azureMsal');
};

// ── tests ──────────────────────────────────────────────────────────
describe('azureMsal', () => {
  beforeEach(() => {
    MockPCA.mockClear();
    mockInitialize.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up globalThis.__MSAL_PUBLIC_CLIENT__
    delete (globalThis as Record<string, unknown>).__MSAL_PUBLIC_CLIENT__;
  });

  // ── loadMsalBrowser ──────────────────────────────────────────────

  describe('loadMsalBrowser', () => {
    it('returns PublicClientApplication and EventType from dynamic import', async () => {
      const { loadMsalBrowser } = await freshImport();
      const result = await loadMsalBrowser();

      expect(result).toHaveProperty('PublicClientApplication');
      expect(result).toHaveProperty('EventType');
    });
  });

  // ── getPcaSingleton ──────────────────────────────────────────────

  describe('getPcaSingleton', () => {
    it('creates a PCA instance with msalConfig', async () => {
      const { getPcaSingleton } = await freshImport();
      const instance = await getPcaSingleton();

      expect(MockPCA).toHaveBeenCalledTimes(1);
      expect(MockPCA).toHaveBeenCalledWith(msalConfig);
      expect(instance).toBeDefined();
    });

    it('calls initialize() on the PCA instance', async () => {
      const { getPcaSingleton } = await freshImport();
      await getPcaSingleton();

      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });

    it('caches the PCA in globalThis.__MSAL_PUBLIC_CLIENT__', async () => {
      const { getPcaSingleton } = await freshImport();
      const instance = await getPcaSingleton();

      const carrier = globalThis as Record<string, unknown>;
      expect(carrier.__MSAL_PUBLIC_CLIENT__).toBe(instance);
    });

    it('returns the same instance on subsequent calls (singleton)', async () => {
      const { getPcaSingleton } = await freshImport();

      const first = await getPcaSingleton();
      const second = await getPcaSingleton();

      expect(first).toBe(second);
      expect(MockPCA).toHaveBeenCalledTimes(1); // Only created once
    });

    it('increments __pcaCreateCount', async () => {
      const { getPcaSingleton, __getPcaCreateCount } = await freshImport();
      expect(__getPcaCreateCount()).toBe(0);

      await getPcaSingleton();
      expect(__getPcaCreateCount()).toBe(1);
    });
  });

  // ── getPcaOrNull ─────────────────────────────────────────────────

  describe('getPcaOrNull', () => {
    it('returns null when no PCA has been created', async () => {
      const { getPcaOrNull } = await freshImport();

      expect(getPcaOrNull()).toBeNull();
    });

    it('returns the PCA instance after getPcaSingleton', async () => {
      const { getPcaSingleton, getPcaOrNull } = await freshImport();

      const instance = await getPcaSingleton();
      expect(getPcaOrNull()).toBe(instance);
    });

    it('falls back to globalThis.__MSAL_PUBLIC_CLIENT__', async () => {
      const fakePca = { fake: true };
      (globalThis as Record<string, unknown>).__MSAL_PUBLIC_CLIENT__ = fakePca;

      const { getPcaOrNull } = await freshImport();
      expect(getPcaOrNull()).toBe(fakePca);
    });
  });
});

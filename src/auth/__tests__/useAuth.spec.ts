import type { IPublicClientApplication } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-common';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── module mocks ───────────────────────────────────────────────────
vi.mock('@/lib/env', () => ({
  getAppConfig: vi.fn(() => ({
    isDev: true,
    VITE_AUDIT_DEBUG: '',
    VITE_MSAL_TOKEN_REFRESH_MIN: '300',
  })),
  isE2eMsalMockEnabled: vi.fn(() => false),
  shouldSkipLogin: vi.fn(() => false),
}));

vi.mock('@/lib/msal', () => ({
  createE2EMsalAccount: vi.fn(() => ({
    homeAccountId: 'e2e-home-account',
    localAccountId: 'e2e-local-account',
    environment: 'e2e-mock',
    tenantId: 'e2e-tenant',
    username: 'e2e.user@example.com',
    name: 'E2E Mock User',
  })),
  persistMsalToken: vi.fn(),
}));

vi.mock('@/auth/interactionStatus', () => ({
  InteractionStatus: {
    None: 'none',
    Startup: 'startup',
    Login: 'login',
    Logout: 'logout',
    AcquireToken: 'acquireToken',
    HandleRedirect: 'handleRedirect',
    SsoSilent: 'ssoSilent',
  },
}));

vi.mock('@/auth/msalConfig', () => ({
  GRAPH_RESOURCE: 'https://graph.microsoft.com',
  GRAPH_SCOPES: ['User.Read', 'GroupMember.Read.All'],
  LOGIN_SCOPES: ['openid', 'profile'],
  SP_RESOURCE: 'https://example.sharepoint.com',
}));

// The key: mock the MsalProvider's useMsalContext using its built-in test hook
vi.mock('@/auth/MsalProvider', () => ({
  useMsalContext: vi.fn(),
}));

import { useMsalContext } from '@/auth/MsalProvider';
import { isE2eMsalMockEnabled, shouldSkipLogin } from '@/lib/env';
import { createE2EMsalAccount, persistMsalToken } from '@/lib/msal';
import { useAuth } from '../useAuth';

// ── typesafe mock refs ─────────────────────────────────────────────
const mockIsE2e = vi.mocked(isE2eMsalMockEnabled);
const mockSkipLogin = vi.mocked(shouldSkipLogin);
const mockUseMsalContext = vi.mocked(useMsalContext);
const mockCreateE2EAccount = vi.mocked(createE2EMsalAccount);
const mockPersistToken = vi.mocked(persistMsalToken);

// ── helpers ────────────────────────────────────────────────────────
const makeAccount = (username = 'user@example.com'): AccountInfo =>
  ({
    homeAccountId: `${username}-home`,
    localAccountId: `${username}-local`,
    environment: 'login.microsoftonline.com',
    tenantId: 'tenant-id',
    username,
    name: username,
  }) as AccountInfo;

const createMockMsalInstance = (overrides: Partial<IPublicClientApplication> = {}) =>
  ({
    getActiveAccount: vi.fn(() => null),
    getAllAccounts: vi.fn(() => []),
    setActiveAccount: vi.fn(),
    acquireTokenSilent: vi.fn(),
    loginRedirect: vi.fn(),
    logoutRedirect: vi.fn(),
    ...overrides,
  }) as unknown as IPublicClientApplication;

const setupMsalContext = (overrides: {
  instance?: IPublicClientApplication;
  accounts?: AccountInfo[];
  inProgress?: string;
  authReady?: boolean;
} = {}) => {
  const instance = overrides.instance ?? createMockMsalInstance();
  mockUseMsalContext.mockReturnValue({
    instance,
    accounts: overrides.accounts ?? [],
    inProgress: overrides.inProgress ?? 'none',
    authReady: overrides.authReady ?? true,
  } as ReturnType<typeof useMsalContext>);
  return instance;
};

// ── test lifecycle ─────────────────────────────────────────────────
describe('useAuth', () => {
  beforeEach(() => {
    mockIsE2e.mockReturnValue(false);
    mockSkipLogin.mockReturnValue(false);
    setupMsalContext();

    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => store.get(key) ?? null),
      setItem: vi.fn((key: string, val: string) => store.set(key, val)),
      removeItem: vi.fn((key: string) => store.delete(key)),
      clear: vi.fn(() => store.clear()),
      get length() { return store.size; },
      key: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ════════════════════════════════════════════════════════════════
  //  1. E2E Mock Mode
  // ════════════════════════════════════════════════════════════════

  describe('E2E mock mode', () => {
    beforeEach(() => {
      mockIsE2e.mockReturnValue(true);
    });

    it('returns isAuthenticated=true with E2E account', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.account).toEqual(mockCreateE2EAccount());
      expect(result.current.shouldSkipLogin).toBe(true);
      expect(result.current.tokenReady).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    it('acquireToken returns a mock token and persists it', async () => {
      const { result } = renderHook(() => useAuth());

      const token = await result.current.acquireToken('https://example.sharepoint.com');

      expect(token).toBe('mock-token:https://example.sharepoint.com/.default');
      expect(mockPersistToken).toHaveBeenCalledWith(
        'mock-token:https://example.sharepoint.com/.default',
      );
    });

    it('acquireToken strips trailing slashes from resource', async () => {
      const { result } = renderHook(() => useAuth());

      const token = await result.current.acquireToken('https://example.sharepoint.com///');

      expect(token).toBe('mock-token:https://example.sharepoint.com/.default');
    });

    it('signIn returns { success: false } (no-op in E2E)', async () => {
      const { result } = renderHook(() => useAuth());

      const signInResult = await result.current.signIn();

      expect(signInResult).toEqual({ success: false });
    });

    it('signOut resolves without error', async () => {
      const { result } = renderHook(() => useAuth());

      await expect(result.current.signOut()).resolves.toBeUndefined();
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  2. Skip Login Mode
  // ════════════════════════════════════════════════════════════════

  describe('skip login mode', () => {
    beforeEach(() => {
      mockSkipLogin.mockReturnValue(true);
    });

    it('returns isAuthenticated=true with null account', () => {
      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.account).toBeNull();
      expect(result.current.shouldSkipLogin).toBe(true);
      expect(result.current.tokenReady).toBe(true);
    });

    it('acquireToken returns null', async () => {
      const { result } = renderHook(() => useAuth());

      const token = await result.current.acquireToken();

      expect(token).toBeNull();
    });

    it('signIn returns { success: false } (no-op)', async () => {
      const { result } = renderHook(() => useAuth());

      const signInResult = await result.current.signIn();

      expect(signInResult).toEqual({ success: false });
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  3. Normal MSAL Mode – Authentication State
  // ════════════════════════════════════════════════════════════════

  describe('normal MSAL mode – auth state', () => {
    it('isAuthenticated=false when no accounts exist', () => {
      setupMsalContext({ accounts: [] });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.account).toBeNull();
    });

    it('isAuthenticated=true when account is active', () => {
      const account = makeAccount('logged-in@corp.com');
      const instance = createMockMsalInstance({
        getActiveAccount: vi.fn(() => account),
      });
      setupMsalContext({ instance, accounts: [account] });

      const { result } = renderHook(() => useAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.account).toBe(account);
    });

    it('picks first account when no active account is set', () => {
      const account = makeAccount('first@corp.com');
      setupMsalContext({ accounts: [account] });

      const { result } = renderHook(() => useAuth());

      // The hook falls back to accounts[0] for resolvedAccount
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.account).toBe(account);
    });

    it('tokenReady=true when authenticated and inProgress=none', () => {
      const account = makeAccount();
      const instance = createMockMsalInstance({
        getActiveAccount: vi.fn(() => account),
      });
      setupMsalContext({ instance, accounts: [account], inProgress: 'none' });

      const { result } = renderHook(() => useAuth());

      expect(result.current.tokenReady).toBe(true);
    });

    it('tokenReady=false when interaction is in progress', () => {
      const account = makeAccount();
      const instance = createMockMsalInstance({
        getActiveAccount: vi.fn(() => account),
      });
      setupMsalContext({ instance, accounts: [account], inProgress: 'login' });

      const { result } = renderHook(() => useAuth());

      expect(result.current.tokenReady).toBe(false);
    });

    it('loading=true when inProgress is not none', () => {
      setupMsalContext({ inProgress: 'acquireToken' });

      const { result } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(true);
    });

    it('loading=false when inProgress=none', () => {
      setupMsalContext({ inProgress: 'none' });

      const { result } = renderHook(() => useAuth());

      expect(result.current.loading).toBe(false);
    });

    it('shouldSkipLogin=false in normal mode', () => {
      setupMsalContext();

      const { result } = renderHook(() => useAuth());

      expect(result.current.shouldSkipLogin).toBe(false);
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  4. Token Acquisition
  // ════════════════════════════════════════════════════════════════

  describe('normal MSAL mode – token acquisition', () => {
    it('returns null when no account exists', async () => {
      const instance = createMockMsalInstance({
        getAllAccounts: vi.fn(() => []),
        getActiveAccount: vi.fn(() => null),
      });
      setupMsalContext({ instance, accounts: [] });

      const { result } = renderHook(() => useAuth());
      const token = await result.current.acquireToken();

      expect(token).toBeNull();
      expect(instance.acquireTokenSilent).not.toHaveBeenCalled();
    });

    it('acquires token silently and stores it in sessionStorage', async () => {
      const account = makeAccount();
      const instance = createMockMsalInstance({
        getActiveAccount: vi.fn(() => account),
        getAllAccounts: vi.fn(() => [account]),
        acquireTokenSilent: vi.fn().mockResolvedValue({
          accessToken: 'real-sp-token',
          expiresOn: new Date(Date.now() + 3600 * 1000), // 1 hour from now
        }),
      });
      setupMsalContext({ instance, accounts: [account] });

      const { result } = renderHook(() => useAuth());
      const token = await result.current.acquireToken();

      expect(token).toBe('real-sp-token');
      expect(instance.acquireTokenSilent).toHaveBeenCalledTimes(1);
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('spToken', 'real-sp-token');
    });

    it('uses GRAPH_SCOPES when resource matches GRAPH_RESOURCE', async () => {
      const account = makeAccount();
      const instance = createMockMsalInstance({
        getActiveAccount: vi.fn(() => account),
        getAllAccounts: vi.fn(() => [account]),
        acquireTokenSilent: vi.fn().mockResolvedValue({
          accessToken: 'graph-token',
          expiresOn: new Date(Date.now() + 3600 * 1000),
        }),
      });
      setupMsalContext({ instance, accounts: [account] });

      const { result } = renderHook(() => useAuth());
      await result.current.acquireToken('https://graph.microsoft.com');

      expect(vi.mocked(instance.acquireTokenSilent)).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: ['User.Read', 'GroupMember.Read.All'],
        }),
      );
    });

    it('builds {resource}/.default scopes for non-Graph resources', async () => {
      const account = makeAccount();
      const instance = createMockMsalInstance({
        getActiveAccount: vi.fn(() => account),
        getAllAccounts: vi.fn(() => [account]),
        acquireTokenSilent: vi.fn().mockResolvedValue({
          accessToken: 'sp-token',
          expiresOn: new Date(Date.now() + 3600 * 1000),
        }),
      });
      setupMsalContext({ instance, accounts: [account] });

      const { result } = renderHook(() => useAuth());
      await result.current.acquireToken('https://custom.sharepoint.com');

      expect(vi.mocked(instance.acquireTokenSilent)).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: ['https://custom.sharepoint.com/.default'],
        }),
      );
    });

    it('triggers soft refresh when token is near expiry', async () => {
      const account = makeAccount();
      const nearExpiry = new Date(Date.now() + 60 * 1000); // 60s left (< 300s threshold)
      const instance = createMockMsalInstance({
        getActiveAccount: vi.fn(() => account),
        getAllAccounts: vi.fn(() => [account]),
        acquireTokenSilent: vi.fn()
          .mockResolvedValueOnce({
            accessToken: 'near-expiry-token',
            expiresOn: nearExpiry,
          })
          .mockResolvedValueOnce({
            accessToken: 'refreshed-token',
            expiresOn: new Date(Date.now() + 3600 * 1000),
          }),
      });
      setupMsalContext({ instance, accounts: [account] });

      const { result } = renderHook(() => useAuth());
      const token = await result.current.acquireToken();

      // Should call acquireTokenSilent twice: initial + forceRefresh
      expect(instance.acquireTokenSilent).toHaveBeenCalledTimes(2);
      expect(vi.mocked(instance.acquireTokenSilent).mock.calls[1][0]).toEqual(
        expect.objectContaining({ forceRefresh: true }),
      );
      expect(token).toBe('refreshed-token');
    });

    it('does NOT trigger refresh when token has plenty of time', async () => {
      const account = makeAccount();
      const farExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour (>> 300s threshold)
      const instance = createMockMsalInstance({
        getActiveAccount: vi.fn(() => account),
        getAllAccounts: vi.fn(() => [account]),
        acquireTokenSilent: vi.fn().mockResolvedValue({
          accessToken: 'still-valid-token',
          expiresOn: farExpiry,
        }),
      });
      setupMsalContext({ instance, accounts: [account] });

      const { result } = renderHook(() => useAuth());
      const token = await result.current.acquireToken();

      expect(instance.acquireTokenSilent).toHaveBeenCalledTimes(1);
      expect(token).toBe('still-valid-token');
    });

    it('returns null and removes spToken on acquireTokenSilent failure', async () => {
      const account = makeAccount();
      const instance = createMockMsalInstance({
        getActiveAccount: vi.fn(() => account),
        getAllAccounts: vi.fn(() => [account]),
        acquireTokenSilent: vi.fn().mockRejectedValue(
          Object.assign(new Error('token_expired'), { errorCode: 'interaction_required' }),
        ),
      });
      setupMsalContext({ instance, accounts: [account] });
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useAuth());
      const token = await result.current.acquireToken();

      expect(token).toBeNull();
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('spToken');
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  5. Sign-In Flow
  // ════════════════════════════════════════════════════════════════

  describe('normal MSAL mode – signIn', () => {
    it('calls loginRedirect with LOGIN_SCOPES', async () => {
      const instance = createMockMsalInstance({
        loginRedirect: vi.fn().mockResolvedValue(undefined),
      });
      setupMsalContext({ instance });

      const { result } = renderHook(() => useAuth());

      await act(async () => {
        await result.current.signIn();
      });

      expect(instance.loginRedirect).toHaveBeenCalledWith(
        expect.objectContaining({
          scopes: expect.arrayContaining(['openid', 'profile']),
          prompt: 'select_account',
        }),
      );
    });

    it('returns { success: false } when interaction is in progress', async () => {
      setupMsalContext({ inProgress: 'login' });

      const { result } = renderHook(() => useAuth());
      const signInResult = await result.current.signIn();

      expect(signInResult).toEqual({ success: false });
    });

    it('returns { success: false } when loginRedirect throws', async () => {
      const instance = createMockMsalInstance({
        loginRedirect: vi.fn().mockRejectedValue(
          Object.assign(new Error('popup_closed'), { errorCode: 'user_cancelled' }),
        ),
      });
      setupMsalContext({ instance });

      const { result } = renderHook(() => useAuth());
      const signInResult = await act(async () => result.current.signIn());

      expect(signInResult).toEqual({ success: false });
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  6. Sign-Out
  // ════════════════════════════════════════════════════════════════

  describe('normal MSAL mode – signOut', () => {
    it('calls logoutRedirect', async () => {
      const instance = createMockMsalInstance({
        logoutRedirect: vi.fn().mockResolvedValue(undefined),
      });
      setupMsalContext({ instance });

      const { result } = renderHook(() => useAuth());
      await result.current.signOut();

      expect(instance.logoutRedirect).toHaveBeenCalledTimes(1);
    });
  });

  // ════════════════════════════════════════════════════════════════
  //  7. List Ready State (shared sessionStorage state)
  // ════════════════════════════════════════════════════════════════

  describe('listReadyState helpers', () => {
    it('getListReadyState returns null initially', () => {
      setupMsalContext();
      const { result } = renderHook(() => useAuth());

      expect(result.current.getListReadyState()).toBeNull();
    });

    it('setListReadyState persists true/false to sessionStorage', () => {
      setupMsalContext();
      const { result } = renderHook(() => useAuth());

      act(() => { result.current.setListReadyState(true); });
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('__listReady', 'true');

      act(() => { result.current.setListReadyState(false); });
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('__listReady', 'false');
    });

    it('setListReadyState(null) removes the key', () => {
      setupMsalContext();
      const { result } = renderHook(() => useAuth());

      act(() => { result.current.setListReadyState(null); });
      expect(window.sessionStorage.removeItem).toHaveBeenCalledWith('__listReady');
    });

    it('getListReadyState reads stored boolean values', () => {
      const store = new Map<string, string>();
      store.set('__listReady', 'true');
      vi.stubGlobal('sessionStorage', {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        get length() { return store.size; },
        key: vi.fn(),
      });

      setupMsalContext();
      const { result } = renderHook(() => useAuth());

      expect(result.current.getListReadyState()).toBe(true);
    });
  });
});

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuthConfig = {
  VITE_AUDIT_DEBUG?: string;
  VITE_MSAL_TOKEN_REFRESH_MIN?: string;
  VITE_SP_RESOURCE?: string;
  VITE_MSAL_CLIENT_ID?: string;
  VITE_MSAL_TENANT_ID?: string;
};

const mockGetAppConfig = vi.fn<() => AuthConfig>();
const mockIsE2eMsalMockEnabled = vi.fn<() => boolean>();
const mockCreateE2EMsalAccount = vi.fn();
const mockPersistMsalToken = vi.fn();
const mockUseMsalContext = vi.fn();

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    getAppConfig: () => mockGetAppConfig(),
    isE2eMsalMockEnabled: () => mockIsE2eMsalMockEnabled(),
    shouldSkipLogin: () => false,
  };
});

vi.mock('@/lib/msal', () => ({
  createE2EMsalAccount: () => mockCreateE2EMsalAccount(),
  persistMsalToken: (token: string) => mockPersistMsalToken(token),
}));

const baseConfig: AuthConfig = {
  VITE_AUDIT_DEBUG: '0',
  VITE_MSAL_TOKEN_REFRESH_MIN: '300',
  VITE_SP_RESOURCE: 'https://contoso.sharepoint.com',
  VITE_MSAL_CLIENT_ID: 'client',
  VITE_MSAL_TENANT_ID: 'tenant',
};

const createDefaultMsalContext = () => {
  const accounts: Array<Record<string, unknown>> = [];
  return {
    accounts,
    inProgress: 'none' as const,
    instance: {
      acquireTokenSilent: vi.fn(),
      acquireTokenRedirect: vi.fn(),
      loginRedirect: vi.fn(),
      logoutRedirect: vi.fn(),
      getActiveAccount: vi.fn(() => accounts[0] ?? null),
      getAllAccounts: vi.fn(() => accounts),
      setActiveAccount: vi.fn(),
    },
  };
};

type ViMock = ReturnType<typeof vi.fn>;

const configureMsalContextMock = async () => {
  const msalProvider = await import('@/auth/MsalProvider');
  const contextMocks = (msalProvider as { __msalContextMock?: { useMsalContext: ViMock } }).__msalContextMock;
  if (!contextMocks) {
    throw new Error('Expected MSAL context mock to be available');
  }

  contextMocks.useMsalContext.mockReset();
  contextMocks.useMsalContext.mockImplementation(() => mockUseMsalContext());
};

const importHook = async () => {
  vi.resetModules();
  await configureMsalContextMock();
  const module = await import('@/auth/useAuth');
  return module.useAuth;
};

beforeEach(() => {
  mockGetAppConfig.mockReset();
  mockIsE2eMsalMockEnabled.mockReset();
  mockCreateE2EMsalAccount.mockReset();
  mockPersistMsalToken.mockReset();
  mockUseMsalContext.mockReset();
  mockGetAppConfig.mockReturnValue(baseConfig);
  mockIsE2eMsalMockEnabled.mockReturnValue(false);
  mockUseMsalContext.mockReturnValue(createDefaultMsalContext());
  sessionStorage.clear();
  delete (globalThis as { __TOKEN_METRICS__?: unknown }).__TOKEN_METRICS__;
});

describe('useAuth hook', () => {
  it('returns mock account when E2E msal mock is enabled', async () => {
    mockIsE2eMsalMockEnabled.mockReturnValue(true);
    const mockAccount = { username: 'mock-user' };
    mockCreateE2EMsalAccount.mockReturnValue(mockAccount);

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.account).toEqual(mockAccount);

    let token: string | null = null;
    await act(async () => {
      token = await result.current.acquireToken('https://resource.example.com');
    });

    expect(token).toBe('mock-token:https://resource.example.com/.default');
    expect(mockPersistMsalToken).toHaveBeenCalledWith(
      'mock-token:https://resource.example.com/.default'
    );
    // E2E mock mode: signIn returns { success: false }, signOut returns undefined (no-ops)
    await expect(result.current.signIn()).resolves.toEqual({ success: false });
    await expect(result.current.signOut()).resolves.toBeUndefined();
  });

  it('refreshes token when remaining lifetime is below threshold', async () => {
    const accounts = [{ homeAccountId: '1' }];
    mockUseMsalContext.mockReturnValue({
      accounts,
      inProgress: 'none' as const,
      instance: {
        acquireTokenSilent: vi
          .fn()
          .mockResolvedValueOnce({
            accessToken: 'initial-token',
            expiresOn: new Date(Date.now() + 90_000),
          })
          .mockResolvedValueOnce({ accessToken: 'refreshed-token' }),
        acquireTokenRedirect: vi.fn(),
        loginRedirect: vi.fn(),
        logoutRedirect: vi.fn(),
        getActiveAccount: vi.fn(() => accounts[0]),
        getAllAccounts: vi.fn(() => accounts),
        setActiveAccount: vi.fn(),
      },
    });

    mockGetAppConfig.mockReturnValue({
      ...baseConfig,
      VITE_AUDIT_DEBUG: 'true',
      VITE_MSAL_TOKEN_REFRESH_MIN: '300',
    });

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    let token: string | null = null;
    await act(async () => {
      token = await result.current.acquireToken('https://resource.example.com');
    });

    expect(token).toBe('refreshed-token');
    expect(sessionStorage.getItem('spToken')).toBe('refreshed-token');
  const instance = mockUseMsalContext.mock.results.at(-1)?.value.instance;
    expect(instance.acquireTokenSilent).toHaveBeenCalledTimes(2);
    expect(instance.acquireTokenSilent).toHaveBeenNthCalledWith(1, {
      scopes: ['https://resource.example.com/.default'],
      account: { homeAccountId: '1' },
      forceRefresh: false,
    });
    expect(instance.acquireTokenSilent).toHaveBeenNthCalledWith(2, {
      scopes: ['https://resource.example.com/.default'],
      account: { homeAccountId: '1' },
      forceRefresh: true,
    });
    expect((globalThis as { __TOKEN_METRICS__?: unknown }).__TOKEN_METRICS__).toMatchObject({
      acquireCount: 2,
      refreshCount: 1,
    });
  });

  it('returns cached token when refresh is not required', async () => {
    const acquireTokenSilent = vi
      .fn()
      .mockResolvedValue({ accessToken: 'cached', expiresOn: new Date(Date.now() + 600_000) });

    const accounts = [{ id: 'cached-account' }];
    mockUseMsalContext.mockReturnValue({
      accounts,
      inProgress: 'none' as const,
      instance: {
        acquireTokenSilent,
        acquireTokenRedirect: vi.fn(),
        loginRedirect: vi.fn(),
        logoutRedirect: vi.fn(),
        getActiveAccount: vi.fn(() => accounts[0]),
        getAllAccounts: vi.fn(() => accounts),
        setActiveAccount: vi.fn(),
      },
    });

    mockGetAppConfig.mockReturnValue({
      ...baseConfig,
      VITE_AUDIT_DEBUG: '0',
      VITE_MSAL_TOKEN_REFRESH_MIN: '120',
    });

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    let token: string | null = null;
    await act(async () => {
      token = await result.current.acquireToken('https://resource.example.com');
    });

    expect(token).toBe('cached');
    expect(sessionStorage.getItem('spToken')).toBe('cached');
    expect(acquireTokenSilent).toHaveBeenCalledTimes(1);
  });

  it('handles missing expiration gracefully', async () => {
    const acquireTokenSilent = vi.fn().mockResolvedValue({ accessToken: 'no-exp' });

    const accounts = [{ id: 'no-exp' }];
    mockUseMsalContext.mockReturnValue({
      accounts,
      inProgress: 'none' as const,
      instance: {
        acquireTokenSilent,
        acquireTokenRedirect: vi.fn(),
        loginRedirect: vi.fn(),
        logoutRedirect: vi.fn(),
        getActiveAccount: vi.fn(() => accounts[0]),
        getAllAccounts: vi.fn(() => accounts),
        setActiveAccount: vi.fn(),
      },
    });

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    let token: string | null = null;
    await act(async () => {
      token = await result.current.acquireToken('https://resource.example.com');
    });

    expect(token).toBe('no-exp');
    expect(sessionStorage.getItem('spToken')).toBe('no-exp');
    expect(acquireTokenSilent).toHaveBeenCalledTimes(1);
  });

  it('records metrics in debug mode even without refresh', async () => {
    const acquireTokenSilent = vi
      .fn()
      .mockResolvedValue({
        accessToken: 'long-lived',
        expiresOn: new Date(Date.now() + 3_600_000),
      });
    const accounts = [{ id: 'stable' }];
    mockUseMsalContext.mockReturnValue({
      accounts,
      inProgress: 'none' as const,
      instance: {
        acquireTokenSilent,
        acquireTokenRedirect: vi.fn(),
        loginRedirect: vi.fn(),
        logoutRedirect: vi.fn(),
        getActiveAccount: vi.fn(() => accounts[0]),
        getAllAccounts: vi.fn(() => accounts),
        setActiveAccount: vi.fn(),
      },
    });

    mockGetAppConfig.mockReturnValue({
      ...baseConfig,
      VITE_AUDIT_DEBUG: 'true',
      VITE_MSAL_TOKEN_REFRESH_MIN: '300',
    });

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.acquireToken('https://resource.example.com');
    });

    const metrics = (globalThis as { __TOKEN_METRICS__?: unknown }).__TOKEN_METRICS__ as
      | { acquireCount: number; refreshCount: number }
      | undefined;
    expect(metrics).toMatchObject({ acquireCount: 1, refreshCount: 0 });
    expect(sessionStorage.getItem('spToken')).toBe('long-lived');
    expect(acquireTokenSilent).toHaveBeenCalledTimes(1);
  });

  it('redirects when silent acquisition fails', async () => {
    const acquireTokenSilent = vi.fn().mockRejectedValue(new Error('silent-failure'));
    const acquireTokenRedirect = vi.fn().mockResolvedValue(undefined);

    const accounts = [{ id: 'broken-account' }];
    mockUseMsalContext.mockReturnValue({
      accounts,
      inProgress: 'none' as const,
      instance: {
        acquireTokenSilent,
        acquireTokenRedirect,
        loginRedirect: vi.fn(),
        logoutRedirect: vi.fn(),
        getActiveAccount: vi.fn(() => accounts[0]),
        getAllAccounts: vi.fn(() => accounts),
        setActiveAccount: vi.fn(),
      },
    });

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    let token: string | null = 'default';
    await act(async () => {
      token = await result.current.acquireToken('https://resource.example.com');
    });

    expect(token).toBeNull();
    expect(sessionStorage.getItem('spToken')).toBeNull();
    expect(acquireTokenRedirect).toHaveBeenCalledWith(
      expect.objectContaining({
        scopes: ['https://resource.example.com/.default'],
      })
    );
  });

  it('returns unauthenticated state when no accounts are present', async () => {
    const accounts: unknown[] = [];
    mockUseMsalContext.mockReturnValue({
      accounts,
      inProgress: 'none' as const,
      instance: {
        acquireTokenSilent: vi.fn(),
        acquireTokenRedirect: vi.fn(),
        loginRedirect: vi.fn(),
        logoutRedirect: vi.fn(),
        getActiveAccount: vi.fn(() => accounts[0] ?? null),
        getAllAccounts: vi.fn(() => accounts),
        setActiveAccount: vi.fn(),
      },
    });

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);

    let token: string | null = 'default';
    await act(async () => {
      token = await result.current.acquireToken('https://resource.example.com');
    });

    expect(token).toBeNull();
  });
});

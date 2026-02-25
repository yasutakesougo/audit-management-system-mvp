import { resetParsedEnvForTests } from '@/lib/env.schema';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateE2EMsalAccount = vi.fn();
const mockPersistMsalToken = vi.fn();
vi.mock('@/lib/msal', () => ({
  createE2EMsalAccount: () => mockCreateE2EMsalAccount(),
  persistMsalToken: (token: string) => {
    mockPersistMsalToken(token);
    try { sessionStorage.setItem('spToken', token); } catch { /* ignore */ }
  },
}));

const mockUseMsalContext = vi.fn();
vi.mock('@/auth/MsalProvider', () => ({
  useMsalContext: () => mockUseMsalContext(),
}));

const importHook = async () => {
  vi.resetModules();
  resetParsedEnvForTests();
  const module = await import('@/auth/useAuth');
  return module.useAuth;
};

// Formally correct dummy GUIDs to satisfy msalEnv.ts validation
const DUMMY_CLIENT_ID = '00000000-0000-0000-0000-000000000000';
const DUMMY_TENANT_ID = '00000000-0000-0000-0000-000000000000';

const stubBaseEnv = () => {
  vi.stubEnv('VITE_MSAL_CLIENT_ID', DUMMY_CLIENT_ID);
  vi.stubEnv('VITE_MSAL_TENANT_ID', DUMMY_TENANT_ID);
  vi.stubEnv('VITE_SP_RESOURCE', 'https://contoso.sharepoint.com');
  vi.stubEnv('VITE_SP_SITE_RELATIVE', '/sites/audit');
  vi.stubEnv('VITE_MSAL_TOKEN_REFRESH_MIN', '300');
  vi.stubEnv('VITE_AUDIT_DEBUG', '0');
  resetParsedEnvForTests();
};

beforeEach(() => {
  if (typeof localStorage !== 'undefined' && localStorage.clear) {
    localStorage.clear();
  }
  vi.restoreAllMocks();
  vi.unstubAllEnvs(); // Clear environment pollution
  resetParsedEnvForTests();
  mockCreateE2EMsalAccount.mockReset();
  mockPersistMsalToken.mockReset();
  mockUseMsalContext.mockReset();
  sessionStorage.clear();
  delete (globalThis as any).__TOKEN_METRICS__;
  stubBaseEnv();
});

describe('useAuth hook', () => {
  it('returns mock account when E2E msal mock is enabled', async () => {
    vi.stubEnv('VITE_MSAL_MOCK', 'true');
    sessionStorage.setItem('__E2E_MOCK_AUTH__', '1');
    const mockAccount = { username: 'mock-user' };
    mockCreateE2EMsalAccount.mockReturnValue(mockAccount);

    mockUseMsalContext.mockReturnValue({
      accounts: [],
      inProgress: 'none',
      instance: {
        acquireTokenSilent: vi.fn(),
        getActiveAccount: vi.fn(),
      }
    });

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.account).toEqual(mockAccount);

    let token: string | null = null;
    await act(async () => {
      token = await result.current.acquireToken('https://resource.example.com');
    });
    expect(token).toBe(`mock-token:https://resource.example.com/.default`);
  });

  it('refreshes token when remaining lifetime is below threshold', async () => {
    vi.stubEnv('VITE_MSAL_MOCK', 'false');
    vi.stubEnv('VITE_E2E_MSAL_MOCK', 'false');

    const accounts = [{ homeAccountId: '1' }];
    const acquireTokenSilent = vi
      .fn()
      .mockResolvedValueOnce({
        accessToken: 'initial-token',
        expiresOn: new Date(Date.now() + 90_000),
      })
      .mockResolvedValueOnce({ accessToken: 'refreshed-token' });

    mockUseMsalContext.mockReturnValue({
      accounts,
      inProgress: 'none',
      instance: {
        acquireTokenSilent,
        getActiveAccount: vi.fn(() => accounts[0]),
        getAllAccounts: vi.fn(() => accounts),
        setActiveAccount: vi.fn(),
      },
    });

    vi.stubEnv('VITE_AUDIT_DEBUG', 'true');
    vi.stubEnv('VITE_MSAL_TOKEN_REFRESH_MIN', '300');

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.acquireToken('https://resource.example.com');
    });

    expect(sessionStorage.getItem('spToken')).toBe('refreshed-token');
    const metrics = (globalThis as any).__TOKEN_METRICS__;
    expect(metrics).toMatchObject({ acquireCount: 1, refreshCount: 1 });
  });

  it('returns cached token when refresh is not required', async () => {
    vi.stubEnv('VITE_MSAL_MOCK', 'false');
    vi.stubEnv('VITE_E2E_MSAL_MOCK', 'false');

    const acquireTokenSilent = vi
      .fn()
      .mockResolvedValue({ accessToken: 'cached', expiresOn: new Date(Date.now() + 600_000) });

    const accounts = [{ id: 'cached-account' }];
    mockUseMsalContext.mockReturnValue({
      accounts,
      inProgress: 'none',
      instance: {
        acquireTokenSilent,
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

    expect(token).toBe('cached');
    expect(acquireTokenSilent).toHaveBeenCalledTimes(1);
  });

  it('records metrics in debug mode even without refresh', async () => {
    vi.stubEnv('VITE_MSAL_MOCK', 'false');
    vi.stubEnv('VITE_E2E_MSAL_MOCK', 'false');

    const accounts = [{ id: 'stable' }];
    const acquireTokenSilent = vi.fn().mockResolvedValue({
      accessToken: 'long-lived',
      expiresOn: new Date(Date.now() + 3_600_000),
    });

    mockUseMsalContext.mockReturnValue({
      accounts,
      inProgress: 'none',
      instance: {
        acquireTokenSilent,
        getActiveAccount: vi.fn(() => accounts[0]),
        getAllAccounts: vi.fn(() => accounts),
        setActiveAccount: vi.fn(),
      },
    });

    vi.stubEnv('VITE_AUDIT_DEBUG', 'true');

    const useAuth = await importHook();
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.acquireToken('https://resource.example.com');
    });

    const metrics = (globalThis as any).__TOKEN_METRICS__;
    expect(metrics).toMatchObject({ acquireCount: 1, refreshCount: 0 });
  });

  it('returns null when silent acquisition fails', async () => {
    vi.stubEnv('VITE_MSAL_MOCK', 'false');
    vi.stubEnv('VITE_E2E_MSAL_MOCK', 'false');

    mockUseMsalContext.mockReturnValue({
      accounts: [{ id: 'broken' }],
      inProgress: 'none',
      instance: {
        acquireTokenSilent: vi.fn().mockRejectedValue(new Error('fail')),
        getActiveAccount: vi.fn(() => ({ id: 'broken' })),
        getAllAccounts: vi.fn(() => [{ id: 'broken' }]),
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
  });
});

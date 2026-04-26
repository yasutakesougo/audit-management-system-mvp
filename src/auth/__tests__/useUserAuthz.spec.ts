import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── module mocks (before imports) ───────────────────────────────────
// useAuth provides { acquireToken, account }
vi.mock('@/auth/useAuth', () => ({
  useAuth: vi.fn(() => ({
    acquireToken: vi.fn(() => Promise.resolve('mock-token')),
    account: null,
  })),
}));

vi.mock('@/auth/useAuthReady', () => ({
  useAuthReady: vi.fn(() => true),
}));

// fetchMyGroupIds returns group IDs from graph
vi.mock('@/auth/fetchMyGroupIds', () => ({
  fetchMyGroupIds: vi.fn(() => Promise.resolve([])),
}));

// env helpers: by default, not E2E and not skipLogin
vi.mock('@/lib/env', () => ({
  isE2eMsalMockEnabled: vi.fn(() => false),
  shouldSkipLogin: vi.fn(() => false),
  readOptionalEnv: vi.fn(() => undefined),
  getAppConfig: vi.fn(() => ({ isDev: true })),
}));

vi.mock('@/env', () => ({
  getRuntimeEnv: vi.fn((): Record<string, unknown> => ({})),
  isDev: true,
}));

vi.mock('@/auth/msalConfig', () => ({
  GRAPH_RESOURCE: 'https://graph.microsoft.com',
}));

import { fetchMyGroupIds } from '@/auth/fetchMyGroupIds';
import { useAuth } from '@/auth/useAuth';
import { useAuthReady } from '@/auth/useAuthReady';
import { getRuntimeEnv } from '@/env';
import { isE2eMsalMockEnabled, readOptionalEnv, shouldSkipLogin } from '@/lib/env';
import { useUserAuthz } from '../useUserAuthz';

// ── helpers ────────────────────────────────────────────────────────
const mockUseAuth = vi.mocked(useAuth);
const mockFetchGroupIds = vi.mocked(fetchMyGroupIds);
const mockUseAuthReady = vi.mocked(useAuthReady);
const mockIsE2e = vi.mocked(isE2eMsalMockEnabled);
const mockSkipLogin = vi.mocked(shouldSkipLogin);
const mockReadOptionalEnv = vi.mocked(readOptionalEnv);
const mockGetRuntimeEnv = vi.mocked(getRuntimeEnv);

type PartialAccount = { username: string };
const mockAccount = (username: string): PartialAccount => ({ username });

const setRuntimeEnv = (envMap: Record<string, string>) => {
  mockGetRuntimeEnv.mockReturnValue(envMap);
};

const setupAuth = (overrides: Partial<ReturnType<typeof useAuth>> = {}) => {
  mockUseAuth.mockReturnValue({
    acquireToken: vi.fn(() => Promise.resolve('mock-token')),
    account: null,
    isAuthenticated: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    loading: false,
    shouldSkipLogin: false,
    tokenReady: false,
    getListReadyState: vi.fn(() => null),
    setListReadyState: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>);
};

// ── lifecycle ──────────────────────────────────────────────────────
describe('useUserAuthz', () => {
  beforeEach(() => {
    mockUseAuthReady.mockReturnValue(true);
    // Default: not E2E, not skip login
    mockIsE2e.mockReturnValue(false);
    mockSkipLogin.mockReturnValue(false);
    mockReadOptionalEnv.mockReturnValue(undefined);
    mockGetRuntimeEnv.mockReturnValue({});
    mockFetchGroupIds.mockResolvedValue([]);
    setupAuth();

    // provide sessionStorage stub
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

  // ── E2E / skip-login fast paths ──────────────────────────────────

  describe('E2E / skip-login mode', () => {
    it('returns admin role immediately when E2E mock is enabled', async () => {
      mockIsE2e.mockReturnValue(true);
      setupAuth({ account: mockAccount('e2e@test.com') });

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('admin');
      expect(result.current.reason).toBe('demo-default-full-access');
    });

    it('returns admin role when shouldSkipLogin is true', async () => {
      mockSkipLogin.mockReturnValue(true);
      setupAuth();

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('admin');
    });

    it('honors VITE_TEST_ROLE override in E2E mode', async () => {
      mockSkipLogin.mockReturnValue(true);
      setRuntimeEnv({ VITE_TEST_ROLE: 'reception' });
      setupAuth();

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('reception');
    });

    it('ignores invalid VITE_TEST_ROLE values', async () => {
      mockSkipLogin.mockReturnValue(true);
      setRuntimeEnv({ VITE_TEST_ROLE: 'superuser' });
      setupAuth();

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      // Invalid role → falls back to admin in skip-login mode
      expect(result.current.role).toBe('admin');
    });
  });

  // ── group-based role resolution ──────────────────────────────────

  describe('group-based role resolution', () => {
    const ADMIN_GROUP = 'admin-group-id-123';
    const RECEPTION_GROUP = 'reception-group-id-456';

    it('resolves admin role when user belongs to admin group', async () => {
      setRuntimeEnv({
        VITE_AAD_ADMIN_GROUP_ID: ADMIN_GROUP,
        VITE_AAD_RECEPTION_GROUP_ID: RECEPTION_GROUP,
      });
      mockFetchGroupIds.mockResolvedValue([ADMIN_GROUP, RECEPTION_GROUP]);
      setupAuth({
        account: mockAccount('admin@corp.com'),
      });

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('admin');
    });

    it('resolves reception role when user only belongs to reception group', async () => {
      setRuntimeEnv({
        VITE_AAD_ADMIN_GROUP_ID: ADMIN_GROUP,
        VITE_AAD_RECEPTION_GROUP_ID: RECEPTION_GROUP,
      });
      mockFetchGroupIds.mockResolvedValue([RECEPTION_GROUP]);
      setupAuth({
        account: mockAccount('staff@corp.com'),
      });

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('reception');
    });

    it('resolves viewer role when user belongs to no configured groups', async () => {
      setRuntimeEnv({
        VITE_AAD_ADMIN_GROUP_ID: ADMIN_GROUP,
        VITE_AAD_RECEPTION_GROUP_ID: RECEPTION_GROUP,
      });
      mockFetchGroupIds.mockResolvedValue(['unrelated-group-id']);
      setupAuth({
        account: mockAccount('visitor@corp.com'),
      });

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('viewer');
    });

    it('admin takes priority over reception in role hierarchy', async () => {
      setRuntimeEnv({
        VITE_AAD_ADMIN_GROUP_ID: ADMIN_GROUP,
        VITE_AAD_RECEPTION_GROUP_ID: RECEPTION_GROUP,
      });
      // User belongs to both groups
      mockFetchGroupIds.mockResolvedValue([RECEPTION_GROUP, ADMIN_GROUP]);
      setupAuth({
        account: mockAccount('senior@corp.com'),
      });

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      // admin > reception in the hierarchy
      expect(result.current.role).toBe('admin');
    });

    it('re-fetches group membership when auth readiness transitions false -> true', async () => {
      const ADMIN_GROUP = 'admin-group-id-transition';
      setRuntimeEnv({
        VITE_AAD_ADMIN_GROUP_ID: ADMIN_GROUP,
      });
      setupAuth({
        account: mockAccount('transition@corp.com'),
      });
      mockFetchGroupIds.mockResolvedValue([ADMIN_GROUP]);

      let isReady = false;
      mockUseAuthReady.mockImplementation(() => isReady);

      const { result, rerender } = renderHook(() => useUserAuthz());

      expect(mockFetchGroupIds).not.toHaveBeenCalled();
      expect(result.current.role).toBe('viewer');
      expect(result.current.ready).toBe(false);

      isReady = true;
      rerender();

      await waitFor(() => {
        expect(mockFetchGroupIds).toHaveBeenCalledTimes(1);
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('admin');
    });
  });

  // ── missing admin group ID ───────────────────────────────────────

  describe('missing admin group ID', () => {
    it('grants admin in dev/demo mode when admin group ID is missing', async () => {
      // No group IDs configured + dev mode → convenience admin
      setRuntimeEnv({});
      setupAuth();

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('admin');
      expect(result.current.reason).toBe('demo-default-full-access');
    });
  });

  // ── error fallback ───────────────────────────────────────────────

  describe('error handling', () => {
    it('falls back to viewer on fetchMyGroupIds failure', async () => {
      setRuntimeEnv({
        VITE_AAD_ADMIN_GROUP_ID: 'admin-grp',
      });
      mockFetchGroupIds.mockRejectedValue(new Error('Graph API error'));
      setupAuth({
        account: mockAccount('unlucky@corp.com'),
      });

      const { result } = renderHook(() => useUserAuthz());

      // Error path sets role to viewer
      await waitFor(() => {
        expect(result.current.role).toBe('viewer');
        expect(result.current.ready).toBe(true);
      });
    });

    it('uses idTokenClaims.groups when Graph fetch fails', async () => {
      const adminGroupId = 'admin-grp-claim';
      setRuntimeEnv({
        VITE_AAD_ADMIN_GROUP_ID: adminGroupId,
      });
      mockFetchGroupIds.mockRejectedValue(new Error('Graph API error'));
      setupAuth({
        account: {
          username: 'claim-admin@corp.com',
          idTokenClaims: {
            groups: [adminGroupId],
          },
        } as unknown as ReturnType<typeof useAuth>['account'],
      });

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('admin');
    });
  });

  // ── sessionStorage caching ───────────────────────────────────────

  describe('sessionStorage caching', () => {
    const ADMIN_GROUP = 'cached-admin-group';

    it('writes group IDs to sessionStorage after successful fetch', async () => {
      setRuntimeEnv({ VITE_AAD_ADMIN_GROUP_ID: ADMIN_GROUP });
      mockFetchGroupIds.mockResolvedValue([ADMIN_GROUP]);
      setupAuth({
        account: mockAccount('cache-test@corp.com'),
      });

      renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(window.sessionStorage.setItem).toHaveBeenCalled();
      });

      const calls = vi.mocked(window.sessionStorage.setItem).mock.calls;
      const cacheCall = calls.find(([key]) => key.startsWith('authz.memberOf'));
      expect(cacheCall).toBeDefined();
      if (cacheCall) {
        const payload = JSON.parse(cacheCall[1]);
        expect(payload.ids).toEqual([ADMIN_GROUP]);
        expect(payload.ts).toBeTypeOf('number');
      }
    });

    it('reads from sessionStorage cache when entry is fresh', async () => {
      const upn = 'cached-user@corp.com';
      const cacheKey = `authz.memberOf.v1:${upn}`;
      const freshPayload = JSON.stringify({
        ts: Date.now(),
        ids: [ADMIN_GROUP],
      });

      // Pre-populate the cache
      const store = new Map<string, string>();
      store.set(cacheKey, freshPayload);
      vi.stubGlobal('sessionStorage', {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        get length() { return store.size; },
        key: vi.fn(),
      });

      setRuntimeEnv({ VITE_AAD_ADMIN_GROUP_ID: ADMIN_GROUP });
      setupAuth({
        account: mockAccount(upn),
      });

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });

      // Should NOT have called fetchMyGroupIds since cache was used
      expect(mockFetchGroupIds).not.toHaveBeenCalled();
      expect(result.current.role).toBe('admin');
    });

    it('ignores expired cache and fetches fresh data', async () => {
      const upn = 'expired@corp.com';
      const cacheKey = `authz.memberOf.v1:${upn}`;
      const expiredPayload = JSON.stringify({
        ts: Date.now() - 11 * 60 * 1000, // 11 min ago (TTL is 10 min)
        ids: [ADMIN_GROUP],
      });

      const store = new Map<string, string>();
      store.set(cacheKey, expiredPayload);
      vi.stubGlobal('sessionStorage', {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        get length() { return store.size; },
        key: vi.fn(),
      });

      setRuntimeEnv({ VITE_AAD_ADMIN_GROUP_ID: ADMIN_GROUP });
      mockFetchGroupIds.mockResolvedValue([ADMIN_GROUP]);
      setupAuth({
        account: mockAccount(upn),
      });

      renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(mockFetchGroupIds).toHaveBeenCalled();
      });
    });
  });

  // ── env var fallback chains ──────────────────────────────────────

  describe('env var fallback chains', () => {
    it('prefers VITE_RECEPTION_GROUP_ID over stale VITE_AAD_RECEPTION_GROUP_ID when both exist', async () => {
      setRuntimeEnv({
        VITE_ADMIN_GROUP_ID: 'admin-grp',
        VITE_RECEPTION_GROUP_ID: 'runtime-reception-grp',
        VITE_AAD_RECEPTION_GROUP_ID: 'stale-build-reception-grp',
      });
      mockFetchGroupIds.mockResolvedValue(['runtime-reception-grp']);
      setupAuth({
        account: mockAccount('agent@corp.com'),
      });

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('reception');
    });

    it('reads admin group ID from VITE_ADMIN_GROUP_ID when AAD variant is missing', async () => {
      setRuntimeEnv({ VITE_ADMIN_GROUP_ID: 'fallback-admin-grp' });
      mockFetchGroupIds.mockResolvedValue(['fallback-admin-grp']);
      setupAuth({
        account: mockAccount('fallback@corp.com'),
      });

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('admin');
    });

    it('reads reception group ID from VITE_RECEPTION_GROUP_ID fallback', async () => {
      setRuntimeEnv({
        VITE_ADMIN_GROUP_ID: 'admin-grp',
        VITE_RECEPTION_GROUP_ID: 'reception-grp',
      });
      mockFetchGroupIds.mockResolvedValue(['reception-grp']);
      setupAuth({
        account: mockAccount('agent@corp.com'),
      });

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('reception');
    });

    it('falls back to readOptionalEnv when runtime env has no group ID', async () => {
      setRuntimeEnv({});
      mockReadOptionalEnv.mockImplementation((k: string) => {
        if (k === 'VITE_AAD_ADMIN_GROUP_ID') return 'optional-admin-grp';
        return undefined;
      });
      mockFetchGroupIds.mockResolvedValue(['optional-admin-grp']);
      setupAuth({
        account: mockAccount('optional@corp.com'),
      });

      const { result } = renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(result.current.ready).toBe(true);
      });
      expect(result.current.role).toBe('admin');
    });
  });

  // ── UPN normalization ────────────────────────────────────────────

  describe('UPN normalization', () => {
    it('normalizes UPN to lowercase for cache key', async () => {
      const ADMIN_GROUP = 'admin-grp-norm';
      setRuntimeEnv({ VITE_AAD_ADMIN_GROUP_ID: ADMIN_GROUP });
      mockFetchGroupIds.mockResolvedValue([ADMIN_GROUP]);
      setupAuth({
        account: mockAccount('  User@CORP.COM  '),
      });

      renderHook(() => useUserAuthz());

      await waitFor(() => {
        expect(window.sessionStorage.setItem).toHaveBeenCalled();
      });

      const calls = vi.mocked(window.sessionStorage.setItem).mock.calls;
      const cacheCall = calls.find(([key]) => key.startsWith('authz.memberOf'));
      expect(cacheCall).toBeDefined();
      if (cacheCall) {
        // Cache key should use normalized (trimmed + lowercased) UPN
        expect(cacheCall[0]).toBe('authz.memberOf.v1:user@corp.com');
      }
    });
  });
});

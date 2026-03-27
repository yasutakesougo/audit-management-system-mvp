/**
 * ProtectedRoute — Auth Guard Contract Tests
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║ IMPORTANT: Vitest 環境での guard bypass について                       ║
 * ║                                                                    ║
 * ║ Vitest ランタイムでは process.env.VITEST が常に '1' になります。        ║
 * ║ ProtectedRoute 内部で呼ばれる getAuthGuardState() →                  ║
 * ║ isAutomationRuntime() がこれを検出し shouldBypass=true を返します。     ║
 * ║                                                                    ║
 * ║ つまり guardResolution をモックしないと、全テストが bypass パスを        ║
 * ║ 通ってしまい、auth UI (loading/sign-in/redirect) が一切表示されません。  ║
 * ║                                                                    ║
 * ║ このファイルでは guardResolution を shouldBypass=false でモックし、      ║
 * ║ ProtectedRoute の通常認証フロー（4つの状態遷移）をテストします。         ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Contract: ProtectedRoute は以下の4状態を持つ
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │ State      │ Condition                              │
 *   ├────────────┼────────────────────────────────────────┤
 *   │ ALLOWED    │ flag=on + (skipLogin || authenticated) │
 *   │ DENIED     │ flag=on + !skipLogin + !authenticated  │
 *   │ REDIRECT   │ flag=off (any auth state)              │
 *   │ LOADING    │ flag=on + auth.loading=true            │
 *   └─────────────────────────────────────────────────────┘
 */

import ProtectedRoute from '@/app/ProtectedRoute';
import { routerFutureFlags } from '@/app/routerFuture';
import { useAuth } from '@/auth/useAuth';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Outlet, RouterProvider, createMemoryRouter, useLocation, type RouteObject } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

// Force non-E2E mode for deterministic behavior
vi.mock('@/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/env')>();
  return {
    ...actual,
    isE2E: false,
  };
});

vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  const fakeReadEnv = (key: string, fallback = ''): string => {
    if (key === 'VITE_MSAL_CLIENT_ID' || key === 'VITE_MSAL_TENANT_ID' || key === 'VITE_AAD_CLIENT_ID' || key === 'VITE_AAD_TENANT_ID') {
      return 'test-value';
    }
    if (key === 'VITE_SKIP_LOGIN') return '0';
    return fallback;
  };
  return {
    ...actual,
    isDemoModeEnabled: () => false,
    isDevMode: () => false,
    shouldSkipLogin: () => false,
    readEnv: fakeReadEnv,
  };
});

vi.mock('@/auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/auth/MsalProvider', () => ({
  useMsalContext: vi.fn(() => ({
    accounts: [],
    inProgress: 'none',
    authReady: true,
    instance: { getActiveAccount: () => null },
  })),
}));

// ╔══════════════════════════════════════════════════════════════════════╗
// ║ CRITICAL MOCK: guardResolution                                     ║
// ║                                                                    ║
// ║ Without this mock, process.env.VITEST='1' causes                   ║
// ║ isAutomationRuntime()=true → shouldBypass=true → all auth UI       ║
// ║ is skipped and tests see only the bypass path.                     ║
// ║                                                                    ║
// ║ If you see all tests passing trivially (no auth UI rendered),      ║
// ║ this mock is likely missing or broken.                             ║
// ╚══════════════════════════════════════════════════════════════════════╝
vi.mock('@/lib/auth/guardResolution', () => ({
  getAuthGuardState: () => ({
    shouldBypass: false,
    reason: 'none' as const,
    flags: { isAutomation: false, isDemo: false, isSkip: false, isMsalOk: true },
  }),
  shouldBypassAuthGuard: () => false,
}));

const mockUseAuth = vi.mocked(useAuth);

// ── Test Helpers ───────────────────────────────────────────────────────────

// Ensure CI env vars don't affect tests
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_DEMO_MODE', '0');
  vi.stubEnv('VITE_SKIP_LOGIN', '0');
  vi.stubEnv('VITEST', '0');
  vi.stubEnv('PLAYWRIGHT_TEST', '0');
});

const createAuthState = (
  overrides: Partial<ReturnType<typeof useAuth>> = {}
): ReturnType<typeof useAuth> => ({
  isAuthenticated: true,
  account: null,
  tokenReady: true,
  getListReadyState: () => null,
  setListReadyState: () => {},
  signIn: vi.fn(() => Promise.resolve({ success: false })),
  signOut: vi.fn(() => Promise.resolve()),
  acquireToken: vi.fn(() => Promise.resolve(null)),
  loading: false,
  shouldSkipLogin: false,
  ...overrides,
});

const defaultFlags: FeatureFlagSnapshot = {
  schedules: true,
  complianceForm: false,
  schedulesWeekV2: false,
  icebergPdca: false,
  staffAttendance: false,
  todayOps: false,
};

const LocationProbe: React.FC<{ testId: string }> = ({ testId }) => {
  const location = useLocation();
  return <span data-testid={testId}>{location.pathname}</span>;
};

const renderWith = (
  flags: FeatureFlagSnapshot,
  authOverrides: Partial<ReturnType<typeof useAuth>> = {},
  initialEntries: string[] = ['/schedules/week']
) => {
  mockUseAuth.mockReturnValue(createAuthState(authOverrides));

  const routes: RouteObject[] = [
    {
      path: '/',
      element: (
        <FeatureFlagsProvider value={flags}>
          <Outlet />
        </FeatureFlagsProvider>
      ),
      children: [
        {
          index: true,
          element: <LocationProbe testId="location" />,
        },
        {
          path: 'schedules/week',
          element: (
            <ProtectedRoute flag="schedules">
              <div data-testid="allowed">allowed</div>
            </ProtectedRoute>
          ),
        },
      ],
    },
  ];

  const router = createMemoryRouter(routes, {
    initialEntries,
    future: routerFutureFlags,
  });

  return render(<RouterProvider router={router} />);
};

afterEach(() => {
  cleanup();
  mockUseAuth.mockReset();
});

// ── Contract Tests ─────────────────────────────────────────────────────────

describe('ProtectedRoute auth guard contract', () => {
  // ── State: ALLOWED ──────────────────────────────────────────────────────
  describe('State: ALLOWED (flag=on + authorized)', () => {
    it('renders children when skipLogin is true', () => {
      renderWith(defaultFlags, { shouldSkipLogin: true });
      expect(screen.getByTestId('allowed')).toBeInTheDocument();
    });

    it('renders children when authenticated (skipLogin=false)', () => {
      renderWith(defaultFlags, { isAuthenticated: true, shouldSkipLogin: false });
      expect(screen.getByTestId('allowed')).toBeInTheDocument();
    });
  });

  // ── State: DENIED ───────────────────────────────────────────────────────
  describe('State: DENIED (flag=on + !skipLogin + !authenticated)', () => {
    it('shows sign-in prompt instead of children', () => {
      renderWith(defaultFlags, { shouldSkipLogin: false, isAuthenticated: false });

      // Contract: children must NOT render
      expect(screen.queryByTestId('allowed')).toBeNull();

      // Contract: sign-in UI must be present (heading + at least one sign-in action button)
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /再ログイン/ }).length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── State: REDIRECT ─────────────────────────────────────────────────────
  describe('State: REDIRECT (flag=off)', () => {
    it('redirects to fallback "/" regardless of auth state', async () => {
      const flags: FeatureFlagSnapshot = { ...defaultFlags, schedules: false };
      renderWith(flags, { shouldSkipLogin: true });

      // Contract: children must NOT render
      await waitFor(() => {
        expect(screen.queryByTestId('allowed')).toBeNull();
      });

      // Contract: navigated to fallback path
      expect(screen.getByTestId('location')).toHaveTextContent('/');
    });
  });

  // ── State: LOADING ──────────────────────────────────────────────────────
  describe('State: LOADING (auth.loading=true)', () => {
    it('shows loading indicator instead of children', () => {
      renderWith(defaultFlags, { loading: true });

      // Contract: children must NOT render
      expect(screen.queryByTestId('allowed')).toBeNull();

      // Contract: loading state indicator is present
      expect(screen.getByText(/認証情報を確認/)).toBeInTheDocument();
    });
  });
});


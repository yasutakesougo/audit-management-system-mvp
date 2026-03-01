import ProtectedRoute from '@/app/ProtectedRoute';
import { routerFutureFlags } from '@/app/routerFuture';
import { useAuth } from '@/auth/useAuth';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Outlet, RouterProvider, createMemoryRouter, useLocation, type RouteObject } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  })),
}));

const mockUseAuth = vi.mocked(useAuth);

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

describe('ProtectedRoute flag/skip-login behavior', () => {
  it('allows access when schedules flag enabled and skip-login is true', () => {
    renderWith(defaultFlags, { shouldSkipLogin: true });
    expect(screen.getByTestId('allowed')).toBeInTheDocument();
  });

  it('prompts sign-in when flag enabled, skip-login false, and user not authenticated', () => {
    renderWith(defaultFlags, { shouldSkipLogin: false, isAuthenticated: false });
    expect(screen.getByText('スケジュールを表示するには、サインインが必要です。')).toBeInTheDocument();
    expect(screen.getByText('強制再ログイン')).toBeInTheDocument();
  });

  it('redirects to fallback when schedules flag disabled (regardless of skip-login)', async () => {
    const flags: FeatureFlagSnapshot = { ...defaultFlags, schedules: false };
    renderWith(flags, { shouldSkipLogin: true });

    await waitFor(() => {
      expect(screen.queryByTestId('allowed')).toBeNull();
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('shows loading state while auth is loading', () => {
    renderWith(defaultFlags, { loading: true });
    expect(screen.getByText('認証情報を確認しています…')).toBeInTheDocument();
  });
});

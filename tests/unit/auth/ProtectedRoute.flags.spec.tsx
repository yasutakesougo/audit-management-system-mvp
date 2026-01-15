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

vi.mock('@/auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = vi.mocked(useAuth);

// Ensure CI env vars don't affect tests
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_DEMO_MODE', '0');
  vi.stubEnv('VITE_SKIP_LOGIN', '0');
});

const createAuthState = (
  overrides: Partial<ReturnType<typeof useAuth>> = {}
): ReturnType<typeof useAuth> => ({
  isAuthenticated: true,
  account: null,
  signIn: vi.fn(() => Promise.resolve()),
  signOut: vi.fn(() => Promise.resolve()),
  acquireToken: vi.fn(() => Promise.resolve(null)),
  loading: false,
  shouldSkipLogin: false,
  ...overrides,
});

const defaultFlags: FeatureFlagSnapshot = {
  schedules: true,
  schedulesCreate: true,
  complianceForm: false,
  schedulesWeekV2: false,
  icebergPdca: false,
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
    expect(screen.getByText('サインインする')).toBeInTheDocument();
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

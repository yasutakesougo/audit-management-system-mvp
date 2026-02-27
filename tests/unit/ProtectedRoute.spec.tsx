import ProtectedRoute from '@/app/ProtectedRoute';
import { routerFutureFlags } from '@/app/routerFuture';
import { useAuth } from '@/auth/useAuth';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Outlet, RouterProvider, createMemoryRouter, useLocation, type RouteObject } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the env module to disable E2E mode for testing
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

const createAuthenticatedState = (
  overrides: Partial<ReturnType<typeof useAuth>> = {}
): ReturnType<typeof useAuth> => ({
  isAuthenticated: true,
  account: null,
  signIn: vi.fn(() => Promise.resolve({ success: true })),
  signOut: vi.fn(() => Promise.resolve()),
  acquireToken: vi.fn(() => Promise.resolve(null)),
  loading: false,
  shouldSkipLogin: false,
  tokenReady: true,
  getListReadyState: vi.fn(() => true),
  setListReadyState: vi.fn(),
  ...overrides,
});

const defaultFlags: FeatureFlagSnapshot = {
  schedules: true,
  complianceForm: false,
  schedulesWeekV2: false,
  icebergPdca: false,
  staffAttendance: false,
  appShellVsCode: false,
  todayOps: false,
};

const LocationProbe: React.FC<{ testId: string }> = ({ testId }) => {
  const location = useLocation();
  return <span data-testid={testId}>{location.pathname}</span>;
};

const renderWithFlags = (flags: FeatureFlagSnapshot, initialEntries: string[] = ['/guarded']) => {
  mockUseAuth.mockReturnValue(createAuthenticatedState());
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
          path: 'guarded',
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

describe('ProtectedRoute', () => {
  it('renders children when flag enabled', () => {
    renderWithFlags(defaultFlags);
    expect(screen.getByTestId('allowed')).toBeInTheDocument();
  });

  it('redirects to fallback when flag disabled', async () => {
    const disabledFlags: FeatureFlagSnapshot = {
      ...defaultFlags,
      schedules: false,
    };

    renderWithFlags(disabledFlags);
    await waitFor(() => {
      expect(screen.queryByTestId('allowed')).toBeNull();
    });
    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });
});

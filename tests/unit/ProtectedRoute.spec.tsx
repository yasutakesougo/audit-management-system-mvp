import ProtectedRoute from '@/app/ProtectedRoute';
import { routerFutureFlags } from '@/app/routerFuture';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Outlet, RouterProvider, createMemoryRouter, useLocation, type RouteObject } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

const defaultFlags: FeatureFlagSnapshot = {
  schedules: true,
  schedulesCreate: true,
  complianceForm: false,
};

const LocationProbe: React.FC<{ testId: string }> = ({ testId }) => {
  const location = useLocation();
  return <span data-testid={testId}>{location.pathname}</span>;
};

const renderWithFlags = (flags: FeatureFlagSnapshot, initialEntries: string[] = ['/guarded']) => {
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

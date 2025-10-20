import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import ProtectedRoute from '@/app/ProtectedRoute';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { routerFutureFlags } from '@/app/routerFuture';

const defaultFlags: FeatureFlagSnapshot = {
  schedules: true,
  schedulesCreate: true,
  complianceForm: false,
  timeflowV2: false,
};

const LocationProbe: React.FC<{ testId: string }> = ({ testId }) => {
  const location = useLocation();
  return <span data-testid={testId}>{location.pathname}</span>;
};

const renderWithFlags = (flags: FeatureFlagSnapshot) =>
  render(
    <FeatureFlagsProvider value={flags}>
      <MemoryRouter initialEntries={['/guarded']} future={routerFutureFlags}>
        <Routes>
          <Route
            path="/guarded"
            element={(
              <ProtectedRoute flag="schedules">
                <div data-testid="allowed">allowed</div>
              </ProtectedRoute>
            )}
          />
          <Route path="/" element={<LocationProbe testId="location" />} />
        </Routes>
      </MemoryRouter>
    </FeatureFlagsProvider>,
  );

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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AppShell from '@/app/AppShell';
import Router from '@/app/router';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { routerFutureFlags } from '@/app/routerFuture';

vi.mock('@/lib/spClient', () => ({
  useSP: () => ({
    spFetch: vi.fn(() => Promise.resolve({ ok: true })),
  }),
}));

const renderWithFlags = (flags: FeatureFlagSnapshot) =>
  render(
    <FeatureFlagsProvider value={flags}>
      <MemoryRouter future={routerFutureFlags}>
        <AppShell>
          <Router />
        </AppShell>
      </MemoryRouter>
    </FeatureFlagsProvider>
  );

describe('AppShell schedule flag', () => {
  it('hides schedule nav when flag is disabled', () => {
    renderWithFlags({ schedules: false, schedulesCreate: false, complianceForm: false });
    expect(screen.queryByTestId('nav-schedule')).toBeNull();
  });

  it('shows schedule nav when flag is enabled', async () => {
    renderWithFlags({ schedules: true, schedulesCreate: false, complianceForm: false });
    expect(await screen.findByTestId('nav-schedule')).toBeInTheDocument();
  });
});

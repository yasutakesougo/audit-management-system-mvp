import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppShell from '@/app/AppShell';
import Router from '@/app/router';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { routerFutureFlags } from '@/app/routerFuture';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

vi.mock('@/lib/spClient', () => ({
  useSP: () => ({
    spFetch: vi.fn(() => Promise.resolve({ ok: true })),
  }),
}));

const renderWithFlags = (flags: FeatureFlagSnapshot) =>
  renderWithAppProviders(
    <FeatureFlagsProvider value={flags}>
      <AppShell>
        <Router />
      </AppShell>
    </FeatureFlagsProvider>,
    { future: routerFutureFlags }
  );

describe('AppShell schedule flag', () => {
  it('hides schedule nav when flag is disabled', () => {
    renderWithFlags({ schedules: false, schedulesCreate: false, complianceForm: false });
    expect(screen.queryByTestId('nav-schedules')).toBeNull();
  });

  it('shows schedule nav when flag is enabled', async () => {
    renderWithFlags({ schedules: true, schedulesCreate: false, complianceForm: false });
    expect(await screen.findByTestId('nav-schedules')).toBeInTheDocument();
  });
});

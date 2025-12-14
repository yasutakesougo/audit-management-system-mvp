import AppShell from '@/app/AppShell';
import Router from '@/app/router';
import { routerFutureFlags } from '@/app/routerFuture';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
    renderWithFlags({ schedules: false, schedulesCreate: false, complianceForm: false, schedulesWeekV2: false, icebergPdca: false });
    expect(screen.queryByTestId('nav-schedules')).toBeNull();
  });

  it('shows schedule nav when flag is enabled', async () => {
    renderWithFlags({ schedules: true, schedulesCreate: false, complianceForm: false, schedulesWeekV2: true, icebergPdca: false });
    expect(await screen.findByTestId('nav-schedules')).toBeInTheDocument();
  });
});

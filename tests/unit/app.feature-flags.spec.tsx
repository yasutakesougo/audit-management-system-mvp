import AppShell from '@/app/AppShell';
import Router from '@/app/router';
import { routerFutureFlags } from '@/app/routerFuture';
import { FeatureFlagsProvider, resolveFeatureFlags, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { type EnvRecord } from '@/lib/env';
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
    expect(screen.queryByTestId('schedules-nav-link')).toBeNull();
  });

  it('shows schedule nav when flag is enabled', async () => {
    renderWithFlags({ schedules: true, schedulesCreate: false, complianceForm: false, schedulesWeekV2: true, icebergPdca: false });
    expect(await screen.findByTestId('schedules-nav-link')).toBeInTheDocument();
  });

  it('exposes iceberg PDCA flag from env', () => {
    const flags = resolveFeatureFlags({ VITE_FEATURE_ICEBERG_PDCA: '1' } satisfies EnvRecord);
    expect(flags.icebergPdca).toBe(true);
  });
});

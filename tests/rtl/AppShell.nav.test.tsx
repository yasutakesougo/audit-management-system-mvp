import React, { type ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import AppShell from '@/app/AppShell';
import { ColorModeContext } from '@/app/theme';
import { FeatureFlagsContext, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { SettingsProvider } from '@/features/settings';

vi.mock('@/lib/spClient', () => ({
  useSP: () => ({ spFetch: vi.fn().mockResolvedValue({ ok: true }) }),
}));

vi.mock('@/components/NavLinkPrefetch', async () => {
  const ReactModule = await import('react');
  const { forwardRef } = ReactModule;
  const { Link } = await import('react-router-dom');
  type LinkProps = React.ComponentProps<typeof Link> & {
    preloadKey?: unknown;
    preloadKeys?: unknown;
  };
  const MockNavLinkPrefetch = forwardRef<HTMLAnchorElement, LinkProps>(
    ({ preloadKey: _preloadKey, preloadKeys: _preloadKeys, ...rest }, ref) => (
      <Link ref={ref} {...rest} />
    ),
  );
  return {
    __esModule: true,
    default: MockNavLinkPrefetch,
  };
});

vi.mock('@/hydration/RouteHydrationListener', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/a11y/LiveAnnouncer', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/features/handoff/HandoffQuickNoteCard', () => ({
  __esModule: true,
  HandoffQuickNoteCard: () => <div data-testid="handoff-quicknote-card" />,
}));

vi.mock('@/features/dashboard/dashboardRouting', () => ({
  useDashboardPath: () => '/',
}));

vi.mock('@/features/auth/store', () => ({
  useAuthStore: (selector: (state: { currentUserRole: 'staff' }) => unknown) =>
    selector({ currentUserRole: 'staff' }),
  setCurrentUserRole: vi.fn(),
}));

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    getAppConfig: () => ({
      ...actual.getAppConfig(),
      isDev: false,
    }),
    shouldSkipLogin: () => false,
    isSchedulesFeatureEnabled: () => false,
    isComplianceFormEnabled: () => false,
    isSchedulesWeekV2Enabled: () => false,
  };
});

vi.mock('@/ui/components/SignInButton', () => ({
  __esModule: true,
  default: () => <button type="button">sign-in</button>,
}));

describe('AppShell navigation smoke test', () => {
  const baseFlags: FeatureFlagSnapshot = {
    schedules: false,
    schedulesCreate: false,
    complianceForm: false,
    schedulesWeekV2: false,
    icebergPdca: false,
  };

  const colorMode = { mode: 'light' as const, toggle: vi.fn(), sticky: false };

  const renderWithProviders = (flags: FeatureFlagSnapshot = baseFlags) =>
    render(
      <MemoryRouter initialEntries={['/daily']}>
        <ColorModeContext.Provider value={colorMode}>
          <FeatureFlagsContext.Provider value={flags}>
            <SettingsProvider>
              <AppShell>
                <div />
              </AppShell>
            </SettingsProvider>
          </FeatureFlagsContext.Provider>
        </ColorModeContext.Provider>
      </MemoryRouter>
    );

  it('exposes nav and footer test IDs', async () => {
    renderWithProviders();

    const ids = [
      'nav-daily',
      'footer-action-daily-attendance',
      'footer-action-daily-activity',
      'daily-footer-support',
      'daily-footer-health',
    ];

    const elements = await Promise.all(ids.map((testId) => screen.findByTestId(testId)));
    elements.forEach((node) => {
      expect(node).toBeInTheDocument();
    });
  });

  it('hides Iceberg PDCA nav when feature flag is off', () => {
    const flags = { ...baseFlags, icebergPdca: false };
    renderWithProviders(flags);

    expect(screen.queryByTestId('nav-iceberg-pdca')).not.toBeInTheDocument();
  });

  it('shows Iceberg PDCA nav when feature flag is on', () => {
    const flags = { ...baseFlags, icebergPdca: true };
    renderWithProviders(flags);

    expect(screen.getByTestId('nav-iceberg-pdca')).toBeInTheDocument();
  });
});

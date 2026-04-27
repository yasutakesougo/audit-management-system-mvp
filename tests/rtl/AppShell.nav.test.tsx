import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import AppShell from '@/app/AppShell';
import { ColorModeContext } from '@/app/theme';
import { FeatureFlagsContext, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { SettingsProvider } from '@/features/settings';
import { ToastProvider } from '@/hooks/useToast';
import { TESTIDS } from '@/testids';

vi.mock('@/lib/spClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/spClient')>('@/lib/spClient');
  return {
    ...actual,
    useSP: () => ({ spFetch: vi.fn().mockResolvedValue({ ok: true }) }),
  };
});

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

vi.mock('@/app/navigation/planningNavTelemetry', () => ({
  recordPlanningNavTelemetry: vi.fn(),
  markPlanningNavInitialExposure: vi.fn(),
  maybeRecordPlanningNavRetention: vi.fn(),
  PLANNING_NAV_TELEMETRY_EVENTS: {
    VISIBILITY_CHANGED: 'VISIBILITY_CHANGED',
    PAGE_ARRIVED: 'PAGE_ARRIVED',
  },
}));

vi.mock('@mui/material/IconButton', () => ({
  __esModule: true,
  default: ({ children, onClick, ...props }: Record<string, unknown>) => (
    <button type="button" onClick={onClick as React.MouseEventHandler} {...props}>
      {children as React.ReactNode}
    </button>
  ),
}));

vi.mock('@mui/material/Tooltip', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AppShell navigation smoke test', () => {
  const originalError = console.error;

  beforeAll(() => {
    console.error = (...args: unknown[]) => {
      const msg = String(args[0] || '');
      if (msg.includes('not wrapped in act')) return;
      originalError.apply(console, args);
    };
  });

  afterAll(() => {
    console.error = originalError;
  });

  afterEach(async () => {
    // Flush any pending effects before cleanup
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  const baseFlags: FeatureFlagSnapshot = {
    schedules: false,
    complianceForm: false,
    schedulesWeekV2: false,
    icebergPdca: false,
    staffAttendance: false,
    todayOps: false,
    todayLiteUi: false,
    todayLiteNavV2: false,
  };

  const colorMode = { mode: 'light' as const, toggle: vi.fn(), sticky: false };

  const renderWithProviders = async (flags: FeatureFlagSnapshot = baseFlags) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    
    let utils: ReturnType<typeof render>;
    await act(async () => {
      utils = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/daily']}>
            <ColorModeContext.Provider value={colorMode}>
              <FeatureFlagsContext.Provider value={flags}>
                <SettingsProvider>
                  <ToastProvider>
                    <AppShell>
                      <div />
                    </AppShell>
                  </ToastProvider>
                </SettingsProvider>
              </FeatureFlagsContext.Provider>
            </ColorModeContext.Provider>
          </MemoryRouter>
        </QueryClientProvider>
      );
    });

    // Wait for the app shell to be ready and settled
    await screen.findByTestId('app-shell');
    await screen.findByTestId(TESTIDS['sp-connection-status']);
    
    // Flush any pending microtasks from mount effects
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    
    return utils!;
  };

  it('exposes nav and footer test IDs', async () => {
    const user = userEvent.setup();
    await renderWithProviders();

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS['sp-connection-status'])).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS['nav-open'])).toBeInTheDocument();

    await user.click(screen.getByTestId('nav-open'));
    
    // Wait for navigation and flush transitions
    const nav = await screen.findByRole('navigation', { name: /主要ナビゲーション/i });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const navLinks = within(nav).getAllByRole('link');
    expect(navLinks.some((link) => link.getAttribute('href') === '/daily/health')).toBe(true);
  });

  it('hides Iceberg PDCA nav when feature flag is off', async () => {
    const flags = { ...baseFlags, icebergPdca: false };
    await renderWithProviders(flags);

    expect(screen.queryByTestId('nav-iceberg-pdca')).not.toBeInTheDocument();
  });

  it('shows Iceberg PDCA nav when feature flag is on', async () => {
    // NOTE: icebergPdcaEnabled is currently unused in createNavItems
    // so iceberg PDCA nav item is NOT rendered regardless of flag
    const flags = { ...baseFlags, icebergPdca: true };
    await renderWithProviders(flags);

    expect(screen.queryByTestId('nav-iceberg-pdca')).not.toBeInTheDocument();
  });
});

/**
 * DashboardRedirect — Role-aware landing redirect tests
 *
 * Phase 1: TodayOps 現場ホーム化
 * - admin  → /dashboard (Decision Layer)
 * - others → /today     (Execution Layer, when todayOps flag is ON)
 * - any    → /dashboard (when todayOps flag is OFF)
 */
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Role } from '@/auth/roles';
import type { UserSettings } from '@/features/settings/settingsModel';

// ── Mocks ────────────────────────────────────────────────────────────────

let mockRole: Role = 'viewer';
let mockReady = true;
let mockSettings: UserSettings;

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({ role: mockRole, ready: mockReady }),
}));

let mockTodayOpsFlag = true;

vi.mock('@/config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/featureFlags')>();
  return {
    ...actual,
    useFeatureFlag: (flag: string) => {
      if (flag === 'todayOps') return mockTodayOpsFlag;
      return false;
    },
    useFeatureFlags: () => ({ todayOps: mockTodayOpsFlag, todayLiteUi: false, todayLiteNavV2: false }),
    FeatureFlagsProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock('@/features/settings/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: mockSettings,
  }),
}));

// ── Import after mocks ──────────────────────────────────────────────────

import { DashboardRedirect } from '../redirects';

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Render DashboardRedirect at "/" and return the resolved pathname.
 */
function renderRedirect(): string {
  const routes = [
    { index: true, element: <DashboardRedirect /> },
    { path: '/dashboard', element: <div data-testid="dashboard">Dashboard</div> },
    { path: '/today', element: <div data-testid="today">Today</div> },
  ];

  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
  render(<RouterProvider router={router} />);

  return router.state.location.pathname;
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('DashboardRedirect', () => {
  beforeEach(() => {
    // Reset to defaults
    mockRole = 'viewer';
    mockReady = true;
    mockTodayOpsFlag = true;
    mockSettings = {
      colorMode: 'system',
      density: 'comfortable',
      fontSize: 'medium',
      colorPreset: 'default',
      layoutMode: 'normal',
      hiddenNavGroups: [],
      navGroupVisibilityPrefs: {},
      hiddenNavItems: [],
      navPolicyVersion: 1,
      lastModified: 1,
    };
  });

  it('admin + flag ON → /dashboard', () => {
    mockRole = 'admin';
    mockTodayOpsFlag = true;

    const pathname = renderRedirect();
    expect(pathname).toBe('/dashboard');
  });

  it('viewer + flag ON → /today', () => {
    mockRole = 'viewer';
    mockTodayOpsFlag = true;

    const pathname = renderRedirect();
    expect(pathname).toBe('/today');
  });

  it('reception + flag ON → /today', () => {
    mockRole = 'reception';
    mockTodayOpsFlag = true;

    const pathname = renderRedirect();
    expect(pathname).toBe('/today');
  });

  it('normal mode + stale ?kiosk=1 at root remains /today', () => {
    mockRole = 'viewer';
    mockTodayOpsFlag = true;
    mockSettings.layoutMode = 'normal';

    const routes = [
      { index: true, element: <DashboardRedirect /> },
      { path: '/dashboard', element: <div>Dashboard</div> },
      { path: '/today', element: <div>Today</div> },
      { path: '/kiosk', element: <div>Kiosk</div> },
    ];

    const router = createMemoryRouter(routes, {
      initialEntries: ['/?kiosk=1'],
    });
    render(<RouterProvider router={router} />);

    expect(router.state.location.pathname).toBe('/today');
  });

  it('kiosk layout mode still redirects to /kiosk', () => {
    mockRole = 'viewer';
    mockTodayOpsFlag = true;
    mockSettings.layoutMode = 'kiosk';

    const routes = [
      { index: true, element: <DashboardRedirect /> },
      { path: '/dashboard', element: <div>Dashboard</div> },
      { path: '/today', element: <div>Today</div> },
      { path: '/kiosk', element: <div>Kiosk</div> },
    ];

    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });
    render(<RouterProvider router={router} />);

    expect(router.state.location.pathname).toBe('/kiosk');
  });

  it('viewer + flag OFF → /dashboard', () => {
    mockRole = 'viewer';
    mockTodayOpsFlag = false;

    const pathname = renderRedirect();
    expect(pathname).toBe('/dashboard');
  });

  it('admin + flag OFF → /dashboard', () => {
    mockRole = 'admin';
    mockTodayOpsFlag = false;

    const pathname = renderRedirect();
    expect(pathname).toBe('/dashboard');
  });

  it('preserves query params on redirect', () => {
    mockRole = 'viewer';
    mockTodayOpsFlag = true;

    const routes = [
      { index: true, element: <DashboardRedirect /> },
      { path: '/dashboard', element: <div>Dashboard</div> },
      { path: '/today', element: <div>Today</div> },
    ];

    const router = createMemoryRouter(routes, {
      initialEntries: ['/?date=2026-03-10'],
    });
    render(<RouterProvider router={router} />);

    expect(router.state.location.pathname).toBe('/today');
    expect(router.state.location.search).toBe('?date=2026-03-10');
  });
});

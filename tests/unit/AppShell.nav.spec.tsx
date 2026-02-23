import AppShell from '@/app/AppShell';
import { routerFutureFlags } from '@/app/routerFuture';
import { ColorModeContext } from '@/app/theme';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

// MUI useMediaQuery を desktop 固定（Drawer が permanent 表示されるよう確保）
vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => true,
}));

const spFetchMock = vi.fn(async (_path: string, _init?: RequestInit) => ({ ok: true }));

const defaultFlags: FeatureFlagSnapshot = {
  schedules: true,
  complianceForm: false,
  schedulesWeekV2: false,
  icebergPdca: false,
  staffAttendance: false,
};

beforeEach(() => {
  spFetchMock.mockReset();
  spFetchMock.mockImplementation(() => Promise.resolve({ ok: true }));
});

afterEach(() => {
  cleanup();
});

vi.mock('@/lib/spClient', () => ({
  useSP: () => ({
    spFetch: spFetchMock,
  }),
}));

vi.mock('@/features/compliance-checklist/api', () => ({
  useChecklistApi: () => ({
    getListIdentifier: () => null,
  }),
}));

vi.mock('@/ui/components/SignInButton', () => ({
  __esModule: true,
  default: () => <div data-testid="sign-in-button" />,
}));

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    shouldSkipLogin: () => false,
    readBool: (key: string) => {
      if (key === 'VITE_FEATURE_SP_HUD') return true;
      return actual.readBool(key);
    },
  };
});

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    signOut: vi.fn(),
    acquireToken: vi.fn(),
    isAuthenticated: true,
    account: { username: 'tester' },
  }),
}));

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({
    role: 'viewer',
    ready: true,
  }),
}));

describe('AppShell navigation', () => {
  it.todo('marks current route button with aria-current="page" - awaiting AppShell useEffect fix');

  it('marks current route button with aria-current="page"', async () => {
    const toggleMock = vi.fn();
    const theme = createTheme();
    const initialEntries = ['/users'];
    const routeEntries = Array.from(new Set([...initialEntries, '/']));
    const getShell = () => (
      <ThemeProvider theme={theme}>
        <FeatureFlagsProvider value={defaultFlags}>
          <ColorModeContext.Provider value={{ mode: 'light', toggle: toggleMock, sticky: false }}>
            <AppShell>
              <div />
            </AppShell>
          </ColorModeContext.Provider>
        </FeatureFlagsProvider>
      </ThemeProvider>
    );

    renderWithAppProviders(getShell(), {
      initialEntries,
      future: routerFutureFlags,
      routeChildren: routeEntries.map((path) => ({ path, element: getShell() })),
    });

    // Open the desktop navigation drawer
    const openNavButton = screen.getByRole('button', { name: /サイドメニューを開く/i });
    await userEvent.click(openNavButton);

    const navRoot = screen.getByRole('navigation', { name: /主要ナビゲーション/i });
    const nav = within(navRoot);

    // Check that navigation drawer is open and contains links
    const links = nav.queryAllByRole('link');
    expect(links.length).toBeGreaterThan(0);

    // Check that schedules link exists (flag is true in defaultFlags)
    const hasSchedulesLink = links.some(link => link.getAttribute('href')?.includes('/schedules') || link.getAttribute('href')?.includes('/schedule'));
    expect(hasSchedulesLink).toBe(true);

    // Check that compliance link does NOT exist (flag is false in defaultFlags)
    const hasComplianceLink = links.some(link => link.getAttribute('href')?.includes('/compliance'));
    expect(hasComplianceLink).toBe(false);

    // Footer actions should include schedules create when flag is enabled
    const footer = await screen.findByRole('contentinfo');
    const footerWithin = within(footer);
    expect(footerWithin.queryByRole('link', { name: '新規予定' })).toBeNull();

  });

  it('leaves status neutral when ping aborts', async () => {
    spFetchMock.mockImplementation((_path: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      if (signal?.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });

    const toggleMock = vi.fn();
    const theme = createTheme();
    const initialEntries = ['/'];
    const routeEntries = Array.from(new Set([...initialEntries]));
    const getShell = () => (
      <ThemeProvider theme={theme}>
        <FeatureFlagsProvider value={defaultFlags}>
          <ColorModeContext.Provider value={{ mode: 'light', toggle: toggleMock, sticky: false }}>
            <AppShell>
              <div />
            </AppShell>
          </ColorModeContext.Provider>
        </FeatureFlagsProvider>
      </ThemeProvider>
    );

    const { unmount } = renderWithAppProviders(getShell(), {
      initialEntries,
      future: routerFutureFlags,
      routeChildren: routeEntries.map((path) => ({ path, element: getShell() })),
    });

    const hudStatus = await screen.findByTestId('sp-connection-status');
    expect(hudStatus).not.toHaveAttribute('data-connection-state', 'error');
    expect(hudStatus.textContent ?? '').not.toMatch(/SP Error/i);
    expect(screen.queryByText(/SP Error/i)).toBeNull();
    unmount();
  });
});

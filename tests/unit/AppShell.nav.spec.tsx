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
  appShellVsCode: false,
  todayOps: false,
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
  const ensureDesktopNavOpen = async () => {
    const navToggleButton = screen.getByRole('button', { name: /サイドメニューを(開く|閉じる)/i });
    if (navToggleButton.getAttribute('aria-label')?.includes('開く')) {
      await userEvent.click(navToggleButton);
    }
  };

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
    await ensureDesktopNavOpen();

    const navRoot = screen.getByRole('navigation', { name: /主要ナビゲーション/i });
    const nav = within(navRoot);

    // '/users' に対応する「利用者」リンクが active になっているか確認
    const activeLink = nav.getByRole('link', { name: /利用者/i });
    expect(activeLink).toHaveAttribute('aria-current', 'page');

    // active ではないリンクには aria-current が付いていないことを確認
    const inactiveLink = nav.getByRole('link', { name: /黒ノート一覧/i });
    expect(inactiveLink).not.toHaveAttribute('aria-current');
  });

  it('renders navigation links based on feature flags', async () => {
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
    await ensureDesktopNavOpen();

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

  describe('Feature flags', () => {
    it('shows compliance link when feature flag is enabled', async () => {
      const toggleMock = vi.fn();
      const theme = createTheme();
      const initialEntries = ['/'];
      const routeEntries = Array.from(new Set([...initialEntries]));
      const flagsWithCompliance = { ...defaultFlags, complianceForm: true };

      const getShell = () => (
        <ThemeProvider theme={theme}>
          <FeatureFlagsProvider value={flagsWithCompliance}>
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

      await ensureDesktopNavOpen();

      const navRoot = screen.getByRole('navigation', { name: /主要ナビゲーション/i });
      const nav = within(navRoot);
      const links = nav.queryAllByRole('link');

      const hasComplianceLink = links.some(link => link.getAttribute('href')?.includes('/compliance'));
      expect(hasComplianceLink).toBe(true);
    });

    it('shows iceberg PDCA when feature flag is enabled', async () => {
      const toggleMock = vi.fn();
      const theme = createTheme();
      const initialEntries = ['/'];
      const flagsWithIcebergPdca = { ...defaultFlags, icebergPdca: true };

      const getShell = () => (
        <ThemeProvider theme={theme}>
          <FeatureFlagsProvider value={flagsWithIcebergPdca}>
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
        routeChildren: Array.from(new Set([...initialEntries])).map((path) => ({ path, element: getShell() })),
      });

      await ensureDesktopNavOpen();

      const navRoot = screen.getByRole('navigation', { name: /主要ナビゲーション/i });
      const nav = within(navRoot);
      const links = nav.queryAllByRole('link');

      const hasIcebergPdcaLink = links.some(link => link.getAttribute('href')?.includes('/iceberg-pdca'));
      expect(hasIcebergPdcaLink).toBe(true);
    });

    it('shows staff attendance when feature flag is enabled', async () => {
      const toggleMock = vi.fn();
      const theme = createTheme();
      const initialEntries = ['/'];
      const flagsWithStaffAttendance = { ...defaultFlags, staffAttendance: true };

      const getShell = () => (
        <ThemeProvider theme={theme}>
          <FeatureFlagsProvider value={flagsWithStaffAttendance}>
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
        routeChildren: Array.from(new Set([...initialEntries])).map((path) => ({ path, element: getShell() })),
      });

      await ensureDesktopNavOpen();

      const navRoot = screen.getByRole('navigation', { name: /主要ナビゲーション/i });
      const nav = within(navRoot);
      const links = nav.queryAllByRole('link');

      const hasStaffAttendanceLink = links.some(link => link.textContent?.includes('職員勤怠'));
      expect(hasStaffAttendanceLink).toBe(true);
    });
  });

  describe('Search functionality', () => {
    it('filters navigation items by search query', async () => {
      const toggleMock = vi.fn();
      const theme = createTheme();
      const initialEntries = ['/'];

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
        routeChildren: Array.from(new Set([...initialEntries])).map((path) => ({ path, element: getShell() })),
      });

      await ensureDesktopNavOpen();

      const navRoot = screen.getByRole('navigation', { name: /主要ナビゲーション/i });
      const nav = within(navRoot);

      // Find search input
      const searchInput = nav.getByPlaceholderText(/メニュー検索/i);
      expect(searchInput).toBeInTheDocument();

      // Get initial link count
      const linksBeforeSearch = nav.queryAllByRole('link');
      const initialCount = linksBeforeSearch.length;

      // Type a search query
      await userEvent.type(searchInput, '記録');

      // After search, fewer links should be visible
      const linksAfterSearch = nav.queryAllByRole('link');
      expect(linksAfterSearch.length).toBeLessThan(initialCount);
      expect(linksAfterSearch.length).toBeGreaterThan(0);
    });

    it('clears search query when Escape is pressed', async () => {
      const toggleMock = vi.fn();
      const theme = createTheme();
      const initialEntries = ['/'];

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
        routeChildren: Array.from(new Set([...initialEntries])).map((path) => ({ path, element: getShell() })),
      });

      await ensureDesktopNavOpen();

      const navRoot = screen.getByRole('navigation', { name: /主要ナビゲーション/i });
      const nav = within(navRoot);
      const searchInput = nav.getByPlaceholderText(/メニュー検索/i) as HTMLInputElement;

      // Type a search query
      await userEvent.type(searchInput, '記録');
      expect(searchInput.value).toBe('記録');

      // Press Escape
      await userEvent.keyboard('{Escape}');
      expect(searchInput.value).toBe('');
    });
  });

  describe('Navigation collapse', () => {
    it('toggles navigation between collapsed and expanded states', async () => {
      const toggleMock = vi.fn();
      const theme = createTheme();
      const initialEntries = ['/'];

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
        routeChildren: Array.from(new Set([...initialEntries])).map((path) => ({ path, element: getShell() })),
      });

      await ensureDesktopNavOpen();

      const toggleButton = screen.getByRole('button', { name: /ナビを(折りたたみ|展開)/i });
      expect(toggleButton).toBeInTheDocument();

      const beforeLabel = toggleButton.getAttribute('aria-label') ?? '';
      await userEvent.click(toggleButton);

      if (beforeLabel.includes('折りたたみ')) {
        const expandButton = await screen.findByRole('button', { name: /ナビを展開/i });
        expect(expandButton).toBeInTheDocument();
      } else {
        const collapseButton = await screen.findByRole('button', { name: /ナビを折りたたみ/i });
        expect(collapseButton).toBeInTheDocument();
      }
    });
  });
});

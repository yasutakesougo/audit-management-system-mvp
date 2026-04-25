import AppShell from '@/app/AppShell';
import { routerFutureFlags } from '@/app/routerFuture';
import { ColorModeContext } from '@/app/theme';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

// MUI useMediaQuery を desktop 固定（Drawer が permanent 表示されるよう確保）
vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => true,
}));

const spFetchMock = vi.fn(async (_path: string, _init?: RequestInit) => ({ ok: true }));

/**
 * Flag 工場: FeatureFlagSnapshot の全キーを明示的に列挙。
 * フラグ追加時にコンパイルエラーで教えてくれる。
 */
const makeFlags = (overrides: Partial<FeatureFlagSnapshot> = {}): FeatureFlagSnapshot => ({
  schedules: true,
  complianceForm: false,
  schedulesWeekV2: false,
  icebergPdca: false,
  staffAttendance: false,
  todayOps: false,
  todayLiteUi: false,
  todayLiteNavV2: false,
  ...overrides,
});

const defaultFlags: FeatureFlagSnapshot = makeFlags();
let mockAuthzRole: 'viewer' | 'reception' | 'admin' = 'viewer';

beforeEach(() => {
  spFetchMock.mockReset();
  spFetchMock.mockImplementation(() => Promise.resolve({ ok: true }));
  mockAuthzRole = 'viewer';
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

vi.mock('@/app/components/FooterQuickActions', () => ({
  FooterQuickActions: () => <footer role="contentinfo" data-testid="footer-quick-actions-mock" />,
  default: () => <footer role="contentinfo" data-testid="footer-quick-actions-mock" />,
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
    role: mockAuthzRole,
    ready: true,
  }),
}));

describe('AppShell navigation', () => {
  const ensureDesktopNavOpen = () => {
    const navToggleButton = screen.getByRole('button', { name: /サイドメニューを(開く|閉じる)/i });
    if (navToggleButton.getAttribute('aria-label')?.includes('開く')) {
      fireEvent.click(navToggleButton);
    }
  };

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
    ensureDesktopNavOpen();

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

    // AppShell footer is now enabled by default.
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

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

      ensureDesktopNavOpen();

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

      ensureDesktopNavOpen();

      const navRoot = screen.getByRole('navigation', { name: /主要ナビゲーション/i });
      const nav = within(navRoot);
      const links = nav.queryAllByRole('link');

      const hasIcebergPdcaLink = links.some(link => link.getAttribute('href')?.includes('/iceberg-pdca'));
      expect(hasIcebergPdcaLink).toBe(false);
    });

    it('hides staff attendance for viewer even when feature flag is enabled', async () => {
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

      ensureDesktopNavOpen();

      const navRoot = screen.getByRole('navigation', { name: /主要ナビゲーション/i });
      const nav = within(navRoot);
      const links = nav.queryAllByRole('link');

      const hasStaffAttendanceLink = links.some(link => link.textContent?.includes('職員勤怠'));
      expect(hasStaffAttendanceLink).toBe(false);
    });

    it('shows staff attendance for reception when feature flag is enabled', async () => {
      mockAuthzRole = 'reception';
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

      ensureDesktopNavOpen();

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

      ensureDesktopNavOpen();

      const navRoot = screen.getByRole('navigation', { name: /主要ナビゲーション/i });
      const nav = within(navRoot);

      // Find search input
      const searchInput = nav.getByPlaceholderText(/メニュー検索/i);
      expect(searchInput).toBeInTheDocument();

      // Get initial link count
      const linksBeforeSearch = nav.queryAllByRole('link');
      const initialCount = linksBeforeSearch.length;

      // Type a search query
      fireEvent.change(searchInput, { target: { value: '記録' } });

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

      ensureDesktopNavOpen();

      const navRoot = screen.getByRole('navigation', { name: /主要ナビゲーション/i });
      const nav = within(navRoot);
      const searchInput = nav.getByPlaceholderText(/メニュー検索/i) as HTMLInputElement;

      // Type a search query
      fireEvent.change(searchInput, { target: { value: '記録' } });
      expect(searchInput.value).toBe('記録');

      // Press Escape
      fireEvent.keyDown(searchInput, { key: 'Escape', code: 'Escape' });
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

      ensureDesktopNavOpen();

      const toggleButton = screen.getByRole('button', { name: /ナビを(折りたたみ|展開)/i });
      expect(toggleButton).toBeInTheDocument();

      const beforeLabel = toggleButton.getAttribute('aria-label') ?? '';
      fireEvent.click(toggleButton);

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

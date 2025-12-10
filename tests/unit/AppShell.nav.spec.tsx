import AppShell from '@/app/AppShell';
import { routerFutureFlags } from '@/app/routerFuture';
import { ColorModeContext } from '@/app/theme';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { TESTIDS } from '@/testids';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

const spFetchMock = vi.fn(async (_path: string, _init?: RequestInit) => ({ ok: true }));

const defaultFlags: FeatureFlagSnapshot = {
  schedules: true,
  schedulesCreate: true,
  complianceForm: false,
  schedulesWeekV2: false,
  icebergPdca: false,
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

describe('AppShell navigation', () => {
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

    const navRoot = await screen.findByRole('navigation', { name: /主要ナビゲーション/i });
    const nav = within(navRoot);

    expect(await nav.findByRole('link', { name: '利用者' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: '日次記録' })).not.toHaveAttribute('aria-current');
    expect(nav.getByRole('link', { name: 'スケジュール' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'コンプラ報告' })).toBeNull();

    const currentLinks = nav.getAllByRole('link', { current: 'page' });
    expect(currentLinks).toHaveLength(1);
    expect(currentLinks[0]).toHaveTextContent('利用者');

    // Footer actions should include schedules create when flag is enabled
    const footer = await screen.findByRole('contentinfo');
    const footerWithin = within(footer);
    expect(footerWithin.queryByRole('link', { name: '新規予定' })).toBeNull();

  });

  it('shows Iceberg PDCA nav when flag is enabled', async () => {
    const toggleMock = vi.fn();
    const theme = createTheme();
    const flags: FeatureFlagSnapshot = { ...defaultFlags, icebergPdca: true };
    const getShell = () => (
      <ThemeProvider theme={theme}>
        <FeatureFlagsProvider value={flags}>
          <ColorModeContext.Provider value={{ mode: 'light', toggle: toggleMock, sticky: false }}>
            <AppShell>
              <div />
            </AppShell>
          </ColorModeContext.Provider>
        </FeatureFlagsProvider>
      </ThemeProvider>
    );

    renderWithAppProviders(getShell(), {
      initialEntries: ['/'],
      future: routerFutureFlags,
    });

    expect(await screen.findByTestId(TESTIDS['nav-iceberg-pdca'])).toBeInTheDocument();
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

    const statuses = await screen.findAllByRole('status');
    const hudStatus = statuses.find((node) => node.textContent?.includes('SP Sign-In'));
    expect(hudStatus).toBeDefined();
    expect(hudStatus).toHaveTextContent('SP Sign-In');
    expect(screen.queryByText(/SP Error/i)).toBeNull();
    unmount();
  });
});

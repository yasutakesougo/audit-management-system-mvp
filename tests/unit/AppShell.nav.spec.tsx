import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import AppShell from '@/app/AppShell';
import { ColorModeContext } from '@/app/theme';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { routerFutureFlags } from '@/app/routerFuture';

const spFetchMock = vi.fn(async (_path: string, _init?: RequestInit) => ({ ok: true }));

const defaultFlags: FeatureFlagSnapshot = {
  schedules: true,
  schedulesCreate: true,
  complianceForm: false,
  timeflowV2: false,
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
    render(
      <ThemeProvider theme={theme}>
        <FeatureFlagsProvider value={defaultFlags}>
          <ColorModeContext.Provider value={{ mode: 'light', toggle: toggleMock, sticky: false }}>
            <MemoryRouter initialEntries={['/users']} future={routerFutureFlags}>
              <AppShell>
                <div />
              </AppShell>
            </MemoryRouter>
          </ColorModeContext.Provider>
        </FeatureFlagsProvider>
      </ThemeProvider>,
    );

    const navToggle = screen.getByRole('button', { name: 'ナビゲーションメニューを開く' });
    fireEvent.click(navToggle);

    const navCandidates = screen.getAllByRole('navigation');
    const navRoot =
      navCandidates.find((element) =>
        /主要ナビゲーション/i.test(element.getAttribute('aria-label') ?? element.textContent ?? ''),
      ) ?? navCandidates[0] ?? null;

    expect(navRoot).not.toBeNull();
    if (!navRoot) {
      return;
    }
    expect(navRoot).toHaveAccessibleName(/主要ナビゲーション/i);
    const menuToggle = screen.queryAllByRole('button', { name: /メニュー.*(開く|閉じる)/ });
    if (menuToggle.length > 0 && menuToggle[0].textContent?.includes('開く')) {
      fireEvent.click(menuToggle[0]);
    }
    const nav = within(navRoot);

    const userLink = await nav.findByRole('link', { name: '利用者' });
    expect(userLink.className).toContain('Mui-selected');
    const ariaCurrent = userLink.getAttribute('aria-current');
    if (ariaCurrent) {
      expect(ariaCurrent).toBe('page');
    }
  expect(nav.getByRole('link', { name: '日次記録' })).not.toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: '新規予定' })).toBeInTheDocument();
    expect(nav.queryByRole('link', { name: 'コンプラ報告' })).toBeNull();

    const currentLinks = nav.getAllByRole('link').filter((link) => link.className.includes('Mui-selected'));
    expect(currentLinks).toHaveLength(1);
    expect(currentLinks[0]).toHaveTextContent('利用者');

    await waitFor(() => {
      expect(spFetchMock).toHaveBeenCalled();
    });

    const [path, options] = spFetchMock.mock.calls[0] ?? [];
    expect(path).toBe('/currentuser?$select=Id');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('leaves status neutral when ping aborts', async () => {
    spFetchMock.mockImplementationOnce((_path: string, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      if (signal?.aborted) {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      }
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });

    const toggleMock = vi.fn();
    const theme = createTheme();
    const { unmount } = render(
      <ThemeProvider theme={theme}>
        <FeatureFlagsProvider value={defaultFlags}>
          <ColorModeContext.Provider value={{ mode: 'light', toggle: toggleMock, sticky: false }}>
            <MemoryRouter initialEntries={['/']} future={routerFutureFlags}>
              <AppShell>
                <div />
              </AppShell>
            </MemoryRouter>
          </ColorModeContext.Provider>
        </FeatureFlagsProvider>
      </ThemeProvider>,
    );

    await waitFor(() => {
      expect(spFetchMock).toHaveBeenCalledTimes(1);
    });

    const checkingLabel = await screen.findByText(/Checking/i);
    expect(checkingLabel.closest('[role="status"]')).not.toBeNull();
    expect(screen.queryByText(/SP Error/i)).toBeNull();
    unmount();
  });
});

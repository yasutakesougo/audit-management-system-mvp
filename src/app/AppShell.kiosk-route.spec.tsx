import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AppShell from './AppShell';
import { SettingsProvider } from '@/features/settings';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/settingsModel';
import { ToastProvider } from '@/hooks/useToast';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

vi.mock('@/features/auth/store', async () => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAuthStore: (selector: any) =>
      selector({
        currentUserRole: 'staff',
        setCurrentUserRole: vi.fn(),
      }),
  };
});

function renderAppShell(initialPath: string) {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={[initialPath]}>
        <ToastProvider>
          <SettingsProvider>
            <Routes>
              <Route
                path="*"
                element={
                  <AppShell>
                    <div data-testid="kiosk-route-child">child</div>
                  </AppShell>
                }
              />
            </Routes>
          </SettingsProvider>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppShell kiosk query routing', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('enables kiosk mode when /today?kiosk=1 is opened', async () => {
    renderAppShell('/today?kiosk=1');

    const appShell = screen.getByTestId('app-shell');
    await waitFor(() => {
      expect(appShell).toHaveAttribute('data-kiosk', 'true');
    });

    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
    expect(stored.layoutMode).toBe('kiosk');
  });

  it('disables kiosk mode when /today?kiosk=0 is opened', async () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        layoutMode: 'kiosk',
      }),
    );

    renderAppShell('/today?kiosk=0');

    const appShell = screen.getByTestId('app-shell');
    await waitFor(() => {
      expect(appShell).not.toHaveAttribute('data-kiosk');
    });

    const stored = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}');
    expect(stored.layoutMode).toBe('normal');
  });

  it('enables kiosk mode when /kiosk route is accessed', async () => {
    renderAppShell('/kiosk');

    const appShell = screen.getByTestId('app-shell');
    await waitFor(() => {
      expect(appShell).toHaveAttribute('data-kiosk', 'true');
    });
  });
});


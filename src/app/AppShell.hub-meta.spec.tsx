import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AppShell from './AppShell';
import { SettingsProvider } from '@/features/settings';
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
                    <div data-testid="hub-meta-child">child</div>
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

describe('AppShell hub metadata sync', () => {
  beforeEach(() => {
    localStorage.clear();
    document.title = '';
  });

  it('syncs title, breadcrumb metadata, and analytics event from hubDefinitions', async () => {
    const received: CustomEvent[] = [];
    const handler = (event: Event) => {
      received.push(event as CustomEvent);
    };
    window.addEventListener('app:hub-route-change', handler as EventListener);

    renderAppShell('/planning');

    await waitFor(() => {
      expect(document.title).toBe('Planning | クロノート Link');
    });

    expect(received.length).toBeGreaterThan(0);
    expect(received.at(-1)?.detail).toMatchObject({
      hubId: 'planning',
      telemetryName: 'hub_planning_view',
      analyticsName: 'hub_planning',
      pathname: '/planning',
    });

    window.removeEventListener('app:hub-route-change', handler as EventListener);
  });

  it('falls back to app title when pathname is outside hub definitions', async () => {
    renderAppShell('/dashboard');

    await waitFor(() => {
      expect(document.title).toBe('クロノート Link');
    });

    const appShell = screen.getByTestId('app-shell');
    expect(appShell).not.toHaveAttribute('data-current-hub');
    expect(appShell).not.toHaveAttribute('data-hub-telemetry');
    expect(appShell).not.toHaveAttribute('data-hub-analytics');
  });
});

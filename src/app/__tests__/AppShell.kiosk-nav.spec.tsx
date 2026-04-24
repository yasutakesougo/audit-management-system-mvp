import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AppShell from '../AppShell';
import { SettingsProvider } from '@/features/settings';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/settingsModel';
import { ToastProvider } from '@/hooks/useToast';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({ role: 'staff', ready: true }),
}));

vi.mock('@/features/auth/store', async () => ({
  useAuthStore: (selector: any) =>
    selector({
      currentUserRole: 'staff',
      setCurrentUserRole: vi.fn(),
    }),
}));

vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => true, // Force desktop for sidebar visibility
}));

vi.mock('@/config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/featureFlags')>();
  return {
    ...actual,
    useFeatureFlags: () => ({
      schedules: true,
      complianceForm: false,
      schedulesWeekV2: false,
      icebergPdca: false,
      staffAttendance: true,
      todayOps: true,
      todayLiteUi: false,
      todayLiteNavV2: true, // Enable Lite Nav for Tier testing
    }),
    useFeatureFlag: () => false,
  };
});

function renderAppShell(settingsOverrides: any = {}) {
  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify({
      ...DEFAULT_SETTINGS,
      ...settingsOverrides,
    }),
  );

  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={['/today']}>
        <ToastProvider>
          <SettingsProvider>
            <Routes>
              <Route
                path="*"
                element={
                  <AppShell>
                    <div data-testid="child">child</div>
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

describe('AppShell Navigation OS integration (Logical Filtering)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('respects User Hidden Groups preference in Normal mode', async () => {
    renderAppShell({ 
      layoutMode: 'normal',
      hiddenNavGroups: ['master'] // Hide Master group
    });

    // Sidebar should be present
    expect(screen.getByTestId('nav-drawer')).toBeInTheDocument();

    // Today/Records should remain
    expect(screen.getByText('日次記録')).toBeInTheDocument();

    // Master group (利用者) should be hidden by Navigation OS helper
    expect(screen.queryByText('利用者')).not.toBeInTheDocument();
  });

  it('hides more-tier items when showMoreNavItems is false (todayLiteNavV2=true)', () => {
    // Note: showMoreNavItems is false by default in useAppShellState
    renderAppShell({ layoutMode: 'normal' });

    // '議事録' is a 'more' tier item for staff
    expect(screen.queryByText('議事録')).not.toBeInTheDocument();
  });

  it('hides sidebar entirely in Focus mode (Integration check)', () => {
    renderAppShell({ layoutMode: 'focus' });
    expect(screen.queryByTestId('nav-drawer')).not.toBeInTheDocument();
  });

  it('strictly hides admin-only items from staff role (RBAC isolation)', () => {
    // Note: mockRole in useUserAuthz is 'staff' globally in this file
    renderAppShell({ layoutMode: 'normal' });

    // '管理ツール' is admin-only (audience: admin)
    expect(screen.queryByText('管理ツール')).not.toBeInTheDocument();
    
    // Core staff functionality should remain
    expect(screen.getByText('日次記録')).toBeInTheDocument();
  });
});

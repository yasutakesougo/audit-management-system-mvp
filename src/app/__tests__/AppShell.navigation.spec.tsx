import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppShell from '@/app/AppShell';
import { SettingsProvider } from '@/features/settings';
import { ToastProvider } from '@/hooks/useToast';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

let mockRole: 'viewer' | 'reception' | 'admin' = 'viewer';

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({ role: mockRole, ready: true }),
}));

vi.mock('@/features/auth/store', async () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAuthStore: (selector: any) =>
    selector({
      currentUserRole: 'staff',
      setCurrentUserRole: vi.fn(),
    }),
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
      todayLiteNavV2: true,
    }),
    useFeatureFlag: () => false,
  };
});

vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => true,
}));

function renderShell() {
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
                    <div>content</div>
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

describe('AppShell navigation exposure', () => {
  // Verify that certain items are correctly hidden when todayLiteNavV2 is enabled for non-admin users.
  it('hides analysis/ops/exceptions/handoff-analysis for viewer when todayLiteNavV2 is on', () => {
    mockRole = 'viewer';
    renderShell();

    expect(screen.queryByText('行動分析')).not.toBeInTheDocument();
    expect(screen.queryByText('運用メトリクス')).not.toBeInTheDocument();
    expect(screen.queryByText('例外センター')).not.toBeInTheDocument();
    expect(screen.queryByText('申し送り分析')).not.toBeInTheDocument();
  });

  it('shows core navigation within 6 items for viewer', () => {
    mockRole = 'viewer';
    renderShell();

    const coreNavItems = screen.getAllByTestId(/^core-nav-item-/);
    expect(coreNavItems.length).toBeLessThanOrEqual(6);
  });

  it('shows more navigation when expanded', async () => {
    mockRole = 'viewer';
    renderShell();

    const moreButton = screen.getByRole('button', { name: 'Moreを開く' });
    expect(moreButton).toBeInTheDocument();
    fireEvent.click(moreButton);

    expect(await screen.findByText('議事録')).toBeInTheDocument();
  });

  it('keeps admin tier visible for admin role', () => {
    mockRole = 'admin';
    renderShell();

    expect(screen.getByText('運用メトリクス')).toBeInTheDocument();
  });
});

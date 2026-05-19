import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
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
  beforeEach(() => {
    localStorage.clear();
    mockRole = 'viewer';
  });

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

    const moreButton = screen.getByRole('button', { name: 'その他のメニューを開く' });
    expect(moreButton).toBeInTheDocument();
    fireEvent.click(moreButton);

    expect(await screen.findByText('議事録')).toBeInTheDocument();
  });

  it('keeps admin tier visible for admin role', () => {
    mockRole = 'admin';
    renderShell();

    expect(screen.getByText('運用メトリクス')).toBeInTheDocument();
  });

  it('allows toggling more navigation items even when sidebar is collapsed', async () => {
    mockRole = 'viewer';
    renderShell();

    // 1. Collapse the sidebar
    const collapseButton = screen.getByRole('button', { name: 'ナビを折りたたみ' });
    expect(collapseButton).toBeInTheDocument();
    fireEvent.click(collapseButton);

    // Verify sidebar collapsed button tooltip or aria-label changes to 'ナビを展開'
    expect(screen.getByRole('button', { name: 'ナビを展開' })).toBeInTheDocument();

    // 2. Find and click the 'More' button (rendered as an IconButton when collapsed)
    const moreIconButton = screen.getByRole('button', { name: 'その他のメニューを開く' });
    expect(moreIconButton).toBeInTheDocument();
    fireEvent.click(moreIconButton);

    // More item should now be visible (by testid, since label text is hidden in collapsed sidebar)
    expect(await screen.findByTestId('more-nav-item-議事録')).toBeInTheDocument();

    // 3. Click again to collapse the 'More' items
    fireEvent.click(moreIconButton);
    expect(screen.queryByTestId('more-nav-item-議事録')).not.toBeInTheDocument();
  });
});

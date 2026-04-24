import SupportPlanGuidePage from '@/pages/SupportPlanGuidePage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocking dependencies to isolate the permission logic
vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: vi.fn(),
}));

vi.mock('@/auth/roles', () => ({
  canAccess: (role: string, target: string) => {
    if (target === 'admin') return role === 'admin';
    if (target === 'viewer') return true;
    return false;
  },
}));

vi.mock('@/features/users/store', () => ({
  useUsersStore: () => ({ data: [] }),
}));

vi.mock('@/hydration/features', () => ({
  HYDRATION_FEATURES: { supportPlanGuide: { markdown: 'spg-markdown', draftLoad: 'spg-draft' } },
  estimatePayloadSize: () => 0,
  startFeatureSpan: () => vi.fn(),
}));

// Disable idle prefetch side effects to keep this permission test deterministic.
vi.mock('@/utils/runOnIdle', () => ({
  runOnIdle: () => 0,
  cancelIdle: () => undefined,
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/support-plan-guide', search: '' }),
  useNavigate: () => vi.fn(),
  // muiLink.ts imports `Link` — provide a stub to prevent unhandled import error
  Link: vi.fn().mockImplementation(({ children, ..._props }: Record<string, unknown>) => children),
}));

// Mock MUI components or hooks that might cause issues in JSDOM
vi.mock('@mui/material/useMediaQuery', () => ({
  default: () => true,
}));

// Mocking Markdown preview and other expensive components
vi.mock('@/components/MarkdownPreview', () => ({
  default: () => <div data-testid="markdown-preview">Markdown</div>,
}));

import { useUserAuthz } from '@/auth/useUserAuthz';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('SupportPlanGuidePage Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage for JSDOM
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    });
  });

  it('displays a read-only alert and disables inputs for viewer role', async () => {
    vi.mocked(useUserAuthz).mockReturnValue({ role: 'viewer', ready: true });

    render(<SupportPlanGuidePage />, { wrapper: createWrapper() });

    // Check for the informational alert
    expect(screen.getByText(/このページは閲覧のみです/)).toBeInTheDocument();

    // Wait for lazy-loaded tab to render, then check inputs are disabled
    const inputs = await screen.findAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).toBeDisabled();
    });
  });

  it('does not display alert and enables inputs for admin role', async () => {
    vi.mocked(useUserAuthz).mockReturnValue({ role: 'admin', ready: true });

    render(<SupportPlanGuidePage />, { wrapper: createWrapper() });

    // Check alert is NOT there
    expect(screen.queryByText(/このページは閲覧のみです/)).not.toBeInTheDocument();

    // Wait for lazy-loaded tab to render, then check inputs are enabled
    const inputs = await screen.findAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).not.toBeDisabled();
    });
  });

  it('guarded buttons are disabled or hidden for non-admin on the monitoring tab', async () => {
    vi.mocked(useUserAuthz).mockReturnValue({ role: 'viewer', ready: true });

    render(<SupportPlanGuidePage />, { wrapper: createWrapper() });

    // Switch to Operations (運用・実行) tab group first
    const operationsTabGroup = await screen.findByRole('tab', { name: /運用・実行/ });
    fireEvent.click(operationsTabGroup);

    // Switch to Monitoring tab
    const monitoringTab = await screen.findByRole('tab', { name: /モニタリング/ });
    fireEvent.click(monitoringTab);

    // Monitoring CTA label can vary by flow and may be hidden entirely for viewer role.
    await waitFor(() => {
      const guardedButton =
        screen.queryByRole('button', { name: /本日を記録/i }) ??
        screen.queryByRole('button', { name: /記録を入力する/i }) ??
        screen.queryByRole('button', { name: /内容を確認する/i }) ??
        screen.queryByRole('button', { name: /見直し提案を確認/i });
      if (guardedButton) {
        expect(guardedButton).toBeDisabled();
        return;
      }
      expect(screen.getByText(/このページは閲覧のみです/)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

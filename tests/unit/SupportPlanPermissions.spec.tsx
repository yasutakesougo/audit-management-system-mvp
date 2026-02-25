import SupportPlanGuidePage from '@/pages/SupportPlanGuidePage';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/support-plan-guide', search: '' }),
  useNavigate: () => vi.fn(),
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

describe('SupportPlanGuidePage Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays a read-only alert and disables inputs for viewer role', async () => {
    (useUserAuthz as any).mockReturnValue({ role: 'viewer', ready: true });

    render(<SupportPlanGuidePage />);

    // Check for the informational alert
    expect(screen.getByText(/このページは閲覧のみです/)).toBeInTheDocument();

    // Check that text fields are disabled (we check the one for lastMonitoringDate as a sample)
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).toBeDisabled();
    });
  });

  it('does not display alert and enables inputs for admin role', async () => {
    (useUserAuthz as any).mockReturnValue({ role: 'admin', ready: true });

    render(<SupportPlanGuidePage />);

    // Check alert is NOT there
    expect(screen.queryByText(/このページは閲覧のみです/)).not.toBeInTheDocument();

    // Check that inputs are NOT disabled
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach(input => {
      expect(input).not.toBeDisabled();
    });
  });

  it('guarded buttons are disabled for non-admin on the monitoring tab', async () => {
    const user = userEvent.setup();
    (useUserAuthz as any).mockReturnValue({ role: 'viewer', ready: true });

    render(<SupportPlanGuidePage />);

    // Switch to Monitoring tab
    const monitoringTab = screen.getByRole('tab', { name: /モニタリング/ });
    await user.click(monitoringTab);

    // Check '本日を記録' button in the Monitoring tab
    const todayBtn = await screen.findByText(/本日を記録/i);
    expect(todayBtn.closest('button')).toBeDisabled();
  });
});

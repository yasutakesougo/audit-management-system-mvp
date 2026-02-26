import NavigationDiagnosticsPage from '@/pages/admin/NavigationDiagnosticsPage';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock the diagnostics engine so we can control what the UI renders
vi.mock('@/app/navigation/diagnostics/navigationDiagnostics', () => ({
  computeNavigationDiagnostics: vi.fn(() => ({
    counts: {
      routerPaths: 10,
      sideNavItems: 5,
      footerItems: 3,
      missingInRouter: 1,
      orphanRoutes: 2,
    },
    navItemsFlat: [
      { label: 'Mock Dashboard', href: '/dashboard', visible: true, reason: 'Staff' }
    ],
    footerItemsFlat: [
      { label: 'Mock Footer Action', href: '/support', reason: 'Common' }
    ],
    missingInRouter: ['/fake/missing'],
    orphanRoutes: ['/fake/orphan1', '/fake/orphan2'],
    allowlistedOrphans: ['/users/:id'],
  })),
}));

// Provide the APP_ROUTE_PATHS explicitly since we iterate over them
vi.mock('@/app/routes/appRoutePaths', () => ({
  APP_ROUTE_PATHS: ['/dashboard', '/users', '/fake/orphan1', '/fake/orphan2']
}));

describe('NavigationDiagnosticsPage', () => {

  it('renders the summary dashboard by default', () => {
    render(<NavigationDiagnosticsPage />);

    // Assert main title
    expect(screen.getByText(/ナビ診断/i)).toBeInTheDocument();

    // Assert counts passed from mock are visible
    expect(screen.getByText('10')).toBeInTheDocument(); // Router paths
    expect(screen.getByText('5')).toBeInTheDocument(); // Side Nav items
    expect(screen.getByText('3')).toBeInTheDocument(); // Footer items

    // Assert error state panels are visible because > 0
    expect(screen.getByText(/Nav 👉 Router 不整合/i)).toBeInTheDocument();
    expect(screen.getByText('/fake/missing')).toBeInTheDocument();

    expect(screen.getByText(/Router 👉 Nav 幽霊ルート/i)).toBeInTheDocument();
    expect(screen.getByText('/fake/orphan1')).toBeInTheDocument();
  });

  it('can switch flags and roles (state tests)', () => {
    // Basic test to ensure it renders without crashing when interacting
    render(<NavigationDiagnosticsPage />);

    // Switch to Staff role
    const staffRadio = screen.getByLabelText('Staff');
    fireEvent.click(staffRadio);
    expect(staffRadio).toBeChecked();

    // Toggle a feature flag
    const schedulesSwitch = screen.getByLabelText('schedules');
    fireEvent.click(schedulesSwitch);
    expect(schedulesSwitch).not.toBeChecked(); // Since initial state is true
  });

  it('renders matrix tab data', () => {
    render(<NavigationDiagnosticsPage />);

    // Click on Matrix Tab
    const matrixTab = screen.getByRole('tab', { name: /露出マトリクス/i });
    fireEvent.click(matrixTab);

    // Verify side nav mock data renders
    expect(screen.getByText('Mock Dashboard')).toBeInTheDocument();

    // Scoped check for reason columns to avoid picking up the radio group labels
    const rows = screen.getAllByRole('row');
    const mockRow = rows.find(r => r.textContent?.includes('Mock Dashboard'));
    expect(within(mockRow as HTMLElement).getByText('Staff')).toBeInTheDocument();

    // Verify footer action mock data renders
    expect(screen.getByText('Mock Footer Action')).toBeInTheDocument();
    expect(screen.getByText('Common')).toBeInTheDocument();
  });

  it('renders router tab source of truth', () => {
    render(<NavigationDiagnosticsPage />);

    // Click on Router Tab
    const routerTab = screen.getByRole('tab', { name: /ルーターパス/i });
    fireEvent.click(routerTab);

    // Verify path from the mocked APP_ROUTE_PATHS is present
    expect(screen.getByText('/dashboard')).toBeInTheDocument();

    // And verify the orphan badge rendering works based on the logic
    const row = screen.getByText('/fake/orphan1').closest('tr');
    expect(within(row as HTMLElement).getByText('Orphan')).toBeInTheDocument();
  });
});

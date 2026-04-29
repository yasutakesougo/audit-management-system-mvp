import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { StaffAttendanceInputPage } from '@/pages/StaffAttendanceInputPage';
import { screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

vi.mock('@/features/staff/attendance/StaffAttendanceInput', () => ({
  StaffAttendanceInput: () => <div data-testid="mock-staff-attendance-input" />,
}));

vi.mock('@/features/staff/attendance/hooks/useStaffAttendanceDay', () => ({
  useStaffAttendanceDay: () => ({
    items: [],
    isLoading: false,
    error: null,
    reload: vi.fn(),
    storageKind: 'local',
  }),
}));

vi.mock('@/stores/useStaff', () => ({
  useStaff: () => ({
    staff: [],
    isLoading: false,
  }),
}));

const baseFlags: FeatureFlagSnapshot = {
  schedules: false,
  complianceForm: false,
  schedulesWeekV2: false,
  icebergPdca: false,
  staffAttendance: false,
  todayOps: false,
  todayLiteUi: false,
  todayLiteNavV2: false,
};

const renderRoute = (flags: FeatureFlagSnapshot) =>
  renderWithAppProviders(<div />, {
    initialEntries: ['/staff/attendance'],
    routeChildren: [
      {
        path: 'staff/attendance',
        element: (
          <FeatureFlagsProvider value={flags}>
            <StaffAttendanceInputPage />
          </FeatureFlagsProvider>
        ),
      },
    ],
  });

describe('staff attendance route contract', () => {
  it('shows read-only view when flag is disabled', async () => {
    renderRoute(baseFlags);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('staff-attendance-readonly-root')).toBeInTheDocument();
  });

  it('shows input when flag is enabled', async () => {
    renderRoute({ ...baseFlags, staffAttendance: true });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('staff-attendance-input-root')).toBeInTheDocument();
    expect(screen.queryByTestId('staff-attendance-empty-state')).toBeNull();
  });
});

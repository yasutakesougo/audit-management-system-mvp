import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { StaffAttendanceInputPage } from '@/pages/StaffAttendanceInputPage';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

const baseFlags: FeatureFlagSnapshot = {
  schedules: false,
  complianceForm: false,
  schedulesWeekV2: false,
  icebergPdca: false,
  staffAttendance: false,
  todayOps: false,
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
  it('shows empty state when flag is disabled', () => {
    renderRoute(baseFlags);
    expect(screen.getByTestId('staff-attendance-empty-state')).toBeInTheDocument();
  });

  it('shows input when flag is enabled', () => {
    renderRoute({ ...baseFlags, staffAttendance: true });
    expect(screen.getByTestId('staff-attendance-input-root')).toBeInTheDocument();
    expect(screen.queryByTestId('staff-attendance-empty-state')).toBeNull();
  });
});

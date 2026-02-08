import { test } from '@playwright/test';
import { bootstrapDashboard } from './utils/bootstrapApp';
import { expectTestIdVisibleBestEffort } from './_helpers/smoke';

test.describe('staff attendance input smoke', () => {
  test('renders input UI when flag is enabled', async ({ page }) => {
    await bootstrapDashboard(page, {
      skipLogin: true,
      featureStaffAttendance: true,
      initialPath: '/staff/attendance',
    });

    await expectTestIdVisibleBestEffort(page, 'staff-attendance-input-root');
  });
});

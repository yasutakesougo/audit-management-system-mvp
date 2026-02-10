import '@/test/captureSp400';
import { expect, test } from '@playwright/test';

import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoScheduleWeek } from './utils/scheduleWeek';
import { waitForWeekViewReady } from './utils/wait';

test.describe('Schedule week lanes', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapScheduleEnv(page);
  });

  test('shows 3 lanes (User/Staff/Org)', async ({ page }) => {
    await gotoScheduleWeek(page, new Date('2025-11-24'));
    await waitForWeekViewReady(page);

    await expect(page.getByTestId('schedules-week-lane-User')).toBeVisible();
    await expect(page.getByTestId('schedules-week-lane-Staff')).toBeVisible();
    await expect(page.getByTestId('schedules-week-lane-Org')).toBeVisible();
  });
});

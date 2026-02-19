import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';

import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoScheduleWeek } from './utils/scheduleWeek';
import { waitForWeekViewReady } from './utils/wait';

const skipSp = process.env.VITE_SKIP_SHAREPOINT === '1' || process.env.VITE_FEATURE_SCHEDULES_SP === '0';

test.describe('Schedule week lanes', () => {
  test.skip(skipSp, 'SharePoint/SP disabled in this run');
  test.beforeEach(async ({ page }) => {
    await bootstrapScheduleEnv(page);
  });

  test('shows 3 lanes (User/Staff/Org)', async ({ page }) => {
    await gotoScheduleWeek(page, new Date('2025-11-24'));
    await waitForWeekViewReady(page);

    const emptyState = page.getByTestId(TESTIDS.SCHEDULE_WEEK_EMPTY);
    if (await emptyState.isVisible().catch(() => false)) {
      test.skip(true, 'No schedules available for lane validation.');
    }

    await expect(page.getByTestId('schedules-week-lane-User')).toBeVisible();
    await expect(page.getByTestId('schedules-week-lane-Staff')).toBeVisible();
    await expect(page.getByTestId('schedules-week-lane-Org')).toBeVisible();
  });
});

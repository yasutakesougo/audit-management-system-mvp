import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootSchedule } from './_helpers/bootSchedule';
import { gotoDay } from './utils/scheduleNav';
import { waitForDayTimeline } from './utils/wait';

test.describe('Schedule day – smoke', () => {
  test.beforeEach(async ({ page }) => {
    await bootSchedule(page);
  });

  test('renders the day timeline with tabs and basic chrome', async ({ page }) => {
    await gotoDay(page, new Date('2025-11-24'));
    await waitForDayTimeline(page);

    const root = page.getByTestId(TESTIDS['schedules-day-page']).first();

    const tablist = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TABLIST).first();
    await expect(tablist).toBeVisible();

    const dayTab = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY).first();
    const weekTab = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK).first();
    await expect(dayTab).toBeVisible();
    await expect(weekTab).toBeVisible();

    await expect(root).toBeVisible();
  });
});

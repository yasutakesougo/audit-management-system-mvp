/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright helpers live outside the main tsconfig include set.
import { expect, test } from '@playwright/test';

import { TESTIDS } from '@/testids';

import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoScheduleWeek } from './utils/scheduleWeek';
import { gotoDay, gotoMonth } from './utils/scheduleNav';
import { waitForWeekViewReady } from './utils/wait';


test.describe('Schedule week -> day lane', () => {
  const ensureFilterVisible = async (page: import('@playwright/test').Page) => {
    const categorySelect = page.getByTestId(TESTIDS['schedules-filter-category']);
    if (await categorySelect.isVisible().catch(() => false)) {
      return categorySelect;
    }

    const filterToggle = page.getByTestId(TESTIDS.SCHEDULES_FILTER_TOGGLE);
    if ((await filterToggle.count()) > 0) {
      await filterToggle.click();
    }

    await expect(categorySelect).toBeVisible();
    return categorySelect;
  };

  test('preserves selected lane when switching to day view', async ({ page }) => {
    const targetDate = new Date('2026-01-27');
    const fixtures = [
      {
        id: 'org-lane-seed',
        title: 'Org lane smoke',
        category: 'Org',
        start: '2026-01-27T09:00:00.000Z',
        end: '2026-01-27T10:00:00.000Z',
        status: 'Planned',
      },
    ];

    await bootstrapScheduleEnv(page, {
      storage: { 'e2e:schedules.v1': JSON.stringify(fixtures) },
    });

    await gotoScheduleWeek(page, targetDate);
    await waitForWeekViewReady(page);

    const weekCategorySelect = await ensureFilterVisible(page);
    await weekCategorySelect.click();
    await page.getByRole('option', { name: '施設' }).click();
    await expect(weekCategorySelect).toContainText('施設');

    const filterDialog = page.getByTestId('schedules-filter-dialog');
    if (await filterDialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(filterDialog).toBeHidden({ timeout: 10_000 });
    }

    // The week view no longer exposes a day tab. Use the date/detail lane instead:
    // open the month calendar for the selected date, then use its day popover.
    await gotoMonth(page, targetDate, { searchParams: { cat: 'Org' } });
    await expect(page.getByTestId(TESTIDS.SCHEDULES_MONTH_PAGE)).toBeVisible();
    const dayCell = page.getByTestId('schedules-month-day-2026-01-27');
    await expect(dayCell).toHaveCount(1);
    await dayCell.click();
    const drawerItem = page.getByRole('heading', { name: 'Org lane smoke', exact: true });
    await expect(drawerItem).toBeVisible();
    await drawerItem.click();
    await expect(page.getByRole('dialog').getByText('Org lane smoke', { exact: true })).toBeVisible();
    await page.getByTestId('schedule-view-close').click();

    // The detail drawer confirms the selected date/lane before the supported day URL is opened.
    await gotoDay(page, targetDate, { searchParams: { cat: 'Org' } });
    await expect(page).toHaveURL(/\/schedules\/week\?.*tab=day/);
    await expect(page.getByTestId(TESTIDS['schedules-day-page'])).toBeVisible();
    const categorySelect = await ensureFilterVisible(page);
    await expect(categorySelect).toContainText('施設');
  });
});

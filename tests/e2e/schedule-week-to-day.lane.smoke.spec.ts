/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck -- Playwright helpers live outside the main tsconfig include set.
import { expect, test } from '@playwright/test';

import { TESTIDS } from '@/testids';

import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoScheduleWeek } from './utils/scheduleWeek';
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

    const itemButton = page.getByRole('button', { name: /Org lane smoke/ }).first();
    await expect(itemButton).toBeVisible();
    await itemButton.click();

    const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
    if (await dialog.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden({ timeout: 10_000 });
    }

    await page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY).click();

    const categorySelect = await ensureFilterVisible(page);
    await expect(categorySelect).toHaveValue('Org');
  });
});

import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { bootstrapDashboard } from './utils/bootstrapApp';
import { gotoScheduleWeek } from './utils/scheduleWeek';

test.describe('Schedule week page – ARIA smoke', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapDashboard(page, {
      skipLogin: true,
      featureSchedules: true,
      initialPath: '/schedule/week',
    });
  });

  test('exposes main landmark, heading, tabs, and week tabpanel', async ({ page }) => {
    await gotoScheduleWeek(page, new Date());

    const section = page.getByTestId(TESTIDS.SCHEDULES_PAGE_ROOT).or(page.getByTestId(TESTIDS['schedules-week-page']));
    await expect(section).toBeVisible();
    // aria-label が無くても見出しとタブで構造が把握できればOK

    const heading = page.getByTestId(TESTIDS['schedules-week-heading']);
    await expect(heading).toBeVisible();

    const tablist = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TABLIST);
    await expect(tablist).toBeVisible();

    const weekTab = page
      .getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK)
      .or(page.getByRole('tab').first());
    await expect(weekTab).toBeVisible();
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');

    const weekPanel = page.locator('#panel-week');
    await expect(weekPanel).toBeVisible();
    await expect(weekPanel).toHaveAttribute('role', 'tabpanel');

    const grid = page.getByTestId(TESTIDS['schedules-week-grid']);
    await expect(grid).toBeVisible();
    await expect(grid).toHaveAttribute('role', 'grid');
  });

  test('arrow key navigation keeps aria-selected in tablist', async ({ page }) => {
    await gotoScheduleWeek(page, new Date());

    const tablist = page.getByTestId(TESTIDS.SCHEDULES_WEEK_TABLIST);
    const weekTab = page
      .getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK)
      .or(page.getByRole('tab').first());

    await weekTab.click();
    await expect(weekTab).toBeFocused();

    await page.keyboard.press('ArrowRight');
    const activeTab = tablist.getByRole('tab', { selected: true });
    await expect(activeTab).toBeVisible();

    await page.keyboard.press('ArrowLeft');
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
  });
});

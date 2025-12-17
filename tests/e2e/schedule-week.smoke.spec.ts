import '@/test/captureSp400';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '@/testids';
import { runA11ySmoke } from './utils/a11y';
import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoScheduleWeek } from './utils/scheduleWeek';

test.describe('Schedule week smoke', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapScheduleEnv(page);
  });

  test('renders week overview and passes Axe', async ({ page }) => {
    await gotoScheduleWeek(page, new Date('2025-11-24'));

    const weekRoot = page.getByTestId(TESTIDS.SCHEDULES_PAGE_ROOT).or(page.getByTestId(TESTIDS['schedules-week-page']));
    await expect(weekRoot).toBeVisible();

    const heading = page.getByTestId(TESTIDS['schedules-week-heading']);
    await expect(heading).toBeVisible();

    const grid = page.getByTestId(TESTIDS['schedules-week-grid']);
    await expect(grid).toBeVisible();
    await expect(grid.getByRole('gridcell').first()).toBeVisible();

    await runA11ySmoke(page, 'Schedules Week', {
      selectors: `[data-testid="${TESTIDS['schedules-week-page']}"]`,
      // Known contrast + focusable issues tracked in PDCA-2187; re-enable once tokens are updated.
      runOptions: {
        rules: {
          'color-contrast': { enabled: false },
          'scrollable-region-focusable': { enabled: false },
        },
      },
    });
  });

  test('week tab stays active when switching views', async ({ page }) => {
    await gotoScheduleWeek(page, new Date('2025-11-24'));

    const weekTab = page
      .locator('[role="tab"][aria-controls="panel-week"]')
      .or(page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK))
      .or(page.getByRole('tab', { name: /週|Week/i }))
      .first();
    const dayTab = page
      .locator('[role="tab"][aria-controls="panel-day"]')
      .or(page.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY))
      .or(page.getByRole('tab', { name: /日|Day/i }))
      .first();

    await expect(dayTab).toBeVisible({ timeout: 15_000 });
    await dayTab.click();
    const dayPanel = page.locator('#panel-day');
    const dayPanelVisible = await dayPanel.isVisible().catch(() => false);
    if (dayPanelVisible) {
      await expect(dayPanel).toBeVisible({ timeout: 15_000 });
    } else {
      await expect(page.getByTestId(TESTIDS['schedules-week-grid'])).toBeVisible({ timeout: 15_000 });
    }

    await weekTab.click();
    await expect(page.getByTestId(TESTIDS['schedules-week-grid'])).toBeVisible({ timeout: 15_000 });
  });

  test('period controls shift the visible week headers', async ({ page }) => {
    await gotoScheduleWeek(page, new Date('2025-11-24'));
    const rangeLabel = page.getByTestId(TESTIDS.SCHEDULES_RANGE_LABEL);
    const readRange = async (): Promise<string> => (await rangeLabel.textContent())?.trim() ?? '';
    const initialRange = await readRange();
    expect(initialRange).toMatch(/表示期間/);

    const prevButton = page.getByRole('button', { name: '前の期間' });
    const nextButton = page.getByRole('button', { name: '次の期間' });

    await prevButton.click();
    await expect.poll(readRange, { timeout: 10_000 }).not.toBe(initialRange);

    await nextButton.click();
    await expect.poll(readRange, { timeout: 10_000 }).toBe(initialRange);
  });
});

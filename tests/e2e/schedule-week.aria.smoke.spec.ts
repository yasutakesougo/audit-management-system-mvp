import { expect, test } from '@playwright/test';
import { gotoWeek } from './utils/scheduleNav';

test.describe('Schedule week page – ARIA smoke', () => {
  test('exposes main landmark, heading, tabs, and week tabpanel', async ({ page }) => {
    await gotoWeek(page, new Date());

    const main = page.getByRole('main');
    await expect(main).toBeVisible();

    const heading = main.getByRole('heading', { level: 1, name: /スケジュール/ });
    await expect(heading).toBeVisible();

    const tablist = main.getByRole('tablist');
    await expect(tablist).toBeVisible();

    const weekTab = tablist.getByRole('tab', { name: /週/ });
    await expect(weekTab).toBeVisible();
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');

    const weekGridHeader = page.locator('[id^="timeline-week-header-"]').first();
    await expect(weekGridHeader).toBeVisible();
  });

  test('arrow key navigation keeps aria-selected in tablist', async ({ page }) => {
    await gotoWeek(page, new Date());

    const tablist = page.getByRole('tablist');
    const weekTab = tablist.getByRole('tab', { name: /週/ });

    await weekTab.click();
    await expect(weekTab).toBeFocused();

    await page.keyboard.press('ArrowRight');
    const activeTab = tablist.getByRole('tab', { selected: true });
    await expect(activeTab).toBeVisible();

    await page.keyboard.press('ArrowLeft');
    await expect(weekTab).toHaveAttribute('aria-selected', 'true');
  });
});

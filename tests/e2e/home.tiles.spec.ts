import { expect, test } from '@playwright/test';

test.describe('Home navigation tiles', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('skipLogin', '1');
        window.localStorage.setItem('feature:schedules', '1');
      } catch {
        // ignore storage errors
      }
    });
  });

  test('Schedule tile opens /schedules/week and highlights nav', async ({ page }) => {
    await page.goto('/');

    const scheduleTile = page.getByTestId('home-tile-schedules-week');
    await expect(scheduleTile).toBeVisible();
    await scheduleTile.click();

    await expect(page).toHaveURL(/\/schedules\/week/);

    const bottomNav = page.getByTestId('app-bottom-nav');
    const bottomCurrent = bottomNav.getByRole('link', { name: /スケジュール/ });
    await expect(bottomCurrent).toHaveAttribute('aria-current', 'page');

    await page.getByRole('button', { name: 'ナビゲーションメニューを開く' }).click();

    const sideNav = page.getByRole('navigation', { name: '主要ナビゲーション', exact: true });
    const sideCurrent = sideNav.getByRole('link', { name: /スケジュール/ });
    await expect(sideCurrent).toHaveAttribute('aria-current', 'page');
  });

  test('Daily tile routes to /daily', async ({ page }) => {
    await page.goto('/');

    const dailyTile = page.getByTestId('home-tile-daily');
    await expect(dailyTile).toBeVisible();
    await dailyTile.click();

    await expect(page).toHaveURL(/\/daily(\/|$)/);
  });
});

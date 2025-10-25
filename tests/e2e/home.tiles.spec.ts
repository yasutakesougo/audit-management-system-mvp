import { expect, test } from '@playwright/test';

import { bootstrapTestEnv } from './support/bootstrapTestEnv';
import { routes, testids } from './support/selectors';
import { waitForAppReady } from './support/wait';

test.describe('Home navigation tiles', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapTestEnv(page, { flags: { schedules: true, records: true } });
  });

  test('Schedule tile opens /schedules/week and loads schedule shell', async ({ page }) => {
    await page.goto(routes.home);
    await waitForAppReady(page);
    await expect.poll(async () => page.evaluate(() => (window as any).__prefetchCount ?? 0)).toBeGreaterThan(0);

    const keys = await page.evaluate(() => (window as any).__prefetchKeys ?? []);
    expect(keys).toEqual(expect.arrayContaining(['route:schedules', 'route:records']));

    const scheduleTile = page.getByTestId(testids.homeTileSchedulesWeek);
    await expect(scheduleTile).toBeVisible();
    await scheduleTile.click();

    // bottom-nav はホーム限定。遷移先では URL と見出しで確認する
    await expect(page).toHaveURL(/\/schedules\/week/);
    await expect(page.getByTestId(testids.scheduleHeading)).toBeVisible();
  });

  test('Daily tile routes to /daily', async ({ page }) => {
    await page.goto(routes.home);
    await waitForAppReady(page);
    await expect.poll(async () => page.evaluate(() => (window as any).__prefetchCount ?? 0)).toBeGreaterThan(0);

    const dailyTile = page.getByTestId(testids.homeTileDaily);
    await expect(dailyTile).toBeVisible();
    await dailyTile.click();

    await expect(page).toHaveURL(/\/daily(\/|$)/);
  });
});

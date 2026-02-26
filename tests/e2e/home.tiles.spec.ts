import { expect, test } from '@playwright/test';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';
import { TESTIDS } from '../../src/testids';

test.describe('Dashboard smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const globalWithEnv = window as typeof window & { __ENV__?: Record<string, string> };
      globalWithEnv.__ENV__ = {
        ...(globalWithEnv.__ENV__ ?? {}),
        VITE_E2E_MSAL_MOCK: '1',
        VITE_SKIP_LOGIN: '1',
        VITE_DEMO_MODE: '0',
      };
      try {
        window.localStorage.setItem('skipLogin', '1');
        window.localStorage.setItem('demo', '0');
      } catch {
        // ignore storage failures in unsupported environments
      }
    });

    await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('https://graph.microsoft.com/**', (route) =>
      route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: [] }) })
    );

    await setupSharePointStubs(page, {
      currentUser: { status: 200, body: { Id: 1234 } },
      lists: [
        { name: 'Users_Master', items: [] },
        { name: 'Schedules', aliases: ['ScheduleEvents'], items: [] },
        { name: 'SupportRecord_Daily', items: [] },
      ],
      fallback: { status: 200, body: { value: [] } },
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);

    const root = page.getByTestId(TESTIDS['dashboard-page']).or(page.getByTestId(TESTIDS.SCHEDULES_PAGE_ROOT));
    await expect(root).toBeVisible({ timeout: 15_000 });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // eslint-disable-next-line no-console
    console.log(`[home.tiles] final url: ${page.url()}`);

    if (testInfo.status !== testInfo.expectedStatus) {
      await page.screenshot({ path: testInfo.outputPath('failure.png'), fullPage: true });
    }
  });

  test('renders dashboard summary sections', async ({ page }) => {
    await expect(page.getByTestId(TESTIDS['dashboard-page'])).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(TESTIDS['dashboard-handoff-summary'])).toBeVisible();
    await expect(page.getByRole('heading', { name: /申し送りタイムライン|今日の予定/i }).first()).toBeVisible();
  });

  test('quick action navigates to daily activity records', async ({ page }) => {
    const root = page.getByTestId(TESTIDS['dashboard-page']).or(page.getByTestId(TESTIDS.SCHEDULES_PAGE_ROOT));
    await expect(root).toBeVisible({ timeout: 15_000 });

    const quickAction = page
      .getByTestId(TESTIDS['daily-footer-activity'])
      .or(page.getByRole('link', { name: /ケース記録入力|支援記録（ケース記録）入力/ }))
      .or(page.locator('a[href="/daily/table"]'))
      .or(page.locator('a[href="/daily/activity"]'))
      .or(page.locator('a[href="/daily/activity/"]'));

    await expect(quickAction.first()).toBeVisible({ timeout: 15_000 });
    await quickAction.first().click();

    await expect(page).toHaveURL(/\/(daily\/table|daily\/activity)/);
  });
});

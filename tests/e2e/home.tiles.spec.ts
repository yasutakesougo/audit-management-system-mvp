import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';

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

    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
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

  test('dashboard daily record navigation opens the daily record menu', async ({ page }) => {
    const root = page.getByTestId(TESTIDS['dashboard-page']).or(page.getByTestId(TESTIDS.SCHEDULES_PAGE_ROOT));
    await expect(root).toBeVisible({ timeout: 15_000 });

    const dailyNav = page.getByTestId(TESTIDS.nav.daily).first();
    await expect(dailyNav).toBeVisible({ timeout: 15_000 });
    await expect(dailyNav).toHaveAttribute('href', '/dailysupport');
    await dailyNav.click();

    await expect(page).toHaveURL(/\/dailysupport/);
    await expect(page.getByRole('heading', { level: 1, name: '日々の記録', exact: true })).toBeVisible({ timeout: 15_000 });
  });
});

import { expect, test } from '@playwright/test';
import { setupPlaywrightEnv } from './_helpers/setupPlaywrightEnv';
import { setupSharePointStubs } from './_helpers/setupSharePointStubs';

/**
 * IRC Reliability E2E
 *
 * Verifies that "Lanes" (Resources) remain constant and visible even if event data
 * fails to load, and that the unified error snackbar appears correctly.
 */
test.describe('Integrated Resource Calendar Reliability', () => {
  const MOCK_STAFF = [
    { Id: 1, StaffID: 'STF001', StaffName: '田中 太郎', Role: '正社員' },
    { Id: 2, StaffID: 'STF002', StaffName: '鈴木 花子', Role: '契約社員' },
  ];

  test.beforeEach(async ({ page }) => {
    // 1. Setup shared environment and force SharePoint client activation
    await setupPlaywrightEnv(page, {
      envOverrides: {
        VITE_FORCE_SHAREPOINT: '1',
        VITE_SKIP_SHAREPOINT: '0',
      }
    });

    // 2. Setup SharePoint stubs
    await setupSharePointStubs(page, {
      lists: [
        { name: 'Staff_Master', items: MOCK_STAFF },
        { name: 'Schedules_Master', aliases: ['ScheduleEvents'], items: [] },
      ],
    });

    page.on('console', (msg) => {
      if (msg.type() === 'log' || msg.type() === 'error' || msg.type() === 'warning') {
        console.log(`[BROWSER] ${msg.text()}`);
      }
    });
  });

  test('Seed Constant Display: lanes remain visible during event fetch failure', async ({ page }) => {
    // 1. Initial success load
    await page.goto('/admin/integrated-resource-calendar');

    // Wait for calendar lanes to be rendered
    await expect(page.getByText('田中 太郎')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('鈴木 花子')).toBeVisible();

    // 2. Mock network failure for events specifically
    // We only intercept the schedules list so other requests (like Staff_Master)
    // fall through to the SharePoint stubs.
    let failEvents = false;

    await page.route(url => url.href.includes('getbytitle(\'Schedules_Master\')/items') || url.href.includes('getbytitle(\'ScheduleEvents\')/items'), (route) => {
      if (failEvents) {
        console.log(`[TEST] Simulated Failure for: ${route.request().url()}`);
        route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: { message: { value: 'Simulation Error' } } })
        });
      } else {
        route.continue();
      }
    });

    failEvents = true;
    await page.reload();

    // VERIFY: Lanes are STILL VISIBLE because resources were successfully fetched from stubs
    await expect(page.getByText('田中 太郎')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('鈴木 花子')).toBeVisible();

    // VERIFY: Unified Error Alert appears
    await expect(page.getByText('データの読み込みに失敗しました')).toBeVisible({ timeout: 10000 });
  });
});

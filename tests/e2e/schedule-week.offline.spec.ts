import { TESTIDS } from '@/testids';
import { expect, test } from '@playwright/test';
import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoScheduleWeek } from './utils/scheduleWeek';

const REF_DATE = new Date('2025-11-24');

test.describe('Schedule week offline handling', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapScheduleEnv(page, {
      env: {
        VITE_TEST_ROLE: 'admin',
      },
    });
    // Feature toggles for Week V2
    await page.addInitScript(() => {
      localStorage.setItem('feature:schedules', '1');
      localStorage.setItem('feature:schedulesWeekV2', '1');
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
      const type = msg.type();
      if (type === 'log' || type === 'info' || type === 'warning' || type === 'error') {
         if (msg.text().includes('[schedules]')) console.log(`[BROWSER ${type.toUpperCase()}] ${msg.text()}`);
      }
    });
    // Add default mocks for schedules to avoid 404s in E2E mode
    await page.route(
      '**/lists/getbytitle(\'ScheduleEvents\')/items*',
      async (route) => {
        const method = route.request().method();
        const url = route.request().url();
        if (method === 'GET') {
           console.log(`[E2E-OFFLINE] Mocking success for GET ${url}`);
           if (url.includes('Id+eq+999')) {
             await route.fulfill({
               status: 200,
               contentType: 'application/json',
               body: JSON.stringify({
                 value: [{
                   Id: 999,
                   Title: 'Offline Test Success',
                   EventDate: '2025-11-24T00:00:00Z',
                   EndDate: '2025-11-24T01:00:00Z',
                   cr014_personType: 'User',
                   cr014_personId: '1',
                   RowKey: '999',
                   cr014_dayKey: '2025-11-24',
                   MonthKey: '2025-11',
                   cr014_fiscalYear: '2025',
                   ETag: '"1"'
                 }]
               }),
             });
           } else {
             await route.fulfill({
               status: 200,
               contentType: 'application/json',
               body: JSON.stringify({ value: [] }),
             });
           }
        } else if (method === 'POST') {
           console.log(`[E2E-OFFLINE] Mocking success for POST ${url}`);
           await route.fulfill({
             status: 201,
             contentType: 'application/json',
             body: JSON.stringify({ Id: 999, Title: 'Success' }),
           });
        } else {
           await route.continue();
        }
      }
    );
  });

  test('shows network error message when creating schedule while offline', async ({ page }) => {
    // 1. Navigate to schedule week while online
    await gotoScheduleWeek(page, REF_DATE);
    await page.waitForTimeout(500);

    // 2. Set offline
    await page.context().setOffline(true);

    const fabButton = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);
    await expect(fabButton).toBeVisible();
    await fabButton.click();

    const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
    await expect(dialog).toBeVisible();

    // Fill minimal data
    await dialog.getByTestId(TESTIDS['schedule-create-title']).fill('Offline Test');

    // Select service type (mandatory for User category)
    const serviceTypeSelect = dialog.getByTestId(TESTIDS['schedule-create-service-type']);
    await serviceTypeSelect.click();
    await page.getByRole('option', { name: '欠席' }).click();

    await dialog.getByTestId(TESTIDS['schedule-create-save']).click();

    // 3. Verify network error snackbar (Scenario B)
    const snackbar = page.getByTestId('schedules-network-snackbar');
    await expect(snackbar).toBeVisible({ timeout: 10000 });

    // 4. Recover online
    await page.context().setOffline(false);
    await dialog.getByTestId(TESTIDS['schedule-create-save']).click();

    // Verify success
    await expect(snackbar).not.toBeVisible();
    await expect(dialog).not.toBeVisible();
  });

  test('detects offline state and shows network error banner after refetch', async ({ page }) => {
    // 1. Navigate to schedule week while online
    await gotoScheduleWeek(page, REF_DATE);
    await page.waitForTimeout(500);

    // 2. Set offline
    await page.context().setOffline(true);

    // 3. Trigger refetch - click "今日" to trigger a range fetch
    const todayButton = page.getByTestId(TESTIDS.SCHEDULES_TODAY);
    await todayButton.click();

    // 4. Verify network error banner (Scenario B)
    const snackbar = page.getByTestId('schedules-network-snackbar');
    await expect(snackbar).toBeVisible({ timeout: 10000 });

    // 5. Recover online
    await page.context().setOffline(false);
    const retryButton = snackbar.getByRole('button', { name: '再試行' });
    await expect(retryButton).toBeVisible();

    // In our implementation, '再試行' does window.location.reload()
    await retryButton.click();
  });
});

import { TESTIDS } from '@/testids';
import { expect, test } from '@playwright/test';
import { bootstrapScheduleEnv } from './utils/scheduleEnv';
import { gotoScheduleWeek } from './utils/scheduleWeek';

const REF_DATE = new Date('2025-11-24');

test.describe('Schedule week conflict handling', () => {
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
  });

  test('shows conflict dialog when saving fails with 412', async ({ page }) => {
    // 1. Setup routes to intercept SharePoint API
    // The glob matches both creation (items) and update (items(123))
    await page.route(
      '**/lists/getbytitle(\'ScheduleEvents\')/items*',
      async (route) => {
        const method = route.request().method();
        const url = route.request().url();

        if (method === 'GET') {
          console.log(`[E2E] Mocking success for GET ${url}`);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ value: [] }),
          });
        } else if (['POST', 'PATCH', 'PUT'].includes(method)) {
          console.log(`[E2E] Mocking 412 Conflict for ${method} ${url}`);
          await route.fulfill({
            status: 412,
            contentType: 'application/json',
            body: JSON.stringify({
              error: {
                code: '-2147024809, System.ArgumentException',
                message: {
                  lang: 'en-US',
                  value: 'The version of the item you are trying to update has changed.'
                }
              }
            }),
          });
        } else {
          await route.continue();
        }
      }
    );

    // 2. Navigate to schedule week
    await gotoScheduleWeek(page, REF_DATE);
    await page.waitForTimeout(500);

    // 3. Open create dialog
    const fabButton = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);
    await expect(fabButton).toBeVisible();
    await fabButton.click();

    const dialog = page.getByTestId(TESTIDS['schedule-create-dialog']);
    await expect(dialog).toBeVisible();

    // Fill minimal data
    await dialog.getByTestId(TESTIDS['schedule-create-title']).fill('Conflict Test');
    const serviceTypeSelect = dialog.getByTestId(TESTIDS['schedule-create-service-type']);
    await serviceTypeSelect.click();
    await page.getByRole('option', { name: '欠席' }).click();

    await dialog.getByTestId(TESTIDS['schedule-create-save']).click();

    // 5. Verify conflict snackbar appears
    // The conflict snackbar has text '更新が競合しました'
    const snackbar = page.locator('.MuiSnackbar-root').filter({ hasText: '更新が競合しました' });
    await expect(snackbar).toBeVisible({ timeout: 10000 });

    // 6. Verify "Show Details" button works
    const detailButton = snackbar.getByRole('button', { name: '詳細を見る' });
    await expect(detailButton).toBeVisible();
    await detailButton.click();

    // 7. Verify Conflict Detail Dialog appears
    const conflictDialog = page.getByTestId('conflict-detail-dialog');
    await expect(conflictDialog).toBeVisible();

    // 8. Verify "Reload and Retry" (最新を読み込む) button exists
    const reloadButton = conflictDialog.getByRole('button', { name: '最新を読み込む' });
    await expect(reloadButton).toBeVisible();

    // 9. Unroute and verify reload flow (mocking success now)
    await page.unroute('**/_api/web/lists/getbytitle(\'ScheduleEvents\')/items*');
    await reloadButton.click();

    // The conflict dialog and create dialog should close (or refetch should happen)
    await expect(conflictDialog).not.toBeVisible();
    // Note: in our current implementation, Reload might just close the conflict dialog and refetch data.
    // The create dialog might stay open if it was a create failure, or close if it was an update.
    // Let's check how onConflictReload is implemented in WeekPage.
  });
});

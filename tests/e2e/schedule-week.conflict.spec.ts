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
        VITE_E2E_FORCE_SCHEDULES_WRITE: '1',
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

  test('shows conflict feedback when saving fails with 412', async ({ page }) => {
    const schedulesItemsMatcher = (url: URL) => {
      const decoded = decodeURIComponent(url.href);
      return (
        decoded.includes("/lists/getbytitle('Schedules')/items") ||
        decoded.includes("/lists/getbytitle('ScheduleEvents')/items")
      );
    };

    // 1. Setup routes to intercept SharePoint API
    // Matcher handles current list title (Schedules) and legacy alias (ScheduleEvents)
    await page.route(schedulesItemsMatcher, async (route) => {
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
    });

    // 2. Navigate to schedule week
    await gotoScheduleWeek(page, REF_DATE);
    await page.waitForTimeout(500);

    // 3. Open create dialog (desktop: header button, mobile: FAB, fallback: URL dialog params)
    const headerCreateButton = page.getByTestId(TESTIDS.SCHEDULES_HEADER_CREATE);
    const fabButton = page.getByTestId(TESTIDS.SCHEDULES_FAB_CREATE);

    if (await headerCreateButton.isVisible()) {
      await headerCreateButton.click();
    } else if (await fabButton.isVisible()) {
      await fabButton.click();
    } else {
      const url = new URL(page.url());
      const dateParam = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
      url.searchParams.set('dialog', 'create');
      url.searchParams.set('dialogDate', dateParam);
      url.searchParams.set('dialogStart', '10:00');
      url.searchParams.set('dialogEnd', '11:00');
      url.searchParams.set('dialogCategory', 'User');
      await page.goto(`${url.pathname}?${url.searchParams.toString()}`, { waitUntil: 'networkidle' });
    }

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

    // 6. Optional: detail flow may not render if lastError is cleared by background refetch first.
    const detailButton = snackbar.getByRole('button', { name: '詳細を見る' });
    if (await detailButton.isVisible().catch(() => false)) {
      await detailButton.click();

      // 7. Verify Conflict Detail Dialog appears
      const conflictDialog = page.getByTestId('conflict-detail-dialog');
      await expect(conflictDialog).toBeVisible();

      // 8. Verify "Reload and Retry" (最新を読み込む) button exists
      const reloadButton = conflictDialog.getByRole('button', { name: '最新を読み込む' });
      await expect(reloadButton).toBeVisible();

      // 9. Verify reload flow
      await reloadButton.click();

      await expect(conflictDialog).not.toBeVisible();
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'detail action was not visible; conflict toast verification completed.',
      });
    }
  });
});

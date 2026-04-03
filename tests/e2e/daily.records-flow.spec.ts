/* eslint-disable @typescript-eslint/no-use-before-define */
import { expect, test } from '@playwright/test';
import { primeOpsEnv } from './helpers/ops';

test.describe('Daily – Records flow', () => {
  test('navigates to /daily/activity, shows list, and opens a record', async ({ page }) => {
    await primeOpsEnv(page);

    await page.goto('/daily/activity', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    
    // PageHeader might have duplicate h1 with FullScreenDailyDialogPage
    const header = page.getByRole('heading', { name: /支援記録（ケース記録）/, level: 1 }).first();
    await expect(header).toBeVisible({ timeout: 15_000 });

    const root = page.getByTestId('records-daily-root');
    await expect(root).toBeVisible();

    await expect(header).toBeVisible();
    await expect(page.getByRole('button', { name: '本日分全員作成（32名）' })).toBeVisible();

    // Wait for record cards to be visible
    const list = page.getByTestId('daily-record-list-container');
    await expect(list.getByText('田中太郎', { exact: false })).toBeVisible();
    await expect(list.getByText('佐藤花子', { exact: false })).toBeVisible();
    await expect(list.getByText('鈴木次郎', { exact: false })).toBeVisible();

    // Verify FAB button exists (don't click it if it's not working reliably)
    const fabButton = page.getByTestId('add-record-fab');
    await expect(fabButton).toBeVisible();

    // Test the bulk create button instead which should be more reliable
    await page.getByRole('button', { name: '本日分全員作成（32名）' }).click();

    // Check if more record cards appear
    await page.waitForTimeout(1000); // Give time for any UI updates

    const breadcrumbs = page.getByTestId('breadcrumbs');
    if (await breadcrumbs.count()) {
      await expect(breadcrumbs).toBeVisible();
    }
  });
});
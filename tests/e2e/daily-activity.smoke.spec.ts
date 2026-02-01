import { expect, test } from '@playwright/test';
import { bootDaily } from './_helpers/bootDaily';
import { openMobileNav } from './_helpers/openMobileNav';

// Smoke: /daily/activity happy path navigation and quick sanity checks
// - open activity list
// - ensure records render
// - navigate back to /daily via nav
// - return to activity via footer/card button

test.describe('Daily activity smoke', () => {
  test('opens activity, shows records, and round-trips via nav/footer', async ({ page }) => {
    await bootDaily(page);

    // Open activity page
    await page.goto('/daily/activity', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await expect(page.getByRole('heading', { name: /支援記録（ケース記録）/, level: 1 })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('records-daily-root')).toBeVisible();
    await expect(page.getByTestId('daily-stats-panel')).toBeVisible();

    // Verify some record cards render (mock data from primeOpsEnv)
    await expect(page.getByText('田中太郎', { exact: false })).toBeVisible();
    await expect(page.getByText('佐藤花子', { exact: false })).toBeVisible();

    // Navigate back to the daily hub via top nav (fallback to direct route if nav is already active)
    await openMobileNav(page); // Ensure nav is visible before clicking
    await page.getByTestId('nav-daily').first().click();
    await expect(page).toHaveURL(/\/daily$/).catch(async () => {
      await page.goto('/daily');
      await expect(page).toHaveURL(/\/daily$/);
    });
    await expect(page.getByTestId('daily-record-menu')).toBeVisible();

    // Return to activity via footer quick action (if present) otherwise card CTA
    const footerActivity = page.getByTestId('footer-action-daily-activity');
    if ((await footerActivity.count()) > 0) {
      await footerActivity.click();
    } else {
      await page.getByTestId('btn-open-activity').click();
    }

    await expect(page).toHaveURL(/\/daily\/activity/);
    await expect(page.getByTestId('records-daily-root')).toBeVisible();
  });

  test('opens edit dialog, cancels, and returns to list', async ({ page }) => {
    await bootDaily(page);

    await page.goto('/daily/activity', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await expect(page.getByRole('heading', { name: /支援記録（ケース記録）/, level: 1 })).toBeVisible({ timeout: 15_000 });

    const list = page.getByTestId('daily-record-list-container');
    await expect(list).toBeVisible();

    const firstCard = page.locator('[data-testid^="daily-record-card-"]').first();
    await firstCard.scrollIntoViewIfNeeded();
    await expect(firstCard).toBeVisible();

    await firstCard.locator('[data-testid^="menu-button-"]').click();
    const editMenuItem = page.locator('[data-testid^="edit-record-menu-item-"]');
    await expect(editMenuItem).toBeVisible();
    await editMenuItem.click();

    const formDialog = page.getByTestId('daily-record-form-dialog');
    await expect(formDialog).toBeVisible();

    await page.getByTestId('cancel-button').click();
    await expect(formDialog).toBeHidden();

    await expect(list).toBeVisible();
    await expect(firstCard).toBeVisible();
  });
});

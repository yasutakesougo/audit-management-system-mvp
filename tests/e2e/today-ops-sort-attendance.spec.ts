import { expect, test, type Page } from '@playwright/test';
import { bootTodayOpsPage } from './_helpers/bootTodayOpsPage';

async function waitForTodayMain(page: Page): Promise<void> {
  await page.goto('/today');
  await expect(page.getByTestId('bento-next-action')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hero-action-card')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('hero-cta')).toBeVisible({ timeout: 15_000 });
}

async function openUnfilledStateByUrl(page: Page, userId = 'I022') {
  await page.goto(`/today?mode=unfilled&userId=${encodeURIComponent(userId)}&autoNext=1`);
  await expect(page).toHaveURL(/[?&]mode=unfilled/);
  await expect(page).toHaveURL(new RegExp(`userId=${userId}`));
  await expect(page).toHaveURL(/[?&]autoNext=1/);
}

test.describe('Today Ops Screen - Sort Attendance', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => {
      console.log(`[PAGE ERROR] ${error.message}`);
    });
    await bootTodayOpsPage(page);
  });

  test('unfilled drawer keeps target user id and remains stable when candidates are filtered out', async ({ page }) => {
    await waitForTodayMain(page);
    await openUnfilledStateByUrl(page);

    const userRow = page.getByRole('button', { name: /中村 裕樹/ }).first();
    await expect(userRow).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=✏️ 未記録')).toContainText('未記録');
    await expect(page).toHaveURL(/autoNext=1/);
  });
});

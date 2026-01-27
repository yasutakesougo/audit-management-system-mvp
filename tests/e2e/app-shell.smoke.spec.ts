import { expect, test, type Page } from '@playwright/test';

async function openNavIfDrawerExists(page: Page) {
  const openBtn = page.getByTestId('nav-open');
  if (await openBtn.count()) {
    await openBtn.first().click({ noWaitAfter: true });
  }
}

test.describe('app shell smoke (appRender recovery)', () => {
  test('renders app shell and exposes navigation', async ({ page }) => {
    await page.goto('/');

    await openNavIfDrawerExists(page);

    await expect(page.getByTestId('app-shell')).toBeVisible({ timeout: 5000 });

    const navAudit = page.getByTestId('nav-audit');
    const navChecklist = page.getByTestId('nav-checklist');

    if (await navAudit.count()) {
      await expect(navAudit.first()).toBeVisible({ timeout: 5000 });
    }

    if (await navChecklist.count()) {
      await expect(navChecklist.first()).toBeVisible({ timeout: 5000 });
    }
  });
});

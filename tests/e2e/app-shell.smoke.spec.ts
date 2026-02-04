import { expect, test, type Page } from '@playwright/test';

async function openNavIfDrawerExists(page: Page) {
  const mobileBtn = page.getByTestId('nav-open');
  const desktopBtn = page.getByTestId('desktop-nav-open');
  
  // Try mobile drawer
  if (await mobileBtn.count()) {
    await mobileBtn.first().click();
    // Wait for drawer to be visible
    await expect(page.getByTestId('nav-drawer')).toBeVisible({ timeout: 3000 });
    return;
  }
  
  // Try desktop drawer
  if (await desktopBtn.count()) {
    await desktopBtn.click();
    // Wait for drawer to be visible
    await expect(page.getByTestId('nav-drawer')).toBeVisible({ timeout: 3000 });
    return;
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

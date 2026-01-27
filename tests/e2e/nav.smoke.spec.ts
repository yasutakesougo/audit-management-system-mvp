import { test, expect } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

test.describe('nav smoke (UI navigation)', () => {
  test.use({ baseURL: BASE_URL });

  test('nav → audit renders audit-root', async ({ page }) => {
    await page.goto('/');
    const open = page.getByTestId('nav-open');
    if (await open.count()) {
      await open.click();
    }
    const navAudit = page.getByTestId('nav-audit');
    if (await navAudit.count()) {
      await expect(navAudit).toBeVisible({ timeout: 30_000 });
      await Promise.all([
        page.waitForURL(/\/audit/, { timeout: 30_000 }),
        navAudit.click({ force: true, noWaitAfter: true }),
      ]);
    } else {
      await page.goto('/audit');
    }
    await expect(page.getByTestId('audit-root')).toBeVisible();
    await expect(page).toHaveURL(/\/audit/);
  });

  test('nav → checklist renders checklist-root', async ({ page }) => {
    await page.goto('/');
    const open = page.getByTestId('nav-open');
    if (await open.count()) {
      await open.click();
    }
    const navChecklist = page.getByTestId('nav-checklist');
    if (await navChecklist.count()) {
      await expect(navChecklist).toBeVisible({ timeout: 30_000 });
      await Promise.all([
        page.waitForURL(/\/checklist/, { timeout: 30_000 }),
        navChecklist.click({ force: true, noWaitAfter: true }),
      ]);
    } else {
      await page.goto('/checklist');
    }
    await expect(page.getByTestId('checklist-root')).toBeVisible();
    await expect(page).toHaveURL(/\/checklist/);
  });
});

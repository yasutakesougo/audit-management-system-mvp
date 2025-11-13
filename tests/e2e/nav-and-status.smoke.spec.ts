import { expect, test } from '@playwright/test';

test.describe('Nav/Status/Footers basics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('sp-connection-status')).toBeVisible();
  });

  test('SP status badge exposes enum state', async ({ page }) => {
    const badge = page.getByTestId('sp-connection-status');
    await expect(badge).toHaveAttribute('data-connection-state', /^(ok|error|checking)$/);
    await expect(badge).toHaveAttribute('role', 'status');
    await expect(badge).toHaveText(/^(Checking|SP Connected|SP Error)$/);
  });

  test('Top nav items expose test ids and aria-current updates', async ({ page }) => {
    const dashboard = page.getByTestId('nav-dashboard').first();
    await expect(dashboard).toHaveAttribute('aria-current', 'page');

    await page.getByTestId('nav-checklist').first().click();
    await expect(page).toHaveURL(/\/checklist/);
    await expect(page.getByTestId('nav-checklist').first()).toHaveAttribute('aria-current', 'page');
  });

  test('Footer quick actions announce active state', async ({ page }) => {
    const attendance = page.getByTestId('footer-action-daily-attendance');
    await attendance.click();
    await expect(page).toHaveURL(/\/daily\/attendance/);
    await expect(attendance).toHaveAttribute('aria-current', 'page');
  });

  test('Footer quick actions expose active state when visiting directly', async ({ page }) => {
    await page.goto('/daily/activity');
    const activity = page.getByTestId('footer-action-daily-activity');
    await expect(activity).toHaveAttribute('aria-current', 'page');
  });

  test('Alt+P HUD is ignored while typing', async ({ page }) => {
    await page.goto('/checklist');

    const editable = page.locator('input, textarea, [contenteditable="true"]');
    if (await editable.count()) {
      await editable.first().click();
      await page.keyboard.down('Alt');
      await page.keyboard.press('KeyP');
      await page.keyboard.up('Alt');
      await expect(page.getByTestId('navshell-hud')).toHaveCSS('opacity', '0');
    } else {
      test.info().annotations.push({ type: 'info', description: 'No editable field found on /checklist; skipped HUD assertion.' });
    }
  });
});

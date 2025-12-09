import { expect, test } from '@playwright/test';

const APP_SHELL_ENTRY = '/dashboard';

test.describe('Nav/Status/Footers basics', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const win = window as typeof window & { __ENV__?: Record<string, string> };
      win.__ENV__ = {
        ...(win.__ENV__ ?? {}),
        VITE_SKIP_LOGIN: '1',
        VITE_E2E: '1',
        VITE_FEATURE_SCHEDULES: '1',
      };
      window.localStorage.setItem('skipLogin', '1');
    });

    const response = await page.goto(APP_SHELL_ENTRY, { waitUntil: 'networkidle' });

    expect(response, `navigate to ${APP_SHELL_ENTRY} should return a response`).toBeTruthy();
    expect(
      response!.status(),
      `expected 2xx/3xx from ${APP_SHELL_ENTRY}, got ${response!.status()}`,
    ).toBeLessThan(400);

  });

  test('SP status badge exposes enum state', async ({ page }) => {
    const badge = page.getByTestId('sp-connection-status');
    const badgeCount = await badge.count();
    test.skip(badgeCount === 0, 'SP connection badge is not rendered in this environment');

    await expect(badge).toBeVisible();
    await expect(badge).toHaveAttribute('data-connection-state', /^(ok|error|signedOut|checking)$/);
    await expect(badge).toHaveAttribute('role', 'status');
    await expect(badge).toHaveText(/^(Checking|SP Connected|SP Error|SP Sign-In)$/);
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

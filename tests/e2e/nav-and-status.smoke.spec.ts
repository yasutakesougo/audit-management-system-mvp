import { expect, test } from '@playwright/test';

import { TESTIDS } from '../../src/testids';
import { bootstrapDashboard } from './utils/bootstrapApp';
import { openMobileNav } from './_helpers/openMobileNav';
import { waitForLocator } from './_helpers/waitForLocator';
import { waitForStableRender } from './_helpers/waitForStableRender';

const APP_SHELL_ENTRY = '/dashboard';

test.describe('Nav/Status/Footers basics', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapDashboard(page, { skipLogin: true, featureSchedules: true, initialPath: APP_SHELL_ENTRY });
    await expect(page).toHaveURL(new RegExp(`${APP_SHELL_ENTRY.replace('/', '\\/')}`));

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

  test('Drawer nav items expose test ids and aria-current updates', async ({ page }) => {
    // Nav items are now in the drawer (permanent on desktop, mobile drawer also rendered but hidden)
    await openMobileNav(page);

    // Wait for dashboard nav item to exist (this confirms nav is rendered)
    const dashboard = page.getByTestId('nav-dashboard').first();
    await waitForLocator(dashboard, { timeoutMs: 60_000, requireVisible: true });
    await waitForStableRender(page, dashboard, { timeoutMs: 45_000 });
    await expect(dashboard).toHaveAttribute('aria-current', 'page');

    const checklist = page.getByTestId('nav-checklist').first();
    await waitForLocator(checklist, { timeoutMs: 60_000, requireVisible: true });
    await waitForStableRender(page, checklist, { timeoutMs: 45_000 });
    await checklist.click();
    await expect(page).toHaveURL(/\/checklist/);
    
    // Wait for aria-current to update after navigation
    await expect.poll(
      async () => await checklist.getAttribute('aria-current'),
      { timeout: 45_000 }
    ).toBe('page');
  });

  test('Drawer nav highlights schedules / nurse / iceberg per route', async ({ page }) => {
    await page.goto('/schedules/week');
    await openMobileNav(page);
    await expect(page.getByTestId(TESTIDS.nav.schedules)).toHaveAttribute('aria-current', 'page');

    await page.goto('/nurse');
    const nurseNav = page.getByTestId(TESTIDS.nav.nurse);
    const nurseCount = await nurseNav.count();
    test.skip(nurseCount === 0, 'Nurse nav entry is not visible in this build');
    await expect(nurseNav).toHaveAttribute('aria-current', 'page');

    await page.goto('/analysis/iceberg');
    await expect(page.getByTestId(TESTIDS.nav.iceberg)).toHaveAttribute('aria-current', 'page');
  });

  test.skip('Footer quick actions announce active state', async ({ page }) => {
    // SKIP: Footer quick actions replaced with FAB in PR #227
    const attendance = page.getByTestId('footer-action-daily-attendance');
    await attendance.click();
    await expect(page).toHaveURL(/\/daily\/attendance/);
    await expect(attendance).toHaveAttribute('aria-current', 'page');
  });

  test.skip('Footer quick actions expose active state when visiting directly', async ({ page }) => {
    // SKIP: Footer quick actions replaced with FAB in PR #227
    await page.goto('/daily/activity');
    const activity = page.getByTestId('footer-action-daily-activity');
    await expect(activity).toHaveAttribute('aria-current', 'page');
  });

  test('Alt+P HUD is ignored while typing', async ({ page }) => {
    await page.goto('/checklist');

    const editable = page.locator('input, textarea, [contenteditable="true"]');
    if (await editable.count()) {
      const hud = page.getByTestId('navshell-hud');
      const hudCount = await hud.count().catch(() => 0);
      if (!hudCount) {
        test.info().annotations.push({ type: 'info', description: 'HUD element not found; skipped HUD assertion.' });
        return;
      }
      await editable.first().click();
      await page.keyboard.down('Alt');
      await page.keyboard.press('KeyP');
      await page.keyboard.up('Alt');
      await expect(hud).toHaveCSS('opacity', '0');
    } else {
      test.info().annotations.push({ type: 'info', description: 'No editable field found on /checklist; skipped HUD assertion.' });
    }
  });
});

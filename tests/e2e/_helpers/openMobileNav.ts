import type { Page } from '@playwright/test';
import { waitForAppShellReady } from '../utils/wait';

/**
 * Opens the mobile/temporary navigation drawer if the open button is visible.
 * Safe no-op on desktop layouts.
 */
export async function openMobileNav(page: Page): Promise<void> {
  await waitForAppShellReady(page, 60_000);

  const navDashboard = page.getByTestId('nav-dashboard').first();
  const navVisible = await navDashboard.isVisible().catch(() => false);
  if (navVisible) return;

  const mobileBtn = page.locator('[data-testid="nav-open"]');
  const desktopBtn = page.locator('[data-testid="desktop-nav-open"]');

  await mobileBtn.first().waitFor({ state: 'attached', timeout: 10_000 }).catch(() => undefined);
  await desktopBtn.first().waitFor({ state: 'attached', timeout: 10_000 }).catch(() => undefined);

  if (await mobileBtn.isVisible().catch(() => false)) {
    await mobileBtn.click();
  } else if (await desktopBtn.isVisible().catch(() => false)) {
    await desktopBtn.click();
  } else if ((await mobileBtn.count().catch(() => 0)) > 0) {
    await mobileBtn.first().click({ force: true });
  } else if ((await desktopBtn.count().catch(() => 0)) > 0) {
    await desktopBtn.first().click({ force: true });
  }

  // Allow Drawer transition + initial layout
  await page.waitForTimeout(500);
}

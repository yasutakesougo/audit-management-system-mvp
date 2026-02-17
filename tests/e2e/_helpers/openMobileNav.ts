import { expect, type Page } from '@playwright/test';
import { waitForAppShellReady } from '../utils/wait';

/**
 * Opens the mobile/temporary navigation drawer if the open button is visible.
 * Safe no-op on desktop layouts.
 */
export async function openMobileNav(page: Page): Promise<boolean> {
  await waitForAppShellReady(page, 60_000);

  const navDashboard = page.getByTestId('nav-dashboard').first();
  const navVisible = await navDashboard.isVisible().catch(() => false);
  if (navVisible) return true;

  const navDrawer = page.getByTestId('nav-drawer').first();
  const drawerVisible = await navDrawer.isVisible().catch(() => false);
  if (drawerVisible) return true;

  const navItems = page.getByTestId('nav-items').first();
  const itemsVisible = await navItems.isVisible().catch(() => false);
  if (itemsVisible) return true;

  const openBtn = page.getByTestId('nav-open');
  const desktopBtn = page.getByTestId('desktop-nav-open');

  if ((await openBtn.count().catch(() => 0)) === 0 && (await desktopBtn.count().catch(() => 0)) === 0) {
    return false;
  }

  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click();
  } else if (await desktopBtn.isVisible().catch(() => false)) {
    await desktopBtn.click();
  } else if ((await openBtn.count().catch(() => 0)) > 0) {
    await openBtn.first().click({ force: true });
  } else if ((await desktopBtn.count().catch(() => 0)) > 0) {
    await desktopBtn.first().click({ force: true });
  }

  const navTarget = navItems.or(navDrawer);
  await expect(navTarget).toBeVisible({ timeout: 15_000 });
  return true;
}

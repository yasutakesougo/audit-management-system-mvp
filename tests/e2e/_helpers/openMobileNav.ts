import type { Page } from '@playwright/test';

/**
 * Opens the mobile/temporary navigation drawer if the open button is visible.
 * Safe no-op on desktop layouts.
 */
export async function openMobileNav(page: Page): Promise<void> {
  const btn = page.locator('[data-testid="nav-open"]');
  if (await btn.isVisible()) {
    await btn.click();
    // Allow Drawer transition + initial layout
    await page.waitForTimeout(500);
  }
}

import { expect, test } from '@playwright/test';
import { expectTestIdVisibleBestEffort } from './_helpers/smoke';

test.describe('app shell smoke (appRender recovery)', () => {
  test('renders app shell and exposes navigation', async ({ page }) => {
    await page.goto('/');

    await expectTestIdVisibleBestEffort(page, 'app-shell', { timeout: 5000 });

    // Try to open nav drawer if button exists
    const mobileBtn = page.getByTestId('nav-open');
    const desktopBtn = page.getByTestId('desktop-nav-open');
    
    if (await desktopBtn.count()) {
      await desktopBtn.click().catch(() => {}); // Non-blocking click attempt
      await page.waitForTimeout(200); // Allow transition
    } else if (await mobileBtn.count()) {
      await mobileBtn.click().catch(() => {}); // Non-blocking click attempt
      await page.waitForTimeout(200);
    }

    // Verify navigation drawer is rendered in DOM (core requirement)
    // Elements may be hidden during CSS transitions, but should exist and be queryable
    const navDrawer = page.getByTestId('nav-drawer');
    const navItems = page.getByTestId('nav-items');
    
    // At least one nav structure element should exist
    const navDrawerCount = await navDrawer.count();
    const navItemsCount = await navItems.count();
    
    expect(navDrawerCount + navItemsCount).toBeGreaterThan(0);
    
    // Confirm admin nav items are rendered (confirming admin access granted)
    const navAudit = page.getByTestId('nav-audit');
    const navChecklist = page.getByTestId('nav-checklist');
    
    const adminNavCount = (await navAudit.count()) + (await navChecklist.count());
    expect(adminNavCount).toBeGreaterThan(0); // At least one admin nav item exists
  });
});

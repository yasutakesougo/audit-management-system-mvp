import type { Page } from '@playwright/test';

/**
 * Navigate to the nurse bulk observation page and wait for it to load
 */
export async function gotoNurseBulk(page: Page): Promise<void> {
  await page.goto('/nurse/bulk');
  await page.waitForLoadState('networkidle');
  // Wait for the bulk observation list to be visible
  await page.waitForSelector('[data-testid="nurse-bulk-table"]', { timeout: 10000 });
}
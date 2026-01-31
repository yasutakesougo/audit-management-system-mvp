import type { Locator } from '@playwright/test';
import { expect } from '@playwright/test';

export type WaitForLocatorOptions = {
  timeoutMs?: number;
  requireVisible?: boolean;
};

/**
 * Wait until the locator exists (count > 0) then optionally wait for it to be visible.
 * This prevents "element(s) not found" failures in slow CI.
 */
export async function waitForLocator(
  locator: Locator,
  options: WaitForLocatorOptions = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 60_000; // Increased from 45s for CI resilience
  const requireVisible = options.requireVisible ?? false;

  try {
    await expect
      .poll(async () => locator.count(), { timeout: timeoutMs, intervals: [1_000, 2_000, 5_000] })
      .toBeGreaterThan(0);
  } catch (error) {
    // Add diagnostic info before failing
    const page = locator.page();
    const url = page.url();
    const title = await page.title().catch(() => 'unknown');
    // eslint-disable-next-line no-console
    console.error(`[waitForLocator] Element not found after ${timeoutMs}ms. URL: ${url}, Title: ${title}`);
    throw error;
  }

  if (requireVisible) {
    await expect(locator.first()).toBeVisible({ timeout: timeoutMs });
  }
}

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
  const timeoutMs = options.timeoutMs ?? 45_000;
  const requireVisible = options.requireVisible ?? false;

  await expect
    .poll(async () => locator.count(), { timeout: timeoutMs })
    .toBeGreaterThan(0);

  if (requireVisible) {
    await expect(locator.first()).toBeVisible({ timeout: timeoutMs });
  }
}

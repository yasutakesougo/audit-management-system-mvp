import { test, expect } from '@playwright/test';
import { TESTIDS } from '../../src/testids';

test('loads audit panel via /audit route and shows heading', async ({ page }) => {
  await page.goto('/audit');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.getByTestId(TESTIDS['audit-heading'])).toBeVisible();
});

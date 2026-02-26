import { expect, test } from '@playwright/test';

test.describe('Support Plan Guide reachability', () => {
  test('support-plan-guide is reachable and not 404', async ({ page }) => {
    await page.goto('/support-plan-guide');
    await expect(page).not.toHaveURL(/404/);

  });
});

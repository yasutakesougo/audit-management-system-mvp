import { test, expect } from '@playwright/test';

test('Schedule month view renders (placeholder: hit /schedule until month route is live)', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('skipLogin', '1');
      window.localStorage.setItem('demo', '0');
      window.localStorage.setItem('feature:schedules', '1');
    } catch {
      /* ignore */
    }
  });
    await page.goto('/schedule', { waitUntil: 'networkidle' });
    await expect(page.getByTestId('schedule-page-root')).toBeVisible({ timeout: 15_000 });
});

import { expect, test } from '@playwright/test';

test.describe('Navigation: Aria-Current Matrix', () => {
  const MAJOR_ROUTES = [
    '/dashboard',
    '/records',
    '/schedules/week',
    '/analysis/dashboard',
    '/users'
  ];

  for (const route of MAJOR_ROUTES) {
    test(`exactly one aria-current on ${route}`, async ({ page }) => {
      await page.goto(route);

      const mainNav = page.getByRole('navigation', { name: /主要ナビゲーション/i });
      await mainNav.waitFor({ state: 'visible' });

      // There should be exactly 1 aria-current="page" link inside the main visible navigation
      const currentLinks = mainNav.locator('a[aria-current="page"]');
      await expect(currentLinks).toHaveCount(1);

      // Also verify it matches the current path conceptually (just verifying it's not empty)
      await expect(currentLinks.first()).toHaveAttribute('href', new RegExp(`^${route}`));
    });
  }

  test('maintains active state in collapsed sidebar', async ({ page }) => {
    await page.goto('/users');

    const mainNav = page.getByRole('navigation', { name: /主要ナビゲーション/i });
    const currentLink = mainNav.locator('a[aria-current="page"]');

    await expect(currentLink).toHaveCount(1);
    await expect(currentLink).toHaveAttribute('href', '/users');

    const toggleBtn = page.getByRole('button', { name: /ナビを折りたたみ|折りたたむ|縮小|開閉/i }).first();
    if (await toggleBtn.isVisible()) {
      await toggleBtn.click();

      await expect(currentLink).toHaveCount(1);
      await expect(currentLink).toHaveAttribute('href', '/users');
    }
  });
});

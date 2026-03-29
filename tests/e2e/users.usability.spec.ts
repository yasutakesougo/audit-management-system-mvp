import { expect, test } from '@playwright/test';
import { bootUsersPage } from './_helpers/bootUsersPage.mts';

test.describe('users usability', () => {
  test('provides a skip link to jump focus into main content', async ({ page }) => {
    await bootUsersPage(page, {
      route: '/users?tab=list',
      autoNavigate: true,
      seed: { usersMaster: true },
    });

    const skipLink = page.getByTestId('skip-to-main-link');

    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('#app-main-content')).toBeFocused();

    let reachedUsersTab = false;
    for (let i = 0; i < 10; i += 1) {
      await page.keyboard.press('Tab');
      const isUsersTabFocused = await page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        if (!active) return false;
        return active.getAttribute('role') === 'tab';
      });
      if (isUsersTabFocused) {
        reachedUsersTab = true;
        break;
      }
    }

    expect(reachedUsersTab).toBe(true);
  });
});

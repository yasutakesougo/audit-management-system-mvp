import { test } from '@playwright/test';
import { installNetworkGuard } from '../helpers/networkGuard';
import { bootstrapDashboard } from './utils/bootstrapApp';
import { expectTestIdVisibleBestEffort } from './_helpers/smoke';

test.describe('Users page smoke (hermetic E2E)', () => {
  test('loads /users and search input is visible', async ({ page }) => {
    installNetworkGuard(page, 'allowlist-localhost');

    await bootstrapDashboard(page, { skipLogin: true, initialPath: '/users' });

    // Wait for stable markers
    console.info('[e2e] url=', page.url());
    console.info('[e2e] title=', await page.title());
    await page.waitForTimeout(500);
    
    // Verify root panel is visible
    await expectTestIdVisibleBestEffort(page, 'users-panel-root');

    // Click the "利用者一覧" tab to show the search input
    await page.getByRole('tab', { name: /利用者一覧/ }).click();
    await page.waitForTimeout(300);

    // ---- Diagnostic: Verify page state ----
    const bodyText = (await page.locator('body').innerText()).slice(0, 1200);
    console.info('[e2e] before-expect body(head)=', bodyText.replace(/\s+/g, ' '));

    // Verify search input
    await expectTestIdVisibleBestEffort(page, 'users-panel-search', { timeout: 10000 });
  });
});

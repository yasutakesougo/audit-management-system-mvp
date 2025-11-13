import { TESTIDS } from '@/testids';
import { expect, test } from '@playwright/test';
import { setupNurseFlags } from './_helpers/setupNurse.flags';

test.describe('@ci-smoke nurse roster handshake', () => {
  test.beforeEach(async ({ page }) => {
    await setupNurseFlags(page);
  });

  test('navigating to /daily/health redirects to nurse observation workspace', async ({ page }) => {
    const targetUser = 'I022';
    await page.goto(`/daily/health?user=${targetUser}`);

    await page.waitForURL(/\/nurse\/observation/);
    await expect(page).toHaveURL(new RegExp(`user=${targetUser}`));

    const rosterLocator = page.locator(`[data-testid="${TESTIDS.NURSE_USER_LIST}"]`);
    await expect(rosterLocator).toHaveCount(0);

    await expect(page.getByTestId(TESTIDS.NURSE_OBS_FORM_SECTION)).toBeVisible();
  });
});

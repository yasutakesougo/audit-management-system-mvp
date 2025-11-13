import { TESTIDS } from '@/testids';
import { expect, test } from '@playwright/test';
import { setupNurseFlags } from './_helpers/setupNurse.flags';

test.describe('@ci-smoke nurse seizure routing', () => {
  test.beforeEach(async ({ page }) => {
    await setupNurseFlags(page);
  });

  test('legacy tab query resolves to seizure workspace', async ({ page }) => {
    await page.goto('/nurse/observation?user=U001&date=2025-11-05&tab=records');

    await expect(page.getByTestId(TESTIDS.NURSE_OBS_PAGE)).toBeVisible();
  await expect(page.getByTestId(TESTIDS.NURSE_OBS_HEADING)).toBeVisible();
    await expect(page.getByTestId(TESTIDS.NURSE_SEIZURE_PANEL)).toBeVisible();
    await expect(page).not.toHaveURL(/tab=/);
  });
});

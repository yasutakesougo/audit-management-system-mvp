import { TESTIDS } from '@/testids';
import { expect, test } from '@playwright/test';
import { setupNurseFlags } from './_helpers/setupNurse.flags';

test.describe('@ci-smoke nurse seizure workspace', () => {
  test.beforeEach(async ({ page }) => {
    await setupNurseFlags(page);
  });

  test('workspace shows seizure quick log controls', async ({ page }) => {
    await page.goto('/nurse/observation?user=I022');

    await expect(page.getByTestId(TESTIDS.NURSE_OBS_PAGE)).toBeVisible();
    await expect(page.getByTestId(TESTIDS.NURSE_OBS_HEADING)).toBeVisible();
    await expect(page.getByTestId(TESTIDS.NURSE_SEIZURE_PANEL)).toBeVisible();
    await expect(page.getByTestId(TESTIDS.NURSE_SEIZURE_QUICKLOG)).toBeVisible();
  });

  test('recording a seizure logs entry and raises toast', async ({ page }) => {
    await page.goto('/nurse/observation');

    const recordButton = page.getByTestId(TESTIDS.NURSE_SEIZURE_QUICKLOG);
    await expect(recordButton).toBeEnabled();
    await recordButton.click();

    const logList = page.getByTestId(TESTIDS.NURSE_SEIZURE_LOG_LIST);
    await expect(logList).toBeVisible();
    await expect(logList.locator('li').first()).toBeVisible();

    const toast = page.getByTestId(TESTIDS.NURSE_SYNC_TOAST);
    await expect(toast.or(page.getByRole('alert'))).toContainText(/発作|同期|キュー/i);
  });
});

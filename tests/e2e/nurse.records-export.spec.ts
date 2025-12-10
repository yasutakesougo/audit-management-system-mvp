import { TESTIDS } from '@/testids';
import { expect, test } from '@playwright/test';
import { bootNursePage } from './_helpers/bootNursePage';

test.skip(true, 'Legacy nurse records UI is removed during the BP MVP phase.');

test.describe('@ci-smoke nurse records', () => {
  test.beforeEach(async ({ page }) => {
    await bootNursePage(page, { seed: { nurseDashboard: true } });
  });

  test('search UI and export actions are visible', async ({ page }) => {
    await page.goto('/nurse/records');
    await expect(page.getByTestId(TESTIDS.NURSE_RECORDS_PAGE)).toBeVisible();
    await expect(page.getByRole('button', { name: /PDF出力/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /監査用エクスポート/ })).toBeVisible();
  });
});

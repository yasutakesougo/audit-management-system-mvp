import { TESTIDS } from '@/testids';
import { expect, test } from '@playwright/test';
import { gotoNurseBulk } from './nurse/_helpers/bulk';
import { enableNurseFlag } from './utils/enableNurseFlag';
import { waitForSyncFeedback } from './utils/nurse';

const BULK_COLUMN_PREFIX = 'nurse-bulk-col-';

test.describe('Nurse Bulk Observation – sync & UI', () => {
  test.beforeEach(async ({ page }) => {
    await enableNurseFlag(page);
    await gotoNurseBulk(page);
    await expect(page.getByTestId(TESTIDS.NURSE_BULK_PAGE)).toHaveAttribute('aria-keyshortcuts', /Alt\+S/i);
  });

  test('Alt+S triggers feedback (toast or live region)', async ({ page }) => {
    await page.keyboard.down('Alt');
    await page.keyboard.press('S');
    await page.keyboard.up('Alt');

    await waitForSyncFeedback(page);
  });

  test('Date & CTA visible; toggles default', async ({ page }) => {
    await expect(page.getByTestId(TESTIDS.NURSE_BULK_DATE)).toBeVisible();

    const toIndividual = page.getByTestId(TESTIDS.NURSE_BULK_TO_INDIVIDUAL);
    await expect(toIndividual).toBeVisible();
    await expect(toIndividual).toHaveAttribute('aria-label', /個別入力に切り替え/i);

    await expect(page.getByTestId(TESTIDS.NURSE_BULK_FILTER_ALL)).toHaveAttribute('aria-pressed', 'true');
  });

  test('bulk table exposes fixed column set', async ({ page }) => {
  const headers = page.locator(`[data-testid^="${BULK_COLUMN_PREFIX}"]`);
    await expect(headers).toHaveCount(6);

    await expect(page.getByTestId(TESTIDS.NURSE_BULK_COL_USER)).toHaveText(/利用者/);
    await expect(page.getByTestId(TESTIDS.NURSE_BULK_COL_TEMP)).toHaveText(/体温/);
    await expect(page.getByTestId(TESTIDS.NURSE_BULK_COL_WEIGHT)).toHaveText(/体重/);
    await expect(page.getByTestId(TESTIDS.NURSE_BULK_COL_MEMO)).toHaveText(/メモ/);
    await expect(page.getByTestId(TESTIDS.NURSE_BULK_COL_SAVE)).toHaveText(/保存/);
    await expect(page.getByTestId(TESTIDS.NURSE_BULK_COL_STATUS)).toHaveText(/状態/);
  });

  test('weight input flags out-of-range values', async ({ page }) => {
    const weightInput = page.getByTestId(`${TESTIDS.NURSE_BULK_FIELD_PREFIX}-weight-I015`);

    await weightInput.fill('301');
    await expect(weightInput).toHaveAttribute('aria-invalid', 'true');

    await weightInput.fill('62.8');
    await expect(weightInput).not.toHaveAttribute('aria-invalid', 'true');
  });
});

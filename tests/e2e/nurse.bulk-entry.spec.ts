import { TESTIDS } from '@/testids';
import { expect, test } from '@playwright/test';
import { bootNursePage } from './_helpers/bootNursePage';
import { gotoNurseBulk } from './nurse/_helpers/bulk';

test.skip(true, 'Legacy nurse bulk entry UI is offline until the v2 surface ships.');

const extractUserId = (dataTestId: string): string =>
  dataTestId.startsWith(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-`)
    ? dataTestId.slice(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-`.length)
    : dataTestId;

test.describe('Nurse Bulk Entry', () => {
  test.beforeEach(async ({ page }) => {
    await bootNursePage(page, { seed: { nurseDashboard: true }, enableBulk: true });
  });

  test('Enter で保存→次行フォーカス & 一括同期', async ({ page }) => {
    await gotoNurseBulk(page);

    const firstRow = page.locator(`[data-testid^="${TESTIDS.NURSE_BULK_ROW_PREFIX}-"]`).first();
    const firstRowIdAttr = await firstRow.getAttribute('data-testid');
    expect(firstRowIdAttr).toBeTruthy();
    const firstUserId = extractUserId(firstRowIdAttr!);

    await page.getByTestId(`${TESTIDS.NURSE_BULK_FIELD_PREFIX}-temp-${firstUserId}`).fill('37.2');
    await page.keyboard.press('Enter');

    const statusCell = page.getByTestId(`${TESTIDS.NURSE_BULK_STATUS_PREFIX}-${firstUserId}`);
    await expect(statusCell).toHaveAttribute('aria-label', '同期待機');
    await expect(statusCell).toHaveAttribute('data-status', 'queued');

    const secondSaveButton = page.locator(`[data-testid^="${TESTIDS.NURSE_BULK_SAVE_PREFIX}-"]`).nth(1);
    await expect(secondSaveButton).toBeFocused();

    await page.keyboard.down('Alt');
    await page.keyboard.press('s');
    await page.keyboard.up('Alt');

    await expect(page.getByTestId(TESTIDS.NURSE_SYNC_STATUS)).toBeVisible();
    await expect(statusCell).toHaveAttribute('aria-label', '同期済み');
    await expect(statusCell).toHaveAttribute('data-status', 'ok');
  });
});

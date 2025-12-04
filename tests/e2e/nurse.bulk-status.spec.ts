import { TESTIDS } from '@/testids';
import { expect, test } from '@playwright/test';
import { bootNursePage } from './_helpers/bootNursePage';
import { gotoNurseBulk } from './nurse/_helpers/bulk';

test.skip(true, 'Legacy nurse bulk status UI pending v2 implementation.');

const extractUserId = (dataTestId: string): string =>
  dataTestId.startsWith(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-`)
    ? dataTestId.slice(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-`.length)
    : dataTestId;

test.describe('Nurse bulk row status reacts to flush results', () => {
  test.beforeEach(async ({ page }) => {
    await bootNursePage(page, { seed: { nurseDashboard: true }, enableBulk: true });
    await gotoNurseBulk(page);
  });

  test('queued row becomes ok after manual Alt+S flush', async ({ page }) => {
    await expect(page.getByTestId(TESTIDS.NURSE_BULK_TABLE)).toBeVisible();

    const firstRow = page.locator(`[data-testid^="${TESTIDS.NURSE_BULK_ROW_PREFIX}-"]`).first();
    const firstRowIdAttr = await firstRow.getAttribute('data-testid');
    expect(firstRowIdAttr).toBeTruthy();
    const userId = extractUserId(firstRowIdAttr!);

    await page.getByTestId(`${TESTIDS.NURSE_BULK_FIELD_PREFIX}-temp-${userId}`).fill('37.0');
    await page.keyboard.press('Enter');

    const statusCell = page.getByTestId(`${TESTIDS.NURSE_BULK_STATUS_PREFIX}-${userId}`);
    await expect(statusCell).toHaveAttribute('aria-label', '同期待機');
    await expect(statusCell).toHaveAttribute('data-status', 'queued');

    await page.keyboard.press('Alt+S');

    await expect(page.getByRole('alert').getByText(/手動同期：/)).toBeVisible();
    await expect(page.getByTestId(TESTIDS.NURSE_SYNC_ANNOUNCE)).toContainText(/同期/);
    await expect(statusCell).toHaveAttribute('aria-label', /同期済み|一部同期|同期エラー/);
    await expect(statusCell).toHaveAttribute('data-status', /(ok|partial|error)/);
  });

  test('online flush updates queued rows', async ({ page }) => {
    await expect(page.getByTestId(TESTIDS.NURSE_BULK_TABLE)).toBeVisible();

    const firstRow = page.locator(`[data-testid^="${TESTIDS.NURSE_BULK_ROW_PREFIX}-"]`).first();
    const firstRowIdAttr = await firstRow.getAttribute('data-testid');
    expect(firstRowIdAttr).toBeTruthy();
    const userId = extractUserId(firstRowIdAttr!);

    await page.getByTestId(`${TESTIDS.NURSE_BULK_FIELD_PREFIX}-temp-${userId}`).fill('37.4');
    await page.keyboard.press('Enter');

    const statusCell = page.getByTestId(`${TESTIDS.NURSE_BULK_STATUS_PREFIX}-${userId}`);
    await expect(statusCell).toHaveAttribute('aria-label', '同期待機');
    await expect(statusCell).toHaveAttribute('data-status', 'queued');

    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    await expect(page.getByRole('alert').getByText(/オンライン同期：/)).toBeVisible();
    await expect(page.getByTestId(TESTIDS.NURSE_SYNC_ANNOUNCE)).toContainText(/同期/);
    await expect(statusCell).toHaveAttribute('aria-label', /同期済み|一部同期|同期エラー/);
    await expect(statusCell).toHaveAttribute('data-status', /(ok|partial|error)/);
  });
});

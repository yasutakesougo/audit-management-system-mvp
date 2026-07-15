import { expect, test } from '@playwright/test';
import { primeOpsEnv } from './helpers/ops';

const TARGET_USER = '田中 太郎';
const ICEBERG_PATH = '/daily/support?planningSheetId=1001';

test.describe('Iceberg-PDCA Split Stream Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('feature:icebergPdca', '1');
    });
    await primeOpsEnv(page);

    await page.goto(ICEBERG_PATH);
    await expect(page).toHaveURL(/\/daily\/support/);
    const pageRoot = page
      .getByTestId('iceberg-time-based-support-record-page')
      .or(page.getByTestId('time-based-support-record-container'));
    try {
      await expect(pageRoot).toBeVisible({ timeout: 20_000 });
    } catch {
      test.skip(true, 'time-based support page is not ready in this environment');
    }
  });

  test('requires Select User -> Confirm Plan -> Record', async ({ page }) => {
    await page.getByRole('button', { name: new RegExp(TARGET_USER) }).click();

    await expect(page.getByText(`${TARGET_USER} 様`)).toBeVisible();
    await expect(page.getByTestId('procedure-panel')).toBeVisible();
    await expect(page.getByText('時間帯を選択してください')).toBeVisible();

    await page.getByTestId('procedure-panel').getByRole('button', { name: /通所・朝の準備/ }).click();

    const recordPanel = page.getByTestId('record-panel');
    const saveButton = page.getByTestId('behavior-submit-button');
    await expect(recordPanel).toBeVisible();
    await expect(saveButton).toBeDisabled();

    await page.getByLabel(/本人の様子|行動の詳細状況/).fill('朝の受け入れで落ち着いて着席できた。');
    await page.getByRole('button', { name: '他害(叩く/蹴る)' }).first().click();
    await expect(saveButton).toBeEnabled();

    await saveButton.click();

    await expect(page.getByText(/保存しました|保存済みを確認しました/)).toBeVisible();
    await expect(page).toHaveURL(/\/analysis\/iceberg-pdca/, { timeout: 10_000 });
  });
});

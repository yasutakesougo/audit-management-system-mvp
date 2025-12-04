import { expect, test } from '@playwright/test';

const TARGET_USER = '田中 太郎';
const ICEBERG_PATH = '/daily/time-based';

test.describe('Iceberg-PDCA Split Stream Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('demo', '1');
      const win = window as typeof window & { __ENV__?: Record<string, string | undefined> };
      win.__ENV__ = { ...(win.__ENV__ ?? {}), VITE_DEMO_MODE: '1' };
    });

    await page.goto(ICEBERG_PATH);
    await expect(page.getByTestId('iceberg-time-based-support-record-page')).toBeVisible();
  });

  test('requires Select User -> Confirm Plan -> Record', async ({ page }) => {
    const recordPanel = page.getByTestId('record-panel');
    const saveButton = page.getByTestId('behavior-submit-button');
    const lockOverlay = page.getByTestId('record-lock-overlay');

    await expect(recordPanel).toContainText('支援対象者を選択してください');
    await expect(saveButton).toBeDisabled();

    await page.getByLabel('支援対象者').click();
    await page.getByRole('option', { name: TARGET_USER }).click();

    await expect(recordPanel).toContainText('左のPlanを確認すると入力できます');
    await expect(page.getByText(`${TARGET_USER} 様 (Plan)`)).toBeVisible();
    await expect(page.getByText('朝の受け入れ')).toBeVisible();

    const acknowledgeButton = page.getByTestId('procedure-acknowledge-button');
    await acknowledgeButton.click();

    await expect(lockOverlay).toBeHidden();
    await expect(saveButton).toBeDisabled();

    await page.getByRole('button', { name: '他害(叩く/蹴る)' }).first().click();
    await expect(saveButton).toBeEnabled();

    await saveButton.click();

    await expect(page.getByText('行動記録を保存しました')).toBeVisible();

    const footer = page.getByText('直近の行動記録');
    await expect(footer).toBeVisible();
    await expect(page.getByText('他害(叩く/蹴る) / Lv.1')).toBeVisible();
  });
});

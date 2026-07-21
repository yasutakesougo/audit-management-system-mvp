import { test, expect } from '@playwright/test';
import { bootKiosk } from './_helpers/bootKiosk';
import { setupKioskReleaseContracts } from './_helpers/kioskReleaseContracts';

type KioskReleaseContracts = Awaited<ReturnType<typeof setupKioskReleaseContracts>>;

const EXPECTED_RECORD_DATE = '2026-05-08';

test.describe('Kiosk Toilet (memory provider; not production SharePoint proof)', () => {
  test.use({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    timezoneId: 'Asia/Tokyo',
  });

  let contract: KioskReleaseContracts | undefined;

  test.beforeEach(async ({ page }, testInfo) => {
    contract = await setupKioskReleaseContracts(page, testInfo, {
      allowedRequestFailures: [/__vite_ping/i],
    });

    // The release E2E uses the deterministic memory provider. This is not
    // evidence of a production SharePoint write.
    await bootKiosk(page, {
      route: `/kiosk?kiosk=1&date=${EXPECTED_RECORD_DATE}`,
      resetLocalStorage: false,
    });
    await page.getByTestId('kiosk-nav-toilet').click();
  });

  test.afterEach(async ({ page }) => {
    if (!contract) {
      return;
    }

    await contract.assertNoFailures();
    await page.waitForLoadState('load');
    contract = undefined;
  });

  test('should save a toilet record and display the same record after reload', async ({ page }) => {
    await expect(page).toHaveURL(/\/kiosk\/toilet\?.*provider=memory/);
    expect(new URL(page.url()).searchParams.get('date')).toBe(EXPECTED_RECORD_DATE);
    await expect(page.getByTestId('toilet-daily-board')).toBeVisible();
    await expect(page.getByText(EXPECTED_RECORD_DATE, { exact: true })).toBeVisible();
    await expect(page.getByTestId('toilet-board-summary')).toContainText('未記録 1名 / 記録済み 0名');

    await page.getByTestId('toilet-record-button-I005').click();
    await expect(page.getByRole('heading', { name: /石渡 由喜子さんのトイレ記録/ })).toBeVisible();
    await page.getByTestId('toilet-record-save').click();

    await expect(page.getByTestId('toilet-board-summary')).toContainText('未記録 0名 / 記録済み 1名');
    await expect(page.getByTestId('toilet-user-latest-I005')).toContainText('排尿 普通');
    await expect(page.getByTestId('toilet-record-history')).toContainText('本日の全記録（個人別）');
    await expect(page.getByTestId('toilet-history-user-I005')).toContainText('石渡 由喜子');
    await expect(page.getByTestId('toilet-history-user-I005')).toContainText('1件');

    await page.locator('[data-testid^="toilet-correction-button-"]').first().click();
    await expect(page.getByRole('textbox', { name: '記録日', exact: true })).toHaveValue(EXPECTED_RECORD_DATE);
    await page.getByRole('button', { name: 'キャンセル' }).click();

    await page.reload({ waitUntil: 'load' });

    await expect(page).toHaveURL(/\/kiosk\/toilet\?.*provider=memory/);
    expect(new URL(page.url()).searchParams.get('date')).toBe(EXPECTED_RECORD_DATE);
    await expect(page.getByTestId('toilet-daily-board')).toBeVisible();
    await expect(page.getByTestId('toilet-board-summary')).toContainText('未記録 0名 / 記録済み 1名');
    await expect(page.getByTestId('toilet-user-latest-I005')).toContainText('排尿 普通');
    await expect(page.getByTestId('toilet-history-user-I005')).toContainText('石渡 由喜子');
    await expect(page.getByTestId('toilet-history-user-I005')).toContainText('1件');

    await page.locator('[data-testid^="toilet-correction-button-"]').first().click();
    await expect(page.getByRole('textbox', { name: '記録日', exact: true })).toHaveValue(EXPECTED_RECORD_DATE);
  });

  test('should correct a toilet record and refresh the displayed latest record', async ({ page }) => {
    await expect(page.getByTestId('toilet-daily-board')).toBeVisible();

    await page.getByTestId('toilet-record-button-I005').click();
    await expect(page.getByRole('heading', { name: /石渡 由喜子さんのトイレ記録/ })).toBeVisible();
    await page.getByTestId('toilet-record-save').click();

    await expect(page.getByTestId('toilet-user-latest-I005')).toContainText('排尿 普通');

    await page.locator('[data-testid^="toilet-correction-button-"]').first().click();
    await expect(page.getByRole('heading', { name: /石渡 由喜子さんのトイレ記録を訂正/ })).toBeVisible();
    await expect(page.getByLabel('利用者')).toHaveValue('石渡 由喜子');
    await expect(page.getByRole('textbox', { name: '記録日', exact: true })).toHaveValue(EXPECTED_RECORD_DATE);
    await expect(page.getByRole('textbox', { name: '記録日時', exact: true })).toBeEditable({ editable: false });

    await page.getByRole('combobox', { name: '種類' }).click();
    await page.getByRole('option', { name: '排便' }).click();
    await page.getByRole('combobox', { name: '量' }).click();
    await page.getByRole('option', { name: '多量' }).click();
    await page.getByLabel('メモ').fill('E2E訂正メモ');
    await page.getByTestId('toilet-correction-save').click();

    await expect(page.getByRole('heading', { name: /石渡 由喜子さんのトイレ記録を訂正/ })).toHaveCount(0);
    await expect(page.getByTestId('toilet-user-latest-I005')).toContainText('排便 多量');
    await expect(page.getByTestId('toilet-history-user-I005')).toContainText('E2E訂正メモ');
  });
});

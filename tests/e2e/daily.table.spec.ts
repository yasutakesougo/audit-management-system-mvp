import { expect, test, type Page } from '@playwright/test';
import {
  bootDailyTablePage,
  DAILY_TABLE_DRAFT_STORAGE_KEY,
  DAILY_TABLE_E2E_DATE,
  DAILY_TABLE_E2E_USER_ID,
} from './_helpers/bootDailyTablePage';

const tablePath = `/daily/table?date=${DAILY_TABLE_E2E_DATE}`;

async function expectTableFormReady(page: Page): Promise<void> {
  await expect(page.getByTestId('daily-table-record-page')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('heading', { name: '一覧形式の日々の記録' })).toBeVisible();
  await expect(page.getByTestId('daily-table-record-form')).toBeVisible();
}

async function fillReporter(page: Page, name = 'E2E 記録者'): Promise<void> {
  const reporterInput = page.getByPlaceholder('記録者');
  await expect(reporterInput).toBeVisible();
  await reporterInput.fill(name);
}

async function selectVisibleUsers(page: Page): Promise<void> {
  const saveButton = page.getByRole('button', { name: /^\d+人分保存$/ });
  if (await saveButton.isDisabled()) {
    await page.getByRole('button', { name: '表示中の利用者を全選択' }).click();
  }
  await expect(saveButton).toBeEnabled();
}

async function fillFirstRecordRow(page: Page): Promise<void> {
  const table = page.getByTestId('daily-table-record-form-table');
  await expect(table).toBeVisible();
  await table.getByPlaceholder('午前').first().fill('E2E 午前活動');
  await table.getByPlaceholder('午後').first().fill('E2E 午後活動');
  await table.getByPlaceholder('特記').first().fill('E2E 保存確認');
}

async function submitFromTableForm(page: Page): Promise<void> {
  await expectTableFormReady(page);
  await fillReporter(page);
  await selectVisibleUsers(page);
  await fillFirstRecordRow(page);

  const saveButton = page.getByRole('button', { name: /^\d+人分保存$/ });
  await saveButton.click({ force: true });
}

test.describe('日次記録: /daily/table entry points', () => {
  test('direct route loads the table form', async ({ page }) => {
    await bootDailyTablePage(page, { path: tablePath });

    await expectTableFormReady(page);
  });

  test('daily hub opens /daily/table from the table activity card', async ({ page }) => {
    await bootDailyTablePage(page, { path: '/dailysupport' });
    await expect(page.getByTestId('daily-record-menu')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('btn-open-table-activity').click();

    await expect(page).toHaveURL(/\/daily\/table/);
    await expectTableFormReady(page);
  });
});

test.describe('日次記録: /daily/table draft lifecycle', () => {
  test('save draft, restore after reload, and clear draft after submit', async ({ page }) => {
    await bootDailyTablePage(page, {
      path: tablePath,
      draft: {
        reporterName: 'E2E 記録者',
        selectedUserIds: [DAILY_TABLE_E2E_USER_ID],
      },
    });

    await expectTableFormReady(page);
    await expect(page.getByPlaceholder('記録者')).toHaveValue('E2E 記録者');
    await expect(page.getByTestId('daily-table-draft-status')).toBeVisible();

    await submitFromTableForm(page);
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/today$/);

    const remainingDraft = await page.evaluate((storageKey) => localStorage.getItem(storageKey), DAILY_TABLE_DRAFT_STORAGE_KEY);
    expect(remainingDraft).toBeNull();

    await page.goto(tablePath);
    await expectTableFormReady(page);
    await expect(page.getByPlaceholder('記録者')).toBeVisible();
  });
});

test.describe('日次記録: /daily/table unsent recovery flow', () => {
  test('unsent-only ON then submit turns filter OFF when unsent reaches zero', async ({ page }) => {
    await bootDailyTablePage(page, {
      path: `${tablePath}&unsent=1`,
      unsentFilter: true,
      draft: {
        reporterName: '未送信回収E2E',
        selectedUserIds: [DAILY_TABLE_E2E_USER_ID],
      },
    });

    await expectTableFormReady(page);
    await expect(page.getByTestId('daily-table-unsent-count-chip')).toBeVisible();

    await submitFromTableForm(page);
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/today$/);
    const unsentFilter = await page.evaluate(() => localStorage.getItem('daily-table-record:unsent-filter:v1'));
    expect(unsentFilter).toBeNull();

    await page.goto(tablePath);
    await expectTableFormReady(page);
    await expect(page).not.toHaveURL(/unsent=1/);
  });
});

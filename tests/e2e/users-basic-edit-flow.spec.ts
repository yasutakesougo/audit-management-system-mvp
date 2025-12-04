import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootUsersPage } from './_helpers/bootUsersPage';

const TARGET_USER_NAME = '田中 太郎';

const buildRowLocator = (page: Page) =>
  page
    .getByTestId(TESTIDS['users-list-table'])
    .locator('tbody tr', { hasText: TARGET_USER_NAME })
    .first();

test.describe('users basic info edit flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('https://graph.microsoft.com/**', (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ value: [] }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    await bootUsersPage(page, {
      seed: { usersMaster: true },
    });
  });

  test('edits furigana from the basic info tab', async ({ page }) => {
    await page.getByRole('tab', { name: /利用者一覧/ }).click();

    const listTable = page.getByTestId(TESTIDS['users-list-table']);
    await expect(listTable).toBeVisible();
    await expect(listTable).toContainText(TARGET_USER_NAME);

    const targetRow = buildRowLocator(page);
    await targetRow.locator('[aria-label="詳細"]').click();

    const detailSections = page.getByTestId(TESTIDS['user-detail-sections']);
    await expect(detailSections).toBeVisible();
    const furiganaValue = detailSections
      .locator('dt', { hasText: 'ふりがな' })
      .first()
      .locator('xpath=following-sibling::*[1]');
    await expect(furiganaValue).toHaveText('未登録');

    await targetRow.locator('[aria-label="編集"]').click();

    const editForm = page.getByRole('form', { name: '利用者情報編集フォーム' });
    await expect(editForm).toBeVisible();

    const updatedKana = 'たなか たろう（編集済み）';
    await editForm.getByLabel('ふりがな').fill(updatedKana);

    await editForm.getByRole('button', { name: '保存' }).click();
    await editForm.waitFor({ state: 'detached' });

    const detailPane = page.getByTestId(TESTIDS['users-detail-pane']);
    await expect(detailPane).toContainText(updatedKana);
    await expect(furiganaValue).toHaveText(updatedKana);
  });
});

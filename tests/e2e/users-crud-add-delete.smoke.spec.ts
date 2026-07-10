import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootUsersPage } from './_helpers/bootUsersPage.mjs';

const userRow = (page: Page, userName: string) =>
  page.getByTestId(TESTIDS['users-list-table']).locator('tbody tr', { hasText: userName }).first();

const showUsersList = async (page: Page): Promise<void> => {
  const listButton = page
    .getByRole('tab', { name: /利用者一覧/i })
    .or(page.getByRole('button', { name: /利用者一覧を表示/i }))
    .first();

  const isListButtonVisible = await listButton.isVisible({ timeout: 2000 }).catch(() => false);
  if (isListButtonVisible) {
    await listButton.click();
    await page.waitForLoadState('networkidle');
  }
  await expect(page.getByTestId(TESTIDS['users-list-table'])).toBeVisible({ timeout: 10000 });
};

const createUser = async (page: Page, userName: string): Promise<void> => {
  const createButton = page
    .getByRole('tab', { name: /新規利用者登録/i })
    .or(page.getByRole('button', { name: /新規利用者登録/i }))
    .first();
  await expect(createButton).toBeVisible({ timeout: 10000 });
  await createButton.click();

  const nameInput = page.getByLabel(/氏名/i);
  await expect(nameInput).toBeVisible({ timeout: 5000 });
  await nameInput.fill(userName);

  const submitButton = page.getByRole('button', { name: /簡易作成/i });
  await expect(submitButton).toBeEnabled({ timeout: 5000 });
  await submitButton.click();
  await page.waitForLoadState('networkidle');

  await showUsersList(page);
  await page.getByTestId(TESTIDS['users-panel-filter-active']).click();
  await page.getByTestId(TESTIDS['users-panel-search']).getByRole('textbox').fill(userName);
  await expect(userRow(page, userName)).toBeVisible({ timeout: 10000 });
};

const deleteUser = async (
  page: Page,
  userName: string,
  contractAction: 'confirm' | 'cancel',
): Promise<void> => {
  const deleteButton = userRow(page, userName).getByRole('button', { name: /契約終了|削除/i });
  await expect(deleteButton).toBeVisible({ timeout: 5000 });
  await deleteButton.click();

  const contractDialog = page.getByRole('dialog', { name: /契約終了|削除/ });
  await expect(contractDialog).toBeVisible({ timeout: 5000 });
  if (contractAction === 'confirm') {
    await contractDialog.getByRole('button', { name: /契約終了にする|削除/ }).click();
  } else {
    await contractDialog.getByRole('button', { name: /キャンセル/ }).click();
  }
  await expect(contractDialog).not.toBeVisible({ timeout: 10000 });

  await page.waitForLoadState('networkidle');
  await page.waitForLoadState('domcontentloaded');
};

const expectHiddenFromActiveList = async (page: Page, userName: string): Promise<void> => {
  await page.getByTestId(TESTIDS['users-panel-filter-active']).click();
  await expect(userRow(page, userName)).not.toBeVisible({ timeout: 10000 });
};

test.describe('Users CRUD add/delete smoke', () => {
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }, testInfo) => {
    await bootUsersPage(
      page,
      {
        route: '/users',
        autoNavigate: true,
      },
      testInfo,
    );
  });

  test('add user -> verify in list -> cancel delete -> still visible', async ({ page }) => {
    const testUserName = `テスト次郎_${Date.now()}`;

    await createUser(page, testUserName);
    await deleteUser(page, testUserName, 'cancel');

    await expect(userRow(page, testUserName)).toBeVisible({ timeout: 5000 });

    await deleteUser(page, testUserName, 'confirm');
    await expectHiddenFromActiveList(page, testUserName);
  });

  test('add user -> verify in list -> confirm delete -> removed', async ({ page }) => {
    const testUserName = `テスト太郎_${Date.now()}`;

    await createUser(page, testUserName);
    await deleteUser(page, testUserName, 'confirm');

    await expectHiddenFromActiveList(page, testUserName);
  });
});

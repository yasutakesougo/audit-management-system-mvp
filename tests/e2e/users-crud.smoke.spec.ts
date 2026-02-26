/**
 * Users CRUD Smoke Test (#339)
 *
 * 目的:
 * - Users CRUD（追加→削除）の基本フローを自動検証
 * - bootUsersPage でモックAPI環境を整備
 *
 * 前提:
 * - bootUsersPage() により環境変数、SharePointスタブ、demoユーザーがセットアップ済み
 */

import { expect, test } from '@playwright/test';
import { bootUsersPage } from './_helpers/bootUsersPage';

// TODO: Re-enable after optimizing smoke test performance (currently timing out at 20 min)
test.describe('Users CRUD smoke', () => {
  test.beforeEach(async ({ page }) => {
    // bootUsersPage で環境をセットアップ
    await bootUsersPage(page, {
      route: '/users',
      autoNavigate: true,
    });

    // window.confirm をモック化（削除確認ダイアログ）
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') {
        await dialog.accept();
      }
    });
  });

  test('add user → verify in list → delete', async ({ page }) => {
    const testUserName = `テスト太郎_${Date.now()}`;

    // Step 1: Navigate to create tab
    const createButton = page.getByRole('tab', { name: /新規利用者登録/i }).or(page.getByRole('button', { name: /新規利用者登録/i })).first();
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // Step 2: Fill in user name and create
    const nameInput = page.getByLabel(/氏名/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(testUserName);

    const submitButton = page.getByRole('button', { name: /簡易作成/i });
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();

    // Step 3: Navigate to list tab (app should auto-navigate after creation)
    await page.waitForLoadState('networkidle');

    // If still on create tab, click "利用者一覧を表示"
    const listButton = page.getByRole('tab', { name: /利用者一覧/i }).or(page.getByRole('button', { name: /利用者一覧を表示/i })).first();
    const isListButtonVisible = await listButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (isListButtonVisible) {
      await listButton.click();
      await page.waitForLoadState('networkidle');
    }

    // Step 4: Verify user appears in list
    await expect(page.getByText(testUserName)).toBeVisible({ timeout: 10000 });

    // Step 5: Delete user
    const userRow = page.locator('tr', { has: page.getByText(testUserName) });
    const deleteButton = userRow.getByRole('button', { name: /削除/i });
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    // Step 6: Wait for dialog to be processed and deletion to complete
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Step 7: Verify user is deleted
    await expect(page.getByText(testUserName)).not.toBeVisible({ timeout: 10000 });
  });

  test('cancel deletion (if dialog exists)', async ({ page }) => {
    const testUserName = `テスト次郎_${Date.now()}`;

    // Override dialog handler to dismiss (cancel)
    page.removeAllListeners('dialog');
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') {
        await dialog.dismiss();
      }
    });

    // Create user (same as above)
    const createButton = page.getByRole('tab', { name: /新規利用者登録/i }).or(page.getByRole('button', { name: /新規利用者登録/i })).first();
    await createButton.click();

    const nameInput = page.getByLabel(/氏名/i);
    await nameInput.fill(testUserName);

    const submitButton = page.getByRole('button', { name: /簡易作成/i });
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();

    await page.waitForLoadState('networkidle');

    const listButton = page.getByRole('tab', { name: /利用者一覧/i }).or(page.getByRole('button', { name: /利用者一覧を表示/i })).first();
    const isListButtonVisible = await listButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (isListButtonVisible) {
      await listButton.click();
      await page.waitForLoadState('networkidle');
    }

    await expect(page.getByText(testUserName)).toBeVisible({ timeout: 10000 });

    // Try to delete but cancel
    const userRow = page.locator('tr', { has: page.getByText(testUserName) });
    const deleteButton = userRow.getByRole('button', { name: /削除/i });
    await deleteButton.click();

    await page.waitForTimeout(500);

    // Verify user still exists (deletion was cancelled)
    await expect(page.getByText(testUserName)).toBeVisible({ timeout: 5000 });
  });
});

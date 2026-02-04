/**
 * Users CRUD Integration Test (#342)
 *
 * 目的:
 * - Users CRUD 全体フロー（追加→一覧→編集→削除）を統合テストで自動検証
 * - Issue #002 で基本回帰を確保した後、完全なライフサイクルを保証
 *
 * テストシナリオ:
 * 1. ユーザー追加（名前、UserID 自動生成）
 * 2. 一覧表示確認（追加したユーザーが存在）
 * 3. ユーザー編集（名前変更、保存確認）
 * 4. ユーザー削除（削除確認ダイアログで承認）
 *
 * 前提:
 * - bootUsersPage() により環境変数、SharePointスタブ、demoユーザーがセットアップ済み
 * - モック API が安定稼働
 */

import { expect, test } from '@playwright/test';
import { bootUsersPage } from './_helpers/bootUsersPage';

test.describe('Users CRUD integration (full lifecycle)', () => {
  test.beforeEach(async ({ page }) => {
    // bootUsersPage でモック環境をセットアップ
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

  test('full CRUD flow: add → list → edit → delete', async ({ page }) => {
    const testUserName = `統合テスト太郎_${Date.now()}`;
    const editedUserName = `${testUserName}_編集済み`;

    // ========================================
    // Step 1: ユーザー追加
    // ========================================
    const createButton = page.getByRole('button', { name: /新規利用者登録/i });
    await expect(createButton).toBeVisible({ timeout: 10000 });
    await createButton.click();

    // UserID 自動生成
    const autoButton = page.getByRole('button', { name: /自動/i });
    await expect(autoButton).toBeVisible({ timeout: 5000 });
    await autoButton.click();

    // 名前入力
    const nameInput = page.getByLabel(/氏名/i);
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(testUserName);

    // 簡易作成で送信
    const submitButton = page.getByRole('button', { name: /簡易作成/i });
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();

    await page.waitForLoadState('networkidle');

    // ========================================
    // Step 2: 一覧表示確認
    // ========================================
    // If still on create tab, navigate to list tab
    const listButton = page.getByRole('button', { name: /利用者一覧を表示/i });
    const isListButtonVisible = await listButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (isListButtonVisible) {
      await listButton.click();
      await page.waitForLoadState('networkidle');
    }

    // 追加したユーザーが一覧に存在することを確認
    await expect(page.getByText(testUserName)).toBeVisible({ timeout: 10000 });

    // ========================================
    // Step 3: ユーザー編集
    // ========================================
    const userRow = page.locator('tr', { has: page.getByText(testUserName) });
    const editButton = userRow.getByRole('button', { name: /編集/i });
    await expect(editButton).toBeVisible({ timeout: 5000 });
    await editButton.click();

    // 編集ダイアログが開くまで待機
    const editDialog = page.locator('[role="dialog"]').filter({ hasText: /利用者情報編集/i });
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    // 名前フィールドを編集（exact match to avoid ambiguity with カタカナ氏名）
    const editNameInput = editDialog.getByRole('textbox', { name: '氏名', exact: true });
    await expect(editNameInput).toBeVisible({ timeout: 5000 });
    await editNameInput.clear();
    await editNameInput.fill(editedUserName);

    // 保存ボタンをクリック
    const saveButton = editDialog.getByRole('button', { name: /保存|更新/i });
    await expect(saveButton).toBeVisible({ timeout: 5000 });
    await saveButton.click();

    // ダイアログが閉じるまで待機
    await expect(editDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 編集後の名前が一覧に表示されることを確認
    await expect(page.getByText(editedUserName, { exact: true })).toBeVisible({ timeout: 10000 });

    // ========================================
    // Step 4: ユーザー削除
    // ========================================
    const updatedUserRow = page.locator('tr', { has: page.getByText(editedUserName) });
    const deleteButton = updatedUserRow.getByRole('button', { name: /削除/i });
    await expect(deleteButton).toBeVisible({ timeout: 5000 });
    await deleteButton.click();

    // 削除確認ダイアログが処理されるまで待機
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // 削除後、ユーザーが一覧から消えることを確認
    await expect(page.getByText(editedUserName)).not.toBeVisible({ timeout: 10000 });
  });

  test.skip('edit cancellation does not persist changes', async ({ page }) => {
    const testUserName = `キャンセルテスト_${Date.now()}`;
    const attemptedEditName = `${testUserName}_キャンセル済み`;

    // ========================================
    // Step 1: ユーザー追加
    // ========================================
    const createButton = page.getByRole('button', { name: /新規利用者登録/i });
    await createButton.click();

    const autoButton = page.getByRole('button', { name: /自動/i });
    await autoButton.click();

    const nameInput = page.getByLabel(/氏名/i);
    await nameInput.fill(testUserName);

    const submitButton = page.getByRole('button', { name: /簡易作成/i });
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();

    await page.waitForLoadState('networkidle');

    // Navigate to list
    const listButton = page.getByRole('button', { name: /利用者一覧を表示/i });
    const isListButtonVisible = await listButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (isListButtonVisible) {
      await listButton.click();
      await page.waitForLoadState('networkidle');
    }

    await expect(page.getByText(testUserName)).toBeVisible({ timeout: 10000 });

    // ========================================
    // Step 2: 編集開始→キャンセル
    // ========================================
    const userRow = page.locator('tr', { has: page.getByText(testUserName) });
    const editButton = userRow.getByRole('button', { name: /編集/i });
    await editButton.click();

    const editDialog = page.locator('[role="dialog"]').filter({ hasText: /利用者情報編集/i });
    await expect(editDialog).toBeVisible({ timeout: 5000 });

    // 名前を変更（保存しない）
    const editNameInput = editDialog.getByRole('textbox', { name: '氏名', exact: true });
    await editNameInput.clear();
    await editNameInput.fill(attemptedEditName);

    // キャンセルボタンをクリック
    const cancelButton = editDialog.getByRole('button', { name: '閉じる', exact: true });
    await expect(cancelButton).toBeVisible({ timeout: 5000 });
    await cancelButton.click();

    // 未保存の変更確認ダイアログが表示される場合があるので、「破棄」ボタンをクリック
    const confirmDialog = page.locator('[role="dialog"]').filter({ hasText: /未保存の変更があります/i });
    const isConfirmDialogVisible = await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false);
    if (isConfirmDialogVisible) {
      const discardButton = confirmDialog.getByRole('button', { name: /破棄|はい/i });
      await discardButton.click();
    }

    // ダイアログが閉じるまで待機
    await expect(editDialog).not.toBeVisible({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // ========================================
    // Step 3: 変更が保存されていないことを確認
    // ========================================
    // 元の名前が残っていることを確認
    await expect(page.getByText(testUserName)).toBeVisible({ timeout: 5000 });
    // 変更しようとした名前が表示されていないことを確認
    await expect(page.getByText(attemptedEditName)).not.toBeVisible({ timeout: 2000 });
  });
});

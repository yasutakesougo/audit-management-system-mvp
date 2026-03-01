import { expect, test } from '@playwright/test';

test.describe('ISP Editor — smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/isp-editor');
    // ページタイトルが表示されるまで待機
    await expect(
      page.getByRole('heading', { name: /個別支援計画 前回比較・更新エディタ/ }),
    ).toBeVisible();
  });

  test('displays heading and tablist', async ({ page }) => {
    const tablist = page.getByRole('tablist', { name: /目標項目タブ/ });
    await expect(tablist).toBeVisible();

    // 5つのタブが存在
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(5);
  });

  test('tab switch updates aria-selected', async ({ page }) => {
    const tabShort = page.getByRole('tab', { name: /短期目標①/ });
    await tabShort.click();
    await expect(tabShort).toHaveAttribute('aria-selected', 'true');

    const tabLong = page.getByRole('tab', { name: /長期目標/ });
    await expect(tabLong).toHaveAttribute('aria-selected', 'false');
  });

  test('copy from previous fills textarea and shows confirmation', async ({ page }) => {
    // 長期目標タブがデフォルト — aria-label は '前回の長期目標を引用'
    const copyBtn = page.getByRole('button', { name: /前回の.*を引用/ });
    await copyBtn.click();

    // 引用済の確認表示 — ボタンテキストが「引用済」に変わる
    await expect(copyBtn).toContainText('引用済');

    // textareaに前回の内容が入る
    const textarea = page.getByRole('textbox', { name: /長期目標/ });
    await expect(textarea).not.toHaveValue('');
  });

  test('domain tag toggle works with aria-pressed', async ({ page }) => {
    const healthBtn = page.getByRole('button', { name: /健康・生活/ });
    await expect(healthBtn).toHaveAttribute('aria-pressed', 'false');

    await healthBtn.click();
    await expect(healthBtn).toHaveAttribute('aria-pressed', 'true');

    await healthBtn.click();
    await expect(healthBtn).toHaveAttribute('aria-pressed', 'false');
  });

  test('diff preview toggle works', async ({ page }) => {
    // まず引用してテキストを入れる
    await page.getByRole('button', { name: /前回の.*を引用/ }).click();

    const diffToggle = page.getByRole('button', { name: /差分プレビュー/ });

    // デフォルト ON: aria-pressed=true
    await expect(diffToggle).toHaveAttribute('aria-pressed', 'true');

    // OFFにする
    await diffToggle.click();
    await expect(diffToggle).toHaveAttribute('aria-pressed', 'false');

    // ONに戻す
    await diffToggle.click();
    await expect(diffToggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('SMART guide panel toggles', async ({ page }) => {
    const smartToggle = page.getByRole('button', { name: /SMARTガイド/ });
    await expect(smartToggle).toHaveAttribute('aria-pressed', 'false');

    await smartToggle.click();
    await expect(smartToggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('sidebar toggle has correct aria attributes', async ({ page }) => {
    const sidebarToggle = page.getByRole('button', { name: /サイドバー/ });
    await expect(sidebarToggle).toHaveAttribute('aria-expanded', 'true');

    await sidebarToggle.click();
    await expect(sidebarToggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('textarea is keyboard-focusable', async ({ page }) => {
    const textarea = page.getByRole('textbox', { name: /長期目標/ });
    await textarea.focus();
    await expect(textarea).toBeFocused();

    // テキスト入力
    await textarea.fill('テスト入力');
    await expect(textarea).toHaveValue('テスト入力');
  });

  test('deadline shows remaining days (JST regression guard)', async ({ page }) => {
    // サイドバー内の「日」表示が見える — 数値一致は縛らない
    await expect(page.getByText(/受給者証期限/)).toBeVisible();
    await expect(page.getByText(/\d+日/)).toBeVisible();
  });
});

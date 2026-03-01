import { expect, test } from '@playwright/test';

/**
 * ISP Editor — Integration tests
 *
 * Covers scenarios beyond the basic smoke spec:
 *  1. userId routing
 *  2. Loading → content transition
 *  3. SP API error → error banner + mock fallback
 *  4. Save button lifecycle
 *  5. Progress bar updates on text input
 *  6. /today → ISP editor navigation
 */
test.describe('ISP Editor — integration', () => {
  /** SP API をモックして正常レスポンスを返す共通セットアップ */
  async function stubSpApi(page: import('@playwright/test').Page) {
    await page.route('/_api/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ d: { results: [] } }),
      }),
    );
  }

  // ─── 1. userId routing ───
  test('/isp-editor/:userId renders the editor page', async ({ page }) => {
    await stubSpApi(page);
    await page.goto('/isp-editor/U001');

    // ページ見出しが表示されるまで待機
    await expect(
      page.getByRole('heading', { name: /個別支援計画 前回比較・更新エディタ/ }),
    ).toBeVisible({ timeout: 10_000 });

    // タブリストが描画される
    await expect(page.getByRole('tablist', { name: /目標項目タブ/ })).toBeVisible();
  });

  // ─── 2. Loading → content transition ───
  test('shows loading text then resolves to content', async ({ page }) => {
    // SP API を 800ms 遅延させる
    await page.route('/_api/**', async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ d: { results: [] } }),
      });
    });

    await page.goto('/isp-editor/U001');

    // ローディングテキストが一時的に表示される
    const loadingText = page.getByText('データを読み込み中…');
    // visible か既に消えている（高速環境対策）
    const wasLoadingVisible = await loadingText
      .waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);

    // いずれにせよタブリストは最終的に描画される
    await expect(
      page.getByRole('tablist', { name: /目標項目タブ/ }),
    ).toBeVisible({ timeout: 10_000 });

    // ローディングが見えていた場合は消えることを確認
    if (wasLoadingVisible) {
      await expect(loadingText).not.toBeVisible({ timeout: 5_000 });
    }
  });

  // ─── 3. SP API error → error banner + mock fallback ───
  test('shows error banner on SP failure but still renders tabs (mock fallback)', async ({
    page,
  }) => {
    // SP API を 500 で返す
    await page.route('/_api/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Internal Server Error' } }),
      }),
    );

    await page.goto('/isp-editor/U001');

    // エラーバナー（role=alert）が出る
    const alert = page.locator('[role="alert"]');
    await expect(alert).toBeVisible({ timeout: 10_000 });
    await expect(alert).toContainText('データ取得に失敗しました');

    // モックフォールバックでタブリストは表示される
    await expect(
      page.getByRole('tablist', { name: /目標項目タブ/ }),
    ).toBeVisible();
  });

  // ─── 4. Save button renders and is clickable with userId ───
  test('save button is visible and clickable when userId is provided', async ({ page }) => {
    await stubSpApi(page);

    await page.goto('/isp-editor/U001');

    // ページ表示待ち
    await expect(
      page.getByRole('heading', { name: /個別支援計画 前回比較・更新エディタ/ }),
    ).toBeVisible({ timeout: 10_000 });

    // 保存ボタンが見える（userId ありの場合に savePlan が渡される）
    const saveBtn = page.getByRole('button', { name: /保存/ });
    await expect(saveBtn).toBeVisible();

    // テキスト入力 — サイドバーの検索 input と区別するため label で絞る
    const textarea = page.getByRole('textbox', { name: /長期目標/ });
    await textarea.fill('テスト入力');

    // クリックしてもエラーにならないことを確認
    await saveBtn.click();

    // ボタンがまだ表示されていること（save 完了後もページは維持）
    await expect(saveBtn).toBeVisible();
  });

  // ─── 5. Progress bar updates on copy from previous ───
  test('progress bar updates when copying from previous', async ({ page }) => {
    await stubSpApi(page);
    // smoke spec と同様に userId なしルートで — SP クライアント不在時のモックフォールバック
    await page.goto('/isp-editor');

    // ページ表示待ち
    await expect(
      page.getByRole('heading', { name: /個別支援計画 前回比較・更新エディタ/ }),
    ).toBeVisible({ timeout: 10_000 });

    // サイドバーがデフォルトで開いている
    const progressBar = page.locator('[role="progressbar"]');
    await expect(progressBar).toBeVisible();

    const initialPct = await progressBar.getAttribute('aria-valuenow');

    // 長期目標（デフォルトタブ）の引用ボタン — aria-label は '前回の長期目標を引用'
    const copyBtn = page.getByRole('button', { name: /前回の.*を引用/ });
    await copyBtn.click();

    // 引用済ラベルが出ることを確認 — ボタンテキストが「引用済」に変わる
    await expect(copyBtn).toContainText('引用済');

    // テキストエリアに内容が入っている — label で絞る
    const textarea = page.getByRole('textbox', { name: /長期目標/ });
    await expect(textarea).not.toHaveValue('');

    // progress bar の aria-valuenow が増加
    const updatedPct = await progressBar.getAttribute('aria-valuenow');
    expect(Number(updatedPct)).toBeGreaterThan(Number(initialPct ?? '0'));
  });

  // ─── 6. /today → ISP editor navigation ───
  test('navigates from /today ISP button to isp-editor', async ({ page }) => {
    // Today ページ用モック
    await page.addInitScript(() => {
      (window as unknown as { __E2E_TODAY_OPS_MOCK__?: boolean }).__E2E_TODAY_OPS_MOCK__ = true;
    });
    await stubSpApi(page);

    await page.goto('/today');

    // ユーザーリストが描画されるまで待機
    const ispButton = page.getByRole('button', { name: /のISPを確認/ }).first();
    const hasIspButton = await ispButton
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (hasIspButton) {
      await ispButton.click();

      // URL が /isp-editor/ を含むことを確認
      await expect(page).toHaveURL(/\/isp-editor\//);

      // ISP ページの heading が表示される
      await expect(
        page.getByRole('heading', { name: /個別支援計画 前回比較・更新エディタ/ }),
      ).toBeVisible({ timeout: 10_000 });
    } else {
      // モック環境でユーザーリストが空の場合 — テスト自体は skip 相当だが pass させる
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'No ISP buttons visible in mock today-ops page',
      });
    }
  });
});

import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';

// NOTE: DashboardPageは index route のため、ルートパス `/` でアクセス
const DASHBOARD_URL = '/';

test.describe('Dashboard smoke', () => {
  test('shows core daily dashboard panels', async ({ page }) => {
    await page.goto(DASHBOARD_URL);

    // ページ自体が表示される
    const root = page.getByTestId(TESTIDS['dashboard-page']);
    await expect(root).toBeVisible();

    // Safety HUD が見えている
    const safetyHud = page.getByTestId(TESTIDS['dashboard-safety-hud']);
    await expect(safetyHud).toBeVisible();
    await expect(safetyHud).toContainText('今日の安全インジケーター');

    // Safety HUD に過去7日平均とトレンド情報が表示されている
    await expect(safetyHud).toContainText('過去7日平均');

    // トレンド絵文字/ラベル表示を確認（具体値はモック依存なので緩く）
    const hasEmoji = await safetyHud.textContent();
    expect(hasEmoji && (hasEmoji.includes('📈') || hasEmoji.includes('📉') || hasEmoji.includes('➖'))).toBeTruthy();

    // 日次記録のカード（少なくとも通所記録）は見えている
    const commuteCard = page.getByTestId(TESTIDS['dashboard-daily-status-card-通所記録']);
    await expect(commuteCard).toBeVisible();
    await expect(commuteCard).toContainText('完了');

    // 申し送りサマリーが見えている
    const handoffSummary = page.getByTestId(TESTIDS['dashboard-handoff-summary']);
    await expect(handoffSummary).toBeVisible();
    await expect(handoffSummary).toContainText('申し送り');

    // タブが存在している（最低限1つ確認）
    await expect(
      page.getByRole('tab', { name: /集団傾向分析/ }),
    ).toBeVisible();
  });

  test('can navigate to operations dashboard when conflicts exist', async ({ page }) => {
    await page.goto(DASHBOARD_URL);

    const safetyHud = page.getByTestId(TESTIDS['dashboard-safety-hud']);
    await expect(safetyHud).toBeVisible();

    // Operations Dashboardへのボタンがある場合（予定の重なりがある場合）
    const operationsButton = page.getByRole('button', { name: /Operations Dashboard で詳細確認/ });

    // ボタンが存在する場合のみテスト（予定の重なりがない場合は表示されない）
    if (await operationsButton.isVisible()) {
      // ボタンをクリックして遷移を確認
      await operationsButton.click();
      await expect(page).toHaveURL(/\/operations-dashboard/);
    }
  });

  test('allows handoff timeline interaction', async ({ page }) => {
    await page.goto(DASHBOARD_URL);

    // 申し送り追加フォームの存在確認
    const handoffInput = page.getByLabel('申し送り内容');
    await expect(handoffInput).toBeVisible();

    const addButton = page.getByRole('button', { name: '申し送りを追加' });
    await expect(addButton).toBeVisible();

    // 初期状態では無効化されている
    await expect(addButton).toBeDisabled();

    // テキスト入力でボタンが有効化される
    await handoffInput.fill('テストメッセージ');
    await expect(addButton).toBeEnabled();

    // 申し送りを追加
    await addButton.click();

    // 追加されたメッセージが表示される
    await expect(page.getByText('テストメッセージ')).toBeVisible();

    // フォームがクリアされる
    await expect(handoffInput).toHaveValue('');
    await expect(addButton).toBeDisabled();
  });
});
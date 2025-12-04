import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootNursePage } from './_helpers/bootNursePage';

/**
 * Nurse Dashboard – happy path (dev fixture)
 *
 * 目的:
 * - `nurse.dashboard.dev.v1.json` を seed として /daily/health (看護トップ) を起動
 * - ダッシュボードのサマリ件数とタスク行が JSON と一致していることを保証する
 * - 看護 UI のレイアウトやカード構成が変わっても「数字と並び」を守る幹ルート
 *
 * 更新が必要になるタイミング:
 * - `nurse.dashboard.dev.v1.json` の構造や件数を変えたとき
 * - 看護ダッシュボードに新しい重要メトリクスやカードを追加したとき
 * - HealthObservationPage.tsx のレイアウト変更で testid を貼り替えたとき
 */
test.describe('Nurse Dashboard – happy path (dev fixture)', () => {
  test('shows seeded nurse dashboard summary and tasks', async ({ page }) => {
    await bootNursePage(page, {
      seed: { nurseDashboard: true },
    });

    await page.goto('/daily/health');

    await expect(page).toHaveURL(/\/daily\/health$/);

    const root = page.getByTestId(TESTIDS['nurse-dashboard-root']);
    await expect(root).toBeVisible();

    await expect(page.getByTestId(TESTIDS['nurse-dashboard-summary-total'])).toContainText('3');
    await expect(page.getByTestId(TESTIDS['nurse-dashboard-summary-pending'])).toContainText('2');
    await expect(page.getByTestId(TESTIDS['nurse-dashboard-summary-in-progress'])).toContainText('1');
    await expect(page.getByTestId(TESTIDS['nurse-dashboard-summary-completed'])).toContainText('0');

    const rows = page.getByTestId(TESTIDS['nurse-dashboard-task-row']);
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('佐藤 太郎');
    await expect(rows.nth(1)).toContainText('山田 花子');
    await expect(rows.nth(2)).toContainText('石井 次郎');
  });
});

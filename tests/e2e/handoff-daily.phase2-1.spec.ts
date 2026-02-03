/**
 * Phase 2-1: 申し送り → 支援記録 フォーカス遷移のE2Eテスト
 *
 * 検証内容:
 * - HandoffTimeline の各カードに「この利用者の記録を開く」CTA が表示される
 * - CTA をクリックすると /daily/activity へ遷移する
 * - 該当利用者のカードがハイライト表示される
 * - ハイライトバナー「📌 申し送りから移動しました」が一時表示される
 */

import { expect, test } from '@playwright/test';
import { primeOpsEnv } from './helpers/ops';

test.describe('Phase 2-1: handoff → daily highlight navigation', () => {
  test.beforeEach(async ({ page }) => {
    await primeOpsEnv(page);
  });

  test('timeline item から daily に遷移し、該当利用者がハイライトされる', async ({ page }) => {
    // ✅ localStorage seed: 申し送りデータを投入（ページ遷移前）
    await page.goto('/handoff-timeline', { waitUntil: 'domcontentloaded' });

    // データを投入（StorageShape 形式: Record<dateKey, HandoffRecord[]>）
    await page.evaluate(() => {
      const key = 'handoff.timeline.dev.v1';
      const today = new Date();
      const y = today.getFullYear();
      const m = `${today.getMonth() + 1}`.padStart(2, '0');
      const d = `${today.getDate()}`.padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;

      const payload = {
        [dateKey]: [
          {
            id: 1,
            userCode: '001', // テスト用の既存利用者ID（田中太郎）
            userDisplayName: '田中太郎',
            message: 'E2E highlight test - この利用者の記録を確認してください',
            severity: '重要',
            category: '体調',
            dateYmd: dateKey,
            timeBand: 'morning',
            status: '未対応',
            createdByName: 'テスト職員',
            createdAt: new Date().toISOString(),
          },
        ],
      };
      localStorage.setItem(key, JSON.stringify(payload));
    });

    // ページをリロードしてデータを反映
    await page.reload({ waitUntil: 'domcontentloaded' });

    // タイムラインアイテムが表示されるまで待機
    await page.waitForSelector('[data-testid="agenda-timeline-item"]', { timeout: 10_000 });

    // ✅ CTA ボタンが表示されることを確認
    const ctaButton = page.getByTestId('handoff-open-daily-highlight').first();
    await expect(ctaButton).toBeVisible({ timeout: 10_000 });
    await expect(ctaButton).toHaveText(/この利用者の記録を開く/);

    // ✅ CTA をクリック
    await ctaButton.click();

    // ✅ /daily/activity へ遷移
    await expect(page).toHaveURL(/\/daily\/activity/);

    // ✅ 該当利用者のカードが存在する（personId ベース）
    const targetCard = page.getByTestId('daily-record-card-001');
    await expect(targetCard).toBeVisible({ timeout: 10_000 });

    // ✅ ハイライトバナーが一時表示される
    const banner = page.getByTestId('daily-highlight-banner');
    await expect(banner).toBeVisible({ timeout: 5_000 });
    await expect(banner).toHaveText(/申し送りから移動しました/);
  });

  test('userCode が "ALL" の場合、CTA ボタンは表示されない', async ({ page }) => {
    await page.goto('/handoff-timeline', { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      const key = 'handoff.timeline.dev.v1';
      const today = new Date();
      const y = today.getFullYear();
      const m = `${today.getMonth() + 1}`.padStart(2, '0');
      const d = `${today.getDate()}`.padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;

      const payload = {
        [dateKey]: [
          {
            id: 2,
            userCode: 'ALL', // 全体向け申し送り
            userDisplayName: '全体',
            message: '全体連絡: 明日は避難訓練があります',
            severity: '通常',
            category: 'その他',
            dateYmd: dateKey,
            timeBand: 'morning',
            status: '未対応',
            createdByName: 'テスト職員',
            createdAt: new Date().toISOString(),
          },
        ],
      };
      localStorage.setItem(key, JSON.stringify(payload));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });

    // タイムラインアイテムが表示されることを確認
    await page.waitForSelector('[data-testid="agenda-timeline-item"]', { timeout: 10_000 });

    // ✅ CTA ボタンが存在しないことを確認
    const ctaButton = page.getByTestId('handoff-open-daily-highlight');
    await expect(ctaButton).toHaveCount(0);
  });

  test('申し送りが0件の場合、CTA ボタンは表示されない', async ({ page }) => {
    await page.goto('/handoff-timeline', { waitUntil: 'domcontentloaded' });

    await page.evaluate(() => {
      const key = 'handoff.timeline.dev.v1';
      const payload = {};
      localStorage.setItem(key, JSON.stringify(payload));
    });

    await page.reload({ waitUntil: 'domcontentloaded' });

    // ✅ CTA ボタンが存在しないことを確認
    const ctaButton = page.getByTestId('handoff-open-daily-highlight');
    await expect(ctaButton).toHaveCount(0);
  });
});

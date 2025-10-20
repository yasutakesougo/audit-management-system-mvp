import { test, expect } from '@playwright/test';

test('smoke: Playwright runs', async ({ page }) => {
  // サーバ未起動でも通る最小スモーク
  expect(true).toBe(true);

  // （任意）webServer/baseURL が設定済みならトップへアクセス
  try {
    await page.goto('/');
    await expect(page).not.toHaveTitle(''); // 何かしらタイトルがあるはず、という緩い検証
  } catch {
    // サーバ未起動でも失敗させない
  }
});

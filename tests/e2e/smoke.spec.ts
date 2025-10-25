import { test, expect } from '@playwright/test';

test('env loader & SP init does not crash', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    // デバッグしたくなったらコメントアウト解除
    // console.log('[browser]', msg.type(), msg.text());
  });

  await page.goto('/');

  // env ランタイムが読み込まれている
  const env = await page.evaluate(() => (window as any).__ENV);
  expect(env).toBeTruthy();
  expect(env.MODE).toBeTruthy();

  // SP 関連の必須キー（値はダミーでもOK）
  expect(env.VITE_SP_RESOURCE ?? env.VITE_SP_BASE_URL).toBeTruthy();
  expect(env.VITE_SP_SITE_RELATIVE).toBeTruthy();

  // ErrorBoundary によるクラッシュが起きていない
  expect(errors).toEqual([]);

  // 代表的な UI が描画されている（タイトルやヘッダーなど）
  await expect(page.getByRole('navigation', { name: '主要ナビゲーション' })).toBeVisible();
});

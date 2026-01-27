import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';

// storageState は環境変数で上書き可能（CI/ローカル両対応）
const STORAGE_STATE_PATH =
  process.env.PLAYWRIGHT_STORAGE_STATE ??
  path.resolve(process.cwd(), 'tests/.auth/storageState.json');

const hasStorageState = fs.existsSync(STORAGE_STATE_PATH);

// storageState があるときだけ auth を固定して "確実に緑" にする
test.use({
  baseURL: BASE_URL,
  ...(hasStorageState ? { storageState: STORAGE_STATE_PATH } : {}),
});

test.describe('router smoke (URL direct, testid based)', () => {
  test.beforeEach(async () => {
    // storageState がないかつ VITE_SKIP_LOGIN も設定されていない場合だけ skip
    const skipLoginEnabled = process.env.VITE_SKIP_LOGIN === '1' || process.env.VITE_SKIP_LOGIN === 'true';
    if (!hasStorageState && !skipLoginEnabled) {
      test.skip(
        [
          'storageState.json が存在しないため、この E2E は自動スキップします。',
          `期待パス: ${STORAGE_STATE_PATH}`,
          '',
          '回収方法（推奨）:',
          '1) Playwright の認証セットアップで storageState を生成する',
          '   - 例: tests/e2e/auth.setup.ts → npx playwright test --project=setup',
          '2) もしくはアプリに E2E 用のログインバイパスがあるならそれを有効化する',
          '   - 例: VITE_SKIP_LOGIN=1 など（実装に合わせて）',
        ].join('\n')
      );
    }
  });

  test('GET /audit renders audit-root', async ({ page }) => {
    await page.goto('/audit', { waitUntil: 'domcontentloaded' });

    // ルート診断を速くするため URL も確認（あなたのロードマップに合わせた Done 条件）
    await expect(page).toHaveURL(/\/audit(\b|\/|\?|#)/);

    // 本番アンカー（E2E 用）
    await expect(page.getByTestId('audit-root')).toBeVisible();
  });

  test('GET /checklist renders checklist-root', async ({ page }) => {
    await page.goto('/checklist', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/checklist(\b|\/|\?|#)/);

    await expect(page.getByTestId('checklist-root')).toBeVisible();
  });
});

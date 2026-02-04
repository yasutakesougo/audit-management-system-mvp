/**
 * a11y CI Integration Test - Complex Page (#343)
 *
 * 目的:
 * - RecordList と UsersPanel を組み合わせた複合ページのa11yをスキャン
 * - Issue #340 の単体チェックの拡張として、実際の画面レイアウトで検証
 *
 * 戦略:
 * - **ゲート（fail）**: Users ページは 0 violations を強制（回帰防止）
 * - **レポート（no-fail）**: その他のページは違反を JSON で記録（baseline tracking）
 */

import { expect, test } from '@playwright/test';
import { runA11ySmoke, runA11yScan } from './utils/a11y';
import { bootUsersPage } from './_helpers/bootUsersPage';
import * as fs from 'fs';
import * as path from 'path';

test.describe('a11y CI integration (complex pages)', () => {
  // ========================================
  // ゲート: Users ページは 0 violations を厳格に強制
  // ========================================
  test('users page must have ZERO a11y violations (strict gate)', async ({ page }) => {
    // Users ページは Issue #340 で単体チェック済み、複合ページとして再検証
    await bootUsersPage(page, {
      route: '/users',
      autoNavigate: true,
    });

    // ページが完全に読み込まれるまで待機
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"]')).toBeVisible({ timeout: 10000 });

    // a11y スキャン実行（1件でも違反があれば fail）
    await runA11ySmoke(page, 'users-complex-page', {
      includeBestPractices: false,
    });
  });

  // ========================================
  // レポート: 既存違反のベースライン記録（CI は落とさない）
  // ========================================
  test('dashboard baseline - track violations without failing CI', async ({ page }) => {
    // Dashboard には既知の違反あり:
    // - aria-progressbar-name (LinearProgress)
    // - color-contrast (Chip, Alert)
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(page.locator('main, [role="main"]')).toBeVisible({ timeout: 10000 });

    // 違反を記録（fail しない）
    const results = await runA11yScan(page, 'dashboard-baseline', {
      includeBestPractices: false,
    });

    // JSON として保存（将来的な改善トラッキング用）
    if (results && results.violations.length > 0) {
      const baselineDir = path.join(process.cwd(), 'test-results', 'a11y-baseline');
      fs.mkdirSync(baselineDir, { recursive: true });
      fs.writeFileSync(
        path.join(baselineDir, 'dashboard.json'),
        JSON.stringify(results, null, 2)
      );
      console.log(`📊 Dashboard: ${results.violations.length} violations tracked`);
    }
  });

  test('daily records baseline - track violations without failing CI', async ({ page }) => {
    // Daily には既知の色コントラスト違反あり
    await page.goto('/daily', { waitUntil: 'networkidle' });
    await expect(page.locator('main, [role="main"]')).toBeVisible({ timeout: 10000 });

    const results = await runA11yScan(page, 'daily-baseline', {
      includeBestPractices: false,
    });

    if (results && results.violations.length > 0) {
      const baselineDir = path.join(process.cwd(), 'test-results', 'a11y-baseline');
      fs.mkdirSync(baselineDir, { recursive: true });
      fs.writeFileSync(
        path.join(baselineDir, 'daily.json'),
        JSON.stringify(results, null, 2)
      );
      console.log(`📊 Daily: ${results.violations.length} violations tracked`);
    }
  });

  test('schedules baseline - track violations without failing CI', async ({ page }) => {
    // Schedules には既知のボタンコントラスト違反あり
    await page.goto('/schedules', { waitUntil: 'networkidle' });
    await expect(page.locator('main, [role="main"]')).toBeVisible({ timeout: 10000 });

    const results = await runA11yScan(page, 'schedules-baseline', {
      includeBestPractices: false,
    });

    if (results && results.violations.length > 0) {
      const baselineDir = path.join(process.cwd(), 'test-results', 'a11y-baseline');
      fs.mkdirSync(baselineDir, { recursive: true });
      fs.writeFileSync(
        path.join(baselineDir, 'schedules.json'),
        JSON.stringify(results, null, 2)
      );
      console.log(`📊 Schedules: ${results.violations.length} violations tracked`);
    }
  });
});

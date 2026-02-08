// tests/e2e/dashboard.smoke.spec.ts

/**
 * Dashboard smoke spec
 *
 * 目的:
 * - `/dashboard` が正常に表示されることの「生存確認」
 * - 主要モジュールカード（申し送り / 今日の予定 など）がレンダリングされていることを確認
 *
 * 特徴:
 * - 可能な限り軽量に保つ（seed 依存を最小限に）
 * - UI デザインや copy が多少変わっても落ちにくい「スモークテスト」レベルのアサーションに留める
 *
 * 更新の目安:
 * - Dashboard のレイアウトや主要カード構成が変わったとき
 * - ルーティングや認証周りの挙動が変わり、`/` → `/dashboard` の導線に影響が出たとき
 */
import { expect, test } from '@playwright/test';
import { TESTIDS } from '../../src/testids';
import { bootAgenda } from './_helpers/bootAgenda';

/**
 * Dashboard smoke:
 * - Verifies that navigating to '/' lands on /dashboard and core module cards mount
 * - Confirms primary CTAs (handoff timeline link, schedule button) stay clickable without deterministic fixtures
 * - Uses default demo data rather than seeded JSON; for fixture-locked coverage see dashboard-happy-path.spec.ts
 */

// NOTE: dashboard route renders under /dashboard in current shell
const DASHBOARD_URL = '/dashboard';

test.describe('Dashboard smoke', () => {
  test.beforeEach(async ({ page }) => {
    await bootAgenda(page, {
      seed: { agenda: true, schedulesToday: true },
    });
    await page.goto(DASHBOARD_URL);
  });

  test('shows core daily dashboard panels', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    const root = page.getByTestId(TESTIDS['dashboard-page']);
    await expect(root).toBeVisible({ timeout: 15_000 });

    // Smoke: verify headings exist (minimal UI, avoid fragile text matching)
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByTestId(TESTIDS['dashboard-handoff-summary'])).toBeVisible();
  });

  test('can open schedules from dashboard cta', async ({ page }) => {
    const scheduleButton = page.getByRole('link', { name: 'マスタースケジュールを開く' });
    await expect(scheduleButton).toBeVisible();
    await scheduleButton.click();
    await expect(page).toHaveURL(/\/schedules\/week/);
  });

  test('navigates to handoff timeline from dashboard shortcut', async ({ page }) => {
    const handoff = page.getByTestId(TESTIDS['dashboard-handoff-summary']);
    await expect(handoff).toBeVisible();

    const handoffButton = handoff.getByRole('button', {
      name: /タイムラインを開く|申し送りをもっと見る/,
    });
    await expect(handoffButton).toBeVisible();
    await handoffButton.click();
    await expect(page).toHaveURL(/\/handoff-timeline/);
  });

  test('renders seeded handoff summary counts', async ({ page }) => {
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId(TESTIDS['dashboard-page'])).toBeVisible({ timeout: 15_000 });
    const summaryRoot = page.getByTestId(TESTIDS['dashboard-handoff-summary']);
    await expect(summaryRoot).toBeVisible({ timeout: 15_000 });
    await expect(
      summaryRoot.getByTestId(TESTIDS['dashboard-handoff-summary-total'])
    ).toContainText('3');
  });
});
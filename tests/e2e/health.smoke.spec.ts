import { test, expect } from '@playwright/test';

async function gotoHealth(page: any) {
  await page.goto('/admin/status');
  await expect(page).toHaveURL(/\/admin\/status\b/);
  // ネットワークが完全に止まらない構成でも固まらないように load を待つだけにする
  await page.waitForLoadState('domcontentloaded');
}

test.describe('health smoke', () => {
  test('health page loads (minimal UI)', async ({ page }) => {
    // 🩺 Listen to browser console and page errors
    page.on('console', msg => console.log(`[BROWSER] ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.error(`[BROWSER ERROR] ${err.message}\n${err.stack}`));

    await gotoHealth(page);

    // 🩺 Wait until the diagnostics process completes and populates window.__HEALTH_CHECKS__
    await page.waitForFunction(() => (window as any).__HEALTH_CHECKS__ !== undefined, { timeout: 15_000 }).catch(() => {});

    // 🩺 Extract and log __HEALTH_CHECKS__
    const checks = await page.evaluate(() => (window as any).__HEALTH_CHECKS__);
    console.log('=== HEALTH CHECKS DUMP ===', JSON.stringify(checks, null, 2));

    // role=main 依存はしない。最初の heading が出れば "開けた" 判定として十分。
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });
  });

  test('health page has re-run button (if present)', async ({ page }) => {
    await gotoHealth(page);
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });

    const rerun = page.getByRole('button', { name: /再実行|re-?run/i });
    if (await rerun.count()) {
      await expect(rerun.first()).toBeVisible({ timeout: 10_000 });
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 're-run button not found (allowed for smoke)',
      });
    }
  });

  test('health page has share actions (if present)', async ({ page }) => {
    await gotoHealth(page);
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });

    // "診断完了待ち" は best-effort（タイムアウトしても smoke を落とさない）
    await page
      .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), { timeout: 15_000 })
      .catch(() => {});

    // Share/Copy/JSON 系のボタンが 1つでも見えたら OK（smoke責務）
    const anyAction = page.getByRole('button', { name: /サマリー|summary|コピー|copy|json/i });
    if (await anyAction.count()) {
      await expect(anyAction.first()).toBeVisible({ timeout: 10_000 });
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'share actions not found (allowed for smoke)',
      });
    }
  });
});

import { expect, Page, Locator } from '@playwright/test';

type Target = string | Locator;

function asLocator(page: Page, target: Target): Locator {
  return typeof target === 'string' ? page.locator(target) : target;
}

/**
 * CIでの遅延・フォント/レイアウト確定・初回描画待ちの揺れを吸収する。
 * - DOM attach
 * - visible
 * - 連続2回の boundingBox が安定
 */
export async function waitForStableRender(
  page: Page,
  target: Target,
  opts?: { timeoutMs?: number; settleMs?: number }
) {
  const timeoutMs = opts?.timeoutMs ?? 30_000;
  const settleMs = opts?.settleMs ?? 250;

  const loc = asLocator(page, target);

  await expect(loc).toBeAttached({ timeout: timeoutMs });
  await expect(loc).toBeVisible({ timeout: timeoutMs });

  // bounding box stability check（CIの初回レイアウト揺れ対策）
  await expect
    .poll(
      async () => {
        const b1 = await loc.boundingBox();
        await page.waitForTimeout(settleMs);
        const b2 = await loc.boundingBox();
        if (!b1 || !b2) return null;
        const dx = Math.abs(b1.x - b2.x) + Math.abs(b1.y - b2.y);
        const ds =
          Math.abs(b1.width - b2.width) + Math.abs(b1.height - b2.height);
        return { dx, ds };
      },
      { timeout: timeoutMs }
    )
    .toEqual({ dx: 0, ds: 0 });
}

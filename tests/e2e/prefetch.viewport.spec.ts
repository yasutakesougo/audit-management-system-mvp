import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { prepareHydrationApp } from './_helpers/hydrationHud';

const readSpanCount = (page: Page, key: string, source: string) =>
  page.evaluate(({ key: targetKey, source: targetSource }) => {
    const target = window as typeof window & { __PREFETCH_HUD__?: { spans?: Array<{ key: string; source: string }> } };
    const spans = target.__PREFETCH_HUD__?.spans ?? [];
    return spans.filter((span) => span.key === targetKey && span.source === targetSource).length;
  }, { key, source });

test.describe('Prefetch viewport tracking', () => {
  test.beforeEach(async ({ page }) => {
    await prepareHydrationApp(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('captures a single viewport intent per nav item', async ({ page }) => {
    const hudToggle = page.getByTestId('prefetch-hud-toggle');
    const hud = page.getByTestId('prefetch-hud');
    const hudCount = await hud.count();
    if (hudCount === 0) {
      await hudToggle.click();
    }
    await expect(hud).toBeVisible();

    await expect
      .poll(async () => readSpanCount(page, 'route:admin:templates', 'viewport'))
      .toBeGreaterThan(0);

    const initialCount = await readSpanCount(page, 'route:admin:templates', 'viewport');

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);

    const afterScrollCount = await readSpanCount(page, 'route:admin:templates', 'viewport');
    expect(afterScrollCount).toBe(initialCount);

    await expect(hud).toContainText('route:admin:templates');
    await expect(hud).toContainText('intent:viewport');
  });
});

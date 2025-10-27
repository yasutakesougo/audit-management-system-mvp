import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { prepareHydrationApp } from './_helpers/hydrationHud';

const readPrefetchSpans = async (page: Page) =>
  page.evaluate(() => {
    const target = window as typeof window & { __PREFETCH_HUD__?: { spans?: Array<{ key: string; source: string }> } };
    return target.__PREFETCH_HUD__?.spans ?? [];
  });

test.describe('Prefetch nav shell intents', () => {
  test.beforeEach(async ({ page }) => {
    await prepareHydrationApp(page);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('hover and keyboard navigation are captured in the HUD', async ({ page }) => {
  const hudToggle = page.getByTestId('prefetch-hud-toggle');
  const hud = page.getByTestId('prefetch-hud');
    const hudCount = await hud.count();
    if (hudCount === 0) {
      await hudToggle.click();
    }
    await expect(hud).toBeVisible();

  const schedulesLink = page.getByTestId('nav-schedules');
    await expect(schedulesLink).toBeVisible();
    await schedulesLink.hover();

    await expect.poll(async () => {
      const spans = await readPrefetchSpans(page);
      return spans.some((span) => span.key === 'route:schedules:week' && span.source === 'hover');
    }).toBe(true);

    await expect(hud).toContainText('route:schedules:week');
    await expect(hud).toContainText('intent:hover');

  const auditLink = page.getByTestId('nav-audit');
    await expect(auditLink).toBeVisible();
    await auditLink.focus();
    await page.waitForTimeout(200);
    await page.keyboard.press('Enter');

    await expect.poll(async () => {
      const spans = await readPrefetchSpans(page);
      const span = spans.find((item) => item.key === 'route:audit');
      return span?.source === 'kbd' && span?.meta && span.meta['intent'] === 'kbd';
    }).toBe(true);

    await expect(hud).toContainText('route:audit');
  });
});

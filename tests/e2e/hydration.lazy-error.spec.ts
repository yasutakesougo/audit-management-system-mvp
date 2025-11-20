import { expect, test } from '@playwright/test';

import {
    expectRouteSpan,
    prepareHydrationApp,
    readHydrationSpans,
} from './_helpers/hydrationHud';

const ADMIN_CHUNK_GLOBS = ['**/SupportActivityMasterPage-*.js', '**/SupportActivityMasterPage.tsx'];

test.describe('Route hydration lazy-load failures', () => {
  test('marks the span as error and recovers on subsequent navigation', async ({ page }) => {
    await prepareHydrationApp(page);

    for (const glob of ADMIN_CHUNK_GLOBS) {
      await page.route(glob, (route) => route.abort());
    }

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('main')).toBeVisible();

    const settingsLink = page.getByRole('link', { name: '設定管理', exact: true }).first();
    await settingsLink.click({ noWaitAfter: true });

    await expect(page).toHaveURL(/\/admin\/templates/);

    await expectRouteSpan(page, 'route:admin:templates', {
      status: 'error',
      path: '/admin/templates',
      allowErrors: true,
    });

    const spans = await readHydrationSpans(page);
    const adminSpan = spans.find((span) => span.id === 'route:admin:templates');
    expect(adminSpan).toBeDefined();
    const adminMeta = (adminSpan?.meta ?? {}) as Record<string, unknown>;
    expect(adminMeta.reason).toBe('lazy-import');
    expect(typeof adminSpan?.error === 'string' ? adminSpan?.error.length : 0).toBeGreaterThan(0);

    for (const glob of ADMIN_CHUNK_GLOBS) {
      await page.unroute(glob);
    }

    const recordsLink = page.getByRole('link', { name: '黒ノート', exact: true }).first();
    await recordsLink.click();
    await expect(page).toHaveURL('/');

    await expectRouteSpan(page, 'route:dashboard', {
      status: 'completed',
      allowStatuses: ['pending', 'completed'],
      path: '/',
    });
  });
});

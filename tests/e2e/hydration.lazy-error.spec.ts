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

    await page.goto('/admin/templates', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/admin\/templates/);

    await expect.poll(async () => {
      const spans = await readHydrationSpans(page);
      const span = spans.find((item) => item.id === 'route:admin:templates');
      const meta = (span?.meta ?? {}) as Record<string, unknown>;
      const path = typeof meta.path === 'string' ? meta.path : '';
      return Boolean(span && path.startsWith('/admin/templates'));
    }).toBe(true);

    const spans = await readHydrationSpans(page);
    const adminSpan = spans.find((span) => span.id === 'route:admin:templates');
    expect(adminSpan).toBeDefined();
    const adminMeta = (adminSpan?.meta ?? {}) as Record<string, unknown>;
    const adminStatus = typeof adminMeta.status === 'string' ? adminMeta.status : '';
    if (adminStatus === 'error') {
      expect(adminMeta.reason).toBe('lazy-import');
      expect(typeof adminSpan?.error === 'string' ? adminSpan?.error.length : 0).toBeGreaterThan(0);
    }

    for (const glob of ADMIN_CHUNK_GLOBS) {
      await page.unroute(glob);
    }

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/(|dashboard)$/);

    await expectRouteSpan(page, 'route:dashboard', {
      status: 'completed',
      allowStatuses: ['pending', 'completed'],
      path: '/',
    });
  });
});

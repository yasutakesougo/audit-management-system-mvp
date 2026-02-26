import { expect, test, type Page } from '@playwright/test';

import {
    ROUTE_BUDGETS,
    expectRouteSpan,
    prepareHydrationApp,
    readHydrationSpans,
} from './_helpers/hydrationHud';

const getSchedulesNavLink = (page: Page) => page.getByTestId('nav-schedules').first();

test.describe('Route hydration spans', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('captures dashboard and schedule routes', async ({ page }) => {
  await prepareHydrationApp(page);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('main')).toBeVisible();

    await expectRouteSpan(page, 'route:dashboard', {
      status: 'completed',
      path: '/',
      budget: ROUTE_BUDGETS['route:dashboard'],
    });

    const schedulesLink = getSchedulesNavLink(page);
    await expect(schedulesLink).toBeVisible();
    await schedulesLink.click();
    await expect(page).toHaveURL(/\/schedules\/week/);

    await expectRouteSpan(page, 'route:schedules:week', {
      status: 'completed',
      path: '/schedules/week',
      budget: ROUTE_BUDGETS['route:schedules:week'],
    });

    const spans = await readHydrationSpans(page);
    expect(spans.find((span) => span.id === 'route:dashboard')?.error ?? null).toBeNull();
  });

  test('flags superseded navigation span when overtaken', async ({ page }) => {
  await prepareHydrationApp(page, { delaySchedules: true });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('main')).toBeVisible();

    const scheduleLink = getSchedulesNavLink(page);
    await expect(scheduleLink).toBeVisible();
    await scheduleLink.click({ noWaitAfter: true });
    await page.goto('/admin/templates', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/admin\/templates/);

    await expect.poll(async () => {
      const spans = await readHydrationSpans(page);
      const scheduleSpan = spans.find((span) => span.id === 'route:schedules:week');
      if (!scheduleSpan) return true;

      const meta = (scheduleSpan.meta ?? {}) as Record<string, unknown>;
      const status = typeof meta.status === 'string' ? meta.status : '';
      const path = typeof meta.path === 'string' ? meta.path : '';
      return ['pending', 'superseded'].includes(status) && path.startsWith('/schedules/week');
    }).toBe(true);

    await expectRouteSpan(page, 'route:admin:templates', {
      status: 'completed',
      path: '/admin/templates',
      budget: ROUTE_BUDGETS['route:admin:templates'],
    });
  });
});

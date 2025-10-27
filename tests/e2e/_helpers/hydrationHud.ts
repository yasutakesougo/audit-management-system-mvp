import { expect, type Page } from '@playwright/test';

import { mockEnsureScheduleList } from './mockEnsureScheduleList';
import { setupSharePointStubs } from './setupSharePointStubs';

export type HydrationSpanSnapshot = {
  id: string;
  label: string;
  group?: string;
  duration?: number;
  error?: string | null;
  meta: Record<string, unknown> | null;
};

export type RouteSpanExpectation = {
  status?: string;
  allowStatuses?: string[];
  path?: string;
  budget?: number;
  allowErrors?: boolean;
};

export const ROUTE_BUDGETS: Record<string, number> = {
  'route:dashboard': 80,
  'route:schedules:week': 150,
  'route:admin:templates': 110,
};

export async function prepareHydrationApp(page: Page, options: { delaySchedules?: boolean } = {}): Promise<void> {
  await page.addInitScript(() => {
    const win = window as typeof window & { __ENV__?: Record<string, string | undefined> };
    win.__ENV__ = {
      ...(win.__ENV__ ?? {}),
      VITE_E2E: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_SKIP_LOGIN: '1',
      VITE_DEMO_MODE: '0',
      VITE_FEATURE_SCHEDULES: '1',
      VITE_FEATURE_SCHEDULES_CREATE: '1',
      VITE_PREFETCH_HUD: '1',
    };
    window.localStorage.setItem('skipLogin', '1');
    window.localStorage.setItem('demo', '0');
    window.localStorage.setItem('writeEnabled', '1');
    window.localStorage.setItem('VITE_E2E', '1');
    window.localStorage.setItem('VITE_PREFETCH_HUD', '1');
    window.localStorage.setItem('feature:schedules', '1');
    window.localStorage.setItem('feature:schedulesCreate', '1');
  });

  await page.route('**/login.microsoftonline.com/**', (route) => route.fulfill({ status: 204, body: '' }));
  await page.route('https://graph.microsoft.com/**', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ value: [] }), headers: { 'content-type': 'application/json' } })
  );

  if (options.delaySchedules) {
    await page.route("**/_api/web/lists/getbytitle('Schedules')/items**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fallback();
    });
  }

  await mockEnsureScheduleList(page);

  await setupSharePointStubs(page, {
    currentUser: { status: 200, body: { Id: 1234 } },
    lists: [
      { name: 'Schedules', aliases: ['ScheduleEvents'], items: [] },
      { name: 'SupportRecord_Daily', items: [] },
      { name: 'StaffDirectory', items: [] },
    ],
    fallback: { status: 404, body: { error: 'Not mocked' } },
  });
}

export async function readHydrationSpans(page: Page): Promise<HydrationSpanSnapshot[]> {
  return page.evaluate(() => {
    const target = window as typeof window & { __HYDRATION_HUD__?: { spans?: HydrationSpanSnapshot[] } };
    const spans = target.__HYDRATION_HUD__?.spans ?? [];
    return spans.map((span) => ({
      id: span.id,
      label: span.label,
      group: span.group,
      duration: span.duration,
      error: span.error ?? null,
      meta: span.meta && typeof span.meta === 'object' ? { ...span.meta } : null,
    }));
  });
}

export async function expectRouteSpan(page: Page, id: string, expectation: RouteSpanExpectation): Promise<void> {
  const allowedStatuses = expectation.allowStatuses ?? (expectation.status ? [expectation.status] : undefined);

  await expect
    .poll(async () => {
      const spans = await readHydrationSpans(page);
      const span = spans.find((item) => item.id === id);
      if (!span) {
        return { reason: 'missing' } as const;
      }
      const meta = (span.meta ?? {}) as Record<string, unknown>;
      const status = typeof meta.status === 'string' ? meta.status : '';
      const path = typeof meta.path === 'string' ? meta.path : '';
      const budget = typeof meta.budget === 'number' ? meta.budget : undefined;
      const error = span.error ?? null;

      if (expectation.status && status !== expectation.status) {
        if (allowedStatuses && allowedStatuses.includes(status)) {
          return { reason: 'transient', status } as const;
        }
        return { reason: 'status', status } as const;
      }

      if (!expectation.status && allowedStatuses && !allowedStatuses.includes(status)) {
        return { reason: 'status', status } as const;
      }
      if (expectation.path && path !== expectation.path) {
        return { reason: 'path', path } as const;
      }
      if (expectation.budget !== undefined && budget !== expectation.budget) {
        return { reason: 'budget', budget } as const;
      }
      if (!expectation.allowErrors && error) {
        return { reason: 'error', error } as const;
      }
      return { reason: 'ok' } as const;
    }, { timeout: 10_000 })
    .toEqual({ reason: 'ok' });
}

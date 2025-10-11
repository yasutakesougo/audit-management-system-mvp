import type { Page } from '@playwright/test';

type Opts = {
  graph?: boolean;
  create?: boolean;
  msalMock?: boolean;
};

export async function enableSchedulesFeature(page: Page, opts: Opts = {}) {
  await page.addInitScript((o) => {
    const graphEnabled = Boolean(o?.graph);
    const createEnabled = Boolean(o?.create);

    localStorage.setItem('feature:schedules', '1');
    localStorage.setItem('feature:schedulesCreate', createEnabled ? '1' : '0');
    localStorage.setItem('feature:schedulesGraph', graphEnabled ? '1' : '0');

    const scope = window as typeof window & { __ENV__?: Record<string, string> };
    scope.__ENV__ = {
      ...(scope.__ENV__ ?? {}),
      VITE_FEATURE_SCHEDULES: '1',
      VITE_FEATURE_SCHEDULES_CREATE: createEnabled ? '1' : '0',
      VITE_FEATURE_SCHEDULES_GRAPH: graphEnabled ? '1' : '0',
      VITE_SKIP_LOGIN: scope.__ENV__?.VITE_SKIP_LOGIN ?? '1',
      VITE_SCHEDULES_TZ: scope.__ENV__?.VITE_SCHEDULES_TZ ?? 'Asia/Tokyo',
    };

    if (o?.msalMock) {
      sessionStorage.setItem('VITE_E2E_MSAL_MOCK', '1');

      scope.__ENV__ = {
        ...scope.__ENV__,
        VITE_E2E_MSAL_MOCK: '1',
      };
    }
  }, opts);
}

export async function disableSchedulesFeature(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('feature:schedules', '0');
    localStorage.setItem('feature:schedulesCreate', '0');
    localStorage.setItem('feature:schedulesGraph', '0');
    sessionStorage.removeItem('VITE_E2E_MSAL_MOCK');

    const scope = window as typeof window & { __ENV__?: Record<string, string> };
    if (scope.__ENV__) {
      const next = { ...scope.__ENV__ };
      next.VITE_FEATURE_SCHEDULES = '0';
      next.VITE_FEATURE_SCHEDULES_CREATE = '0';
      delete next.VITE_E2E_MSAL_MOCK;
      delete next.VITE_SCHEDULES_TZ;
      scope.__ENV__ = next;
    } else {
      scope.__ENV__ = {
        VITE_FEATURE_SCHEDULES: '0',
        VITE_FEATURE_SCHEDULES_CREATE: '0',
      };
    }
  });
}

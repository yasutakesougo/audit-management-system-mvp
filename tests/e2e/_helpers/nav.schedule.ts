import { expect, type Page } from '@playwright/test';
import { enableSchedulesFeature } from './featureFlags';

declare global {
  interface Window {
    __ENV__?: Record<string, string>;
  }
}

const DEFAULT_ENV: Record<string, string> = {
  VITE_FEATURE_SCHEDULES: '1',
  VITE_FEATURE_SCHEDULES_CREATE: '1',
  VITE_FEATURE_SCHEDULES_GRAPH: '0',
  VITE_E2E_MSAL_MOCK: '0',
  VITE_SKIP_LOGIN: '1',
};

type FeatureOptions = Parameters<typeof enableSchedulesFeature>[1];

type ScheduleNavOptions = {
  env?: Record<string, string>;
  feature?: FeatureOptions;
};

type ScheduleView = 'dashboard' | 'week' | 'month' | 'day';

type OpenSchedulesOptions = ScheduleNavOptions & {
  view: ScheduleView;
  at?: string;
};

const computeFeatureOptions = (env: Record<string, string>, overrides?: FeatureOptions): FeatureOptions => ({
  graph: env.VITE_FEATURE_SCHEDULES_GRAPH === '1',
  create: env.VITE_FEATURE_SCHEDULES_CREATE !== '0',
  msalMock: env.VITE_E2E_MSAL_MOCK === '1',
  ...overrides,
});

const applyScheduleEnv = async (page: Page, env: Record<string, string>) => {
  await page.addInitScript(({ envOverrides }) => {
    try {
      window.localStorage.setItem('skipLogin', envOverrides.VITE_SKIP_LOGIN ?? '1');
      window.localStorage.setItem('feature:schedules', envOverrides.VITE_FEATURE_SCHEDULES ?? '1');
      window.localStorage.setItem('feature:schedulesCreate', envOverrides.VITE_FEATURE_SCHEDULES_CREATE ?? '1');
      window.localStorage.setItem('feature:schedulesGraph', envOverrides.VITE_FEATURE_SCHEDULES_GRAPH ?? '0');
    } catch {
      /* ignore storage failures */
    }

    const scope = window as typeof window & { __ENV__?: Record<string, string> };
    scope.__ENV__ = {
      ...(scope.__ENV__ ?? {}),
      ...envOverrides,
    };
  }, { envOverrides: env });
};

export async function enableSchedulesEnv(page: Page, options: ScheduleNavOptions = {}) {
  const mergedEnv = { ...DEFAULT_ENV, ...(options.env ?? {}) };
  const featureOpts = computeFeatureOptions(mergedEnv, options.feature);
  await enableSchedulesFeature(page, featureOpts);
  await applyScheduleEnv(page, mergedEnv);
}

const viewPathMap: Record<ScheduleView, string> = {
  dashboard: '/schedule',
  week: '/schedules/week',
  month: '/schedules/month',
  day: '/schedules/day',
};

export async function openSchedules(page: Page, options: OpenSchedulesOptions) {
  const { view, at, ...rest } = options;
  await enableSchedulesEnv(page, rest);

  const basePath = viewPathMap[view];
  const url = at ? `${basePath}?at=${encodeURIComponent(at)}` : basePath;

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const escapedPath = basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.waitForURL(new RegExp(`${escapedPath}`));

  if (view === 'month') {
    await expect(page.getByRole('heading', { name: /スケジュール（月表示）/ })).toBeVisible({ timeout: 10_000 });
  }

  if (view === 'week') {
    await expect(page.getByRole('heading', { name: /スケジュール（週表示）/ })).toBeVisible({ timeout: 10_000 });
  }

  if (view === 'dashboard') {
    await page.getByRole('heading', { name: /スケジュール/ }).waitFor({ timeout: 10_000 });
  }
}

export async function openSchedulesMonth(page: Page, options: ScheduleNavOptions = {}) {
  await openSchedules(page, { view: 'month', ...options });
}

export async function openSchedulesWeek(page: Page, options: ScheduleNavOptions = {}) {
  await openSchedules(page, { view: 'week', ...options });
}

export async function openSchedulesDashboard(page: Page, options: ScheduleNavOptions = {}) {
  await openSchedules(page, { view: 'dashboard', ...options });
}

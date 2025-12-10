import type { Page } from '@playwright/test';

export type BootstrapFlags = {
  skipLogin?: boolean;
  featureSchedules?: boolean;
  featureSchedulesWeekV2?: boolean;
  initialPath?: string;
};

export async function bootstrapDashboard(page: Page, flags: BootstrapFlags = {}): Promise<void> {
  const options = {
    skipLogin: flags.skipLogin ?? true,
    featureSchedules: flags.featureSchedules ?? true,
    featureSchedulesWeekV2: flags.featureSchedulesWeekV2 ?? flags.featureSchedules ?? true,
    initialPath: flags.initialPath ?? '/dashboard',
  };

  await page.addInitScript((opts) => {
    const w = window as typeof window & { __ENV__?: Record<string, string> };
    w.__ENV__ = {
      ...(w.__ENV__ ?? {}),
      VITE_SKIP_LOGIN: '1',
      VITE_E2E: '1',
      VITE_E2E_MSAL_MOCK: '1',
      ...(opts.featureSchedules ? { VITE_FEATURE_SCHEDULES: '1' } : {}),
      ...(opts.featureSchedulesWeekV2 ? { VITE_FEATURE_SCHEDULES_WEEK_V2: '1' } : {}),
    };

    if (opts.skipLogin) {
      window.localStorage.setItem('skipLogin', '1');
    }

    if (opts.featureSchedules) {
      window.localStorage.setItem('feature:schedules', '1');
    }
  }, options);

  await page.goto(options.initialPath, { waitUntil: 'networkidle' });
}

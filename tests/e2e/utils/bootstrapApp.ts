import type { Page } from '@playwright/test';
import { waitForAppShellReady } from './wait';

export type BootstrapSharePointMode = 'inherit' | 'skip' | 'force';

export type BootstrapFlags = {
  skipLogin?: boolean;
  featureSchedules?: boolean;
  featureIcebergPdca?: boolean;
  featureStaffAttendance?: boolean;
  initialPath?: string;
  sharePointMode?: BootstrapSharePointMode;
};

export function buildBootstrapRuntimeOverrides(
  sharePointMode: BootstrapSharePointMode = 'inherit',
): Record<string, string> {
  if (sharePointMode === 'skip') {
    return {
      VITE_SKIP_SHAREPOINT: '1',
      VITE_FORCE_SHAREPOINT: '0',
      VITE_DATA_PROVIDER: 'memory',
    };
  }

  if (sharePointMode === 'force') {
    return {
      VITE_SKIP_SHAREPOINT: '0',
      VITE_FORCE_SHAREPOINT: '1',
      VITE_DATA_PROVIDER: 'sharepoint',
      VITE_SP_RESOURCE: 'https://e2e.sharepoint.com',
      VITE_SP_SITE_RELATIVE: '/sites/e2e-test',
      VITE_SP_SITE_URL: 'https://e2e.sharepoint.com/sites/e2e-test',
    };
  }

  return {};
}

export async function bootstrapDashboard(page: Page, flags: BootstrapFlags = {}): Promise<void> {
  const options = {
    skipLogin: flags.skipLogin ?? true,
    featureSchedules: flags.featureSchedules ?? true,
    featureIcebergPdca: flags.featureIcebergPdca ?? true,
    featureStaffAttendance: flags.featureStaffAttendance ?? false,
    initialPath: flags.initialPath ?? '/dashboard',
    sharePointMode: flags.sharePointMode ?? 'inherit',
  };
  const runtimeOverrides = buildBootstrapRuntimeOverrides(options.sharePointMode);

  await page.addInitScript((opts) => {
    const w = window as typeof window & { __ENV__?: Record<string, string> };
    w.__ENV__ = {
      ...(w.__ENV__ ?? {}),
      VITE_SKIP_LOGIN: '1',
      VITE_E2E: '1',
      VITE_E2E_MSAL_MOCK: '1',
      VITE_MSAL_CLIENT_ID: 'e2e-mock-client-id-12345678',
      VITE_MSAL_TENANT_ID: 'common',
      VITE_SCHEDULE_ADMINS_GROUP_ID: 'e2e-admin-group-id',
      VITE_USE_DEMO: '0',
      ...opts.runtimeOverrides,
      ...(opts.featureSchedules ? { VITE_FEATURE_SCHEDULES: '1' } : {}),
      ...(opts.featureIcebergPdca ? { VITE_FEATURE_ICEBERG_PDCA: '1' } : {}),
      ...(opts.featureStaffAttendance ? { VITE_FEATURE_STAFF_ATTENDANCE: '1' } : {}),
    };

    if (opts.skipLogin) {
      window.localStorage.setItem('skipLogin', '1');
    }
  }, { ...options, runtimeOverrides });

  await page.goto(options.initialPath, { waitUntil: 'domcontentloaded' });
  await waitForAppShellReady(page, 60_000);
}

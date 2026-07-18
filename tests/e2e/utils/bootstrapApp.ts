import type { Page } from '@playwright/test';
import { waitForAppShellReady } from './wait';

export type BootstrapFlags = {
  skipLogin?: boolean;
  dataProvider?: 'sharepoint' | 'memory';
  featureSchedules?: boolean;
  featureIcebergPdca?: boolean;
  featureStaffAttendance?: boolean;
  initialPath?: string;
};

export async function bootstrapDashboard(page: Page, flags: BootstrapFlags = {}): Promise<void> {
  const dataProvider = flags.dataProvider ?? 'sharepoint';
  const providerEnv: Record<string, string> = dataProvider === 'memory'
    ? {
        VITE_FORCE_SHAREPOINT: '0',
        VITE_SKIP_SHAREPOINT: '1',
        VITE_DATA_PROVIDER: 'memory',
        VITE_DEMO_MODE: '1',
        VITE_USE_DEMO: '1',
        VITE_FEATURE_SCHEDULES_SP: '0',
        VITE_FEATURE_USERS_SP: '0',
        VITE_SCHEDULES_SAVE_MODE: 'mock',
        VITE_STAFF_ATTENDANCE_STORAGE: 'local',
        VITE_HANDOFF_STORAGE: 'local',
      }
    : {
        VITE_FORCE_SHAREPOINT: '1',
        VITE_SKIP_SHAREPOINT: '0',
        VITE_DATA_PROVIDER: 'sharepoint',
        VITE_DEMO_MODE: '0',
        VITE_USE_DEMO: '0',
      };
  const options = {
    skipLogin: flags.skipLogin ?? true,
    featureSchedules: flags.featureSchedules ?? true,
    featureIcebergPdca: flags.featureIcebergPdca ?? true,
    featureStaffAttendance: flags.featureStaffAttendance ?? false,
    initialPath: flags.initialPath ?? '/dashboard',
    providerEnv,
  };

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
      VITE_SP_RESOURCE: 'https://e2e.sharepoint.com',
      VITE_SP_SITE_RELATIVE: '/sites/e2e-test',
      VITE_SP_SITE_URL: 'https://e2e.sharepoint.com/sites/e2e-test',
      ...(opts.featureSchedules ? { VITE_FEATURE_SCHEDULES: '1' } : {}),
      ...(opts.featureIcebergPdca ? { VITE_FEATURE_ICEBERG_PDCA: '1' } : {}),
      ...(opts.featureStaffAttendance ? { VITE_FEATURE_STAFF_ATTENDANCE: '1' } : {}),
      ...opts.providerEnv,
    };

    if (opts.skipLogin) {
      window.localStorage.setItem('skipLogin', '1');
    }
  }, options);

  await page.goto(options.initialPath, { waitUntil: 'domcontentloaded' });
  await waitForAppShellReady(page, 60_000);
}

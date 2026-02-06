import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

const mobileChrome = {
  ...devices['Pixel 5'],
  viewport: { width: 390, height: 844 },
};

// Port configuration for CI/local portability
const devPort = Number(process.env.E2E_PORT) || 5173;
const baseURL = `http://127.0.0.1:${devPort}`;

const smokeTestMatch = [
  'tests/e2e/basic-smoke.spec.ts',
  'tests/e2e/app-shell.smoke.spec.ts',
  'tests/e2e/router.smoke.spec.ts',
  'tests/e2e/nav.smoke.spec.ts',
  'tests/e2e/health.smoke.spec.ts',
  'tests/e2e/schedule-smoke.spec.ts',
  'tests/e2e/schedule-day.aria.smoke.spec.ts',
];

const webServerEnvVarsSmoke = {
  VITE_SP_RESOURCE: 'https://isogokatudouhome.sharepoint.com',
  VITE_SP_SITE_RELATIVE: '/sites/app-test',
  VITE_SP_SCOPE_DEFAULT: 'https://isogokatudouhome.sharepoint.com/AllSites.Read',
  VITE_E2E: '1',
  VITE_E2E_MSAL_MOCK: 'true',
  VITE_SKIP_LOGIN: '1',
  VITE_SKIP_SHAREPOINT: '1',
  VITE_SKIP_ENSURE_SCHEDULE: 'false',
  VITE_DEMO_MODE: '1',
  VITE_DEV_HARNESS: '1',
  VITE_SCHEDULES_TZ: 'Asia/Tokyo',
  VITE_FEATURE_SCHEDULES: '1',
  VITE_AUDIT_DEBUG: process.env.VITE_AUDIT_DEBUG ?? '0',
  E2E_SAVE_MODE: 'mock',
};

const envPairs = Object.entries(webServerEnvVarsSmoke)
  .map(([key, value]) => `${key}=${value}`)
  .join(' ');

const devCommand = `npx cross-env ${envPairs} npx vite --mode test --host 127.0.0.1 --port ${devPort} --strictPort`;

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL,
  },
  webServer: {
    command: devCommand,
    url: baseURL,
    // CI でも既存サーバーを再利用し、並列/再試行時のポート競合を回避
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      ...process.env,
      ...webServerEnvVarsSmoke,
    },
  },
  projects: (baseConfig.projects ?? [])
    .filter((project) => project.name === 'smoke')
    .map((project) => ({
      ...project,
      testMatch: smokeTestMatch,
      use: {
        ...(project.use ?? {}),
        ...mobileChrome,
        baseURL,
      },
    })),
});


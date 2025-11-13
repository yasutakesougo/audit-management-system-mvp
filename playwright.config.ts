import type { ReporterDescription } from '@playwright/test';
import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const skipBuild = process.env.PLAYWRIGHT_SKIP_BUILD === '1';
const DEV_PORT = Number(process.env.DEV_SERVER_PORT ?? 3000);
const junitOutput = process.env.PLAYWRIGHT_JUNIT_OUTPUT ?? 'junit/results.xml';
const ciReporters: ReporterDescription[] = [
  ['list'],
  ['junit', { outputFile: junitOutput }],
  ['html', { outputFolder: 'playwright-report' }],
];

const defaultE2eEnv = 'VITE_FEATURE_SCHEDULES=1 VITE_E2E_MSAL_MOCK=1 VITE_SKIP_LOGIN=1 VITE_E2E=1';
const devServerCommand = `${defaultE2eEnv} npm run dev -- --port ${DEV_PORT} --clearScreen=false`;
const previewCommand = `${defaultE2eEnv} sh -c "npm run build && npx serve -s dist -l ${DEV_PORT}"`;
const webServerCommand = skipBuild ? devServerCommand : previewCommand;

const webServerEnv = {
  VITE_E2E: '1',
  VITE_SP_RESOURCE: process.env.VITE_SP_RESOURCE || 'https://example.sharepoint.com',
  VITE_SP_SITE_RELATIVE: process.env.VITE_SP_SITE_RELATIVE || '/sites/demo',
  VITE_SP_SITE_ID: process.env.VITE_SP_SITE_ID || '00000000-0000-4000-8000-000000000000',
};

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: isCI ? 2 : 0,
  reporter: isCI ? ciReporters : 'list',
  use: {
    baseURL: `http://localhost:${DEV_PORT}`,
    trace: isCI ? 'on-first-retry' : 'off',
    video: isCI ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: webServerCommand,
    url: `http://localhost:${DEV_PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: webServerEnv,
  },
});

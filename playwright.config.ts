import { defineConfig, devices } from '@playwright/test';
import type { ReporterDescription } from '@playwright/test';

const isCI = !!process.env.CI;
const skipBuild = process.env.PLAYWRIGHT_SKIP_BUILD === '1';
const baseUrlEnv = process.env.PLAYWRIGHT_BASE_URL;
const webServerCommandOverride = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND;
const devPort = 5173; // preview also binds to this port to avoid mismatches
const baseURL = baseUrlEnv ?? `http://127.0.0.1:${devPort}`;
const webServerUrl = process.env.PLAYWRIGHT_WEB_SERVER_URL ?? baseURL;
const junitOutput = process.env.PLAYWRIGHT_JUNIT_OUTPUT ?? 'junit/results.xml';
const ciReporters: ReporterDescription[] = [
  ['list'],
  ['junit', { outputFile: junitOutput }],
  ['html', { outputFolder: 'playwright-report' }],
];

const webServerEnvVars = {
  VITE_SP_RESOURCE: process.env.VITE_SP_RESOURCE ?? 'https://contoso.sharepoint.com',
  VITE_SP_SITE_RELATIVE: process.env.VITE_SP_SITE_RELATIVE ?? '/sites/Audit',
  VITE_SP_SCOPE_DEFAULT:
    process.env.VITE_SP_SCOPE_DEFAULT ?? 'https://contoso.sharepoint.com/AllSites.Read',
  // Ensure E2E flags use literal "true"/"false" strings so boolean parsing works consistently.
  VITE_E2E: process.env.VITE_E2E ?? 'true',
  VITE_E2E_MSAL_MOCK: process.env.VITE_E2E_MSAL_MOCK ?? 'true',
  VITE_SKIP_LOGIN: process.env.VITE_SKIP_LOGIN ?? 'true',
  VITE_SKIP_SHAREPOINT: process.env.VITE_SKIP_SHAREPOINT ?? 'true',
  VITE_SKIP_ENSURE_SCHEDULE: process.env.VITE_SKIP_ENSURE_SCHEDULE ?? 'false',
  VITE_DEMO_MODE: process.env.VITE_DEMO_MODE ?? 'true',
  VITE_WRITE_ENABLED: process.env.VITE_WRITE_ENABLED ?? 'false',
  VITE_FEATURE_SCHEDULES: process.env.VITE_FEATURE_SCHEDULES ?? 'true',
  VITE_SCHEDULES_TZ: process.env.VITE_SCHEDULES_TZ ?? 'Asia/Tokyo',
};

const devCommand = `npm run dev -- --host 127.0.0.1 --port ${devPort} --strictPort`;
const buildAndPreviewCommand = 'npm run preview:e2e';

const webServerCommand = webServerCommandOverride
  ? webServerCommandOverride
  : skipBuild
    ? devCommand
    : buildAndPreviewCommand;

// Allow reusing an externally started server when PLAYWRIGHT_WEB_SERVER_URL is provided (e.g., guardrails workflows).
const reuseExistingServer = true; // always reuse an existing server if already running at baseURL
const SMOKE_SPEC_PATTERN = /.*smoke.*\.spec\.ts$/i;
const desktopChrome = { ...devices['Desktop Chrome'] };

export default defineConfig({
  testDir: 'tests/e2e',
  testIgnore: ['tests/e2e/regression/**'],
  timeout: 60_000,
  retries: isCI ? 2 : 0,
  reporter: isCI ? ciReporters : 'list',
  use: {
    baseURL,
    trace: isCI ? 'on-first-retry' : 'off',
    video: isCI ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: desktopChrome },
    { name: 'smoke', use: desktopChrome, testMatch: SMOKE_SPEC_PATTERN },
  ],
  webServer: {
    command: webServerCommand,
    url: webServerUrl,
    reuseExistingServer,
    timeout: 120_000,
    env: {
      ...process.env,
      ...webServerEnvVars,
    },
  },
});

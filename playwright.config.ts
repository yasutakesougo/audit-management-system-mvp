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

// E2E: Zero external dependencies (default)
const webServerEnvVarsE2E = {
  VITE_SP_RESOURCE: process.env.VITE_SP_RESOURCE ?? 'https://isogokatudouhome.sharepoint.com',
  VITE_SP_SITE_RELATIVE: process.env.VITE_SP_SITE_RELATIVE ?? '/sites/app-test',
  VITE_SP_SCOPE_DEFAULT:
    process.env.VITE_SP_SCOPE_DEFAULT ?? 'https://isogokatudouhome.sharepoint.com/AllSites.Read',
  // E2E regression tests run with NO external dependencies
  VITE_E2E: process.env.VITE_E2E ?? '1',
  VITE_E2E_MSAL_MOCK: process.env.VITE_E2E_MSAL_MOCK ?? 'true',
  VITE_SKIP_LOGIN: process.env.VITE_SKIP_LOGIN ?? '1',
  VITE_SKIP_SHAREPOINT: process.env.VITE_SKIP_SHAREPOINT ?? '1', // Force no external API calls
  VITE_SKIP_ENSURE_SCHEDULE: process.env.VITE_SKIP_ENSURE_SCHEDULE ?? 'false',
  VITE_DEMO_MODE: process.env.VITE_DEMO_MODE ?? '1', // Use in-memory stores
  VITE_DEV_HARNESS: process.env.VITE_DEV_HARNESS ?? '1',
  VITE_SCHEDULES_TZ: process.env.VITE_SCHEDULES_TZ ?? 'Asia/Tokyo',
};

// Integration: Real SharePoint/Graph communication (nightly/manual only)
const webServerEnvVarsIntegration = {
  VITE_SP_RESOURCE: process.env.VITE_SP_RESOURCE ?? 'https://isogokatudouhome.sharepoint.com',
  VITE_SP_SITE_RELATIVE: process.env.VITE_SP_SITE_RELATIVE ?? '/sites/app-test',
  VITE_SP_SCOPE_DEFAULT:
    process.env.VITE_SP_SCOPE_DEFAULT ?? 'https://isogokatudouhome.sharepoint.com/AllSites.Read',
  VITE_E2E: '0', // Not E2E mode
  VITE_E2E_MSAL_MOCK: 'false', // Use real MSAL
  VITE_SKIP_LOGIN: '0', // Require authentication
  VITE_SKIP_SHAREPOINT: '0', // Allow real SharePoint calls
  VITE_SKIP_ENSURE_SCHEDULE: 'false',
  VITE_DEMO_MODE: '0', // Use real stores
  VITE_DEV_HARNESS: process.env.VITE_DEV_HARNESS ?? '1',
  VITE_SCHEDULES_TZ: process.env.VITE_SCHEDULES_TZ ?? 'Asia/Tokyo',
};

// Select env vars based on PLAYWRIGHT_PROJECT
const isIntegrationProject = process.env.PLAYWRIGHT_PROJECT === 'integration';
const webServerEnvVars = isIntegrationProject ? webServerEnvVarsIntegration : webServerEnvVarsE2E;

// Build env string for command line injection (dev mode needs this)
// Use --mode test to load .env.test.local which overrides .env.local
const envPairs = Object.entries(webServerEnvVars)
  .map(([key, value]) => `${key}=${value}`)
  .join(' ');

const devCommand = `npx cross-env ${envPairs} npx vite --mode test --host 127.0.0.1 --port ${devPort} --strictPort`;
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
    {
      name: 'chromium',
      testDir: 'tests/e2e',
      use: desktopChrome,
    },
    {
      name: 'smoke',
      testDir: 'tests/e2e',
      use: desktopChrome,
      testMatch: SMOKE_SPEC_PATTERN,
    },
    {
      name: 'integration',
      testDir: 'tests/integration',
      use: {
        ...desktopChrome,
        storageState: 'tests/.auth/storageState.json',
      },
    },
  ],
  webServer: {
    command: webServerCommand,
    url: webServerUrl,
    reuseExistingServer,
    timeout: 180_000,
    env: {
      ...process.env,
      ...webServerEnvVars,
    },
  },
});

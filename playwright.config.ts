import { defineConfig, devices } from '@playwright/test';
import type { ReporterDescription } from '@playwright/test';

const isCI = !!process.env.CI;
const skipBuild = process.env.PLAYWRIGHT_SKIP_BUILD === '1';
const baseUrlEnv = process.env.PLAYWRIGHT_BASE_URL ?? process.env.BASE_URL;
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
  VITE_FEATURE_SCHEDULES: '1',  // Default: schedules feature ON
};

// E2E with schedules feature OFF (for flags.schedule.spec.ts)
const webServerEnvVarsE2ESchedulesOff = {
  ...webServerEnvVarsE2E,
  VITE_FEATURE_SCHEDULES: '0',  // Disable schedules
};

// E2E with SharePoint mocking (list-existence gate testing, 404 scenarios)
// NOTE: route.route() can intercept API calls here since VITE_SKIP_SHAREPOINT=0
const webServerEnvVarsSPIntegration = {
  VITE_SP_RESOURCE: process.env.VITE_SP_RESOURCE ?? 'https://isogokatudouhome.sharepoint.com',
  VITE_SP_SITE_RELATIVE: process.env.VITE_SP_SITE_RELATIVE ?? '/sites/app-test',
  VITE_SP_SCOPE_DEFAULT:
    process.env.VITE_SP_SCOPE_DEFAULT ?? 'https://isogokatudouhome.sharepoint.com/AllSites.Read',
  VITE_E2E: '1',  // E2E mode enabled (no real external requests)
  VITE_E2E_MSAL_MOCK: 'true',  // Use mock MSAL
  VITE_SKIP_LOGIN: '1',  // Skip login (use demo auth)
  VITE_SKIP_SHAREPOINT: '0',  // DO NOT skip SharePoint (allow route mocking)
  VITE_FEATURE_SCHEDULES_SP: '1',  // Enable SharePoint features
  VITE_DEMO_MODE: '1',  // Use in-memory stores for other data
  VITE_DEV_HARNESS: process.env.VITE_DEV_HARNESS ?? '1',
  VITE_SCHEDULES_TZ: process.env.VITE_SCHEDULES_TZ ?? 'Asia/Tokyo',
};

// Integration: Real SharePoint/Graph communication (nightly/manual only)
const webServerEnvVarsIntegration = {
  VITE_SP_RESOURCE: process.env.VITE_SP_RESOURCE ?? 'https://isogokatudouhome.sharepoint.com',
  VITE_SP_SITE_RELATIVE: process.env.VITE_SP_SITE_RELATIVE ?? '/sites/app-test',
  VITE_SP_SCOPE_DEFAULT:
    process.env.VITE_SP_SCOPE_DEFAULT ?? 'https://isogokatudouhome.sharepoint.com/AllSites.Read',
  VITE_E2E_INTEGRATION: '1',
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
const isSPIntegrationProject = process.env.PLAYWRIGHT_PROJECT === 'chromium-sp-integration';
const isSchedulesOffProject = process.env.PLAYWRIGHT_PROJECT === 'chromium:schedules-off';
const webServerEnvVars = isIntegrationProject ? webServerEnvVarsIntegration : isSPIntegrationProject ? webServerEnvVarsSPIntegration : isSchedulesOffProject ? webServerEnvVarsE2ESchedulesOff : webServerEnvVarsE2E;

// Build env string for command line injection (dev mode needs this)
// Use --mode test to load .env.test.local which overrides .env.local
const envPairs = Object.entries(webServerEnvVars)
  .map(([key, value]) => `${key}=${value}`)
  .join(' ');

const devCommand = `npx cross-env ${envPairs} npx vite --mode test --host 127.0.0.1 --port ${devPort} --strictPort`;
const devCommandSchedulesOff = `npx cross-env ${Object.entries(webServerEnvVarsE2ESchedulesOff).map(([key, value]) => `${key}=${value}`).join(' ')} npx vite --mode test --host 127.0.0.1 --port 5176 --strictPort`;
const buildAndPreviewCommand = 'npm run preview:e2e';

// Integration must run against real env (no mocks/skip-login), so force the devCommand
// which injects integration env vars. E2E stays on the prebuilt preview command.
const webServerCommand = webServerCommandOverride
  ? webServerCommandOverride
  : isIntegrationProject
    ? devCommand
    : isSchedulesOffProject
      ? devCommandSchedulesOff
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
  // Top-level webServer: ensure chromium runs always boot Vite on 5173
  webServer: {
    command: 'npm run dev:5173 -- --mode test --host 127.0.0.1 --port 5173 --strictPort',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    env: {
      ...process.env,
      ...webServerEnvVarsE2E,
    },
  },
  projects: [
    {
      name: 'integration:setup',
      testDir: 'tests/integration',
      testMatch: 'auth.sp.setup.spec.ts',
      use: desktopChrome,
    },
    {
      name: 'chromium',
      testDir: 'tests/e2e',
      use: desktopChrome,
      webServer: {
        command: webServerCommand,
        url: webServerUrl,
        reuseExistingServer,
        timeout: 180_000,
        env: {
          ...process.env,
          ...webServerEnvVarsE2E,
        },
      },
    },
    {
      name: 'chromium-sp-integration',
      testDir: 'tests/e2e',
      testMatch: '**/schedules.list-existence-gate.spec.ts',
      use: desktopChrome,
      webServer: {
        command: `npx cross-env ${Object.entries(webServerEnvVarsSPIntegration).map(([k, v]) => `${k}=${v}`).join(' ')} npx vite --mode test --host 127.0.0.1 --port 5177 --strictPort`,
        url: 'http://127.0.0.1:5177',
        reuseExistingServer,
        timeout: 180_000,
        env: {
          ...process.env,
          ...webServerEnvVarsSPIntegration,
        },
      },
    },
    {
      name: 'chromium:schedules-off',
      testDir: 'tests/e2e',
      testMatch: 'flags.schedule.spec.ts',
      use: { ...desktopChrome, baseURL: 'http://127.0.0.1:5176' },
      webServer: {
        command: `npx cross-env ${Object.entries(webServerEnvVarsE2ESchedulesOff).map(([k, v]) => `${k}=${v}`).join(' ')} npx vite --mode test --host 127.0.0.1 --port 5176 --strictPort`,
        url: 'http://127.0.0.1:5176',
        reuseExistingServer,
        timeout: 180_000,
        env: {
          ...process.env,
          ...webServerEnvVarsE2ESchedulesOff,
        },
      },
    },
    {
      name: 'smoke',
      testDir: 'tests/e2e',
      use: desktopChrome,
      testMatch: SMOKE_SPEC_PATTERN,
      webServer: {
        command: webServerCommand,
        url: webServerUrl,
        reuseExistingServer,
        timeout: 180_000,
        env: {
          ...process.env,
          ...webServerEnvVarsE2E,
        },
      },
    },
    {
      name: 'integration',
      testDir: 'tests/integration',
      dependencies: ['integration:setup'],
      use: {
        ...desktopChrome,
        storageState: 'tests/.auth/storageState.json',
      },
      webServer: {
        command: webServerCommand,
        url: webServerUrl,
        reuseExistingServer,
        timeout: 180_000,
        env: {
          ...process.env,
          ...webServerEnvVarsIntegration,
        },
      },
    },
  ],
});

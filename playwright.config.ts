import { defineConfig, devices } from '@playwright/test';
import type { ReporterDescription } from '@playwright/test';

if (!process.env.TS_NODE_PROJECT) {
  process.env.TS_NODE_PROJECT = 'tsconfig.playwright.json';
}

const isCI = !!process.env.CI;
const skipBuild = process.env.PLAYWRIGHT_SKIP_BUILD === '1';
const baseUrlEnv = process.env.PLAYWRIGHT_BASE_URL;
const webServerCommandOverride = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND;
const devPort = 5173;
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
  ...(isCI
    ? {
        // E2E/MSAL モック時は SharePoint 実環境前提の検証をスキップさせる
        VITE_E2E: process.env.VITE_E2E ?? '1',
        VITE_E2E_MSAL_MOCK: process.env.VITE_E2E_MSAL_MOCK ?? '1',
      }
    : {}),
};

const webServerEnvString = Object.entries(webServerEnvVars)
  .map(([key, value]) => `${key}=${value}`)
  .join(' ');

const devCommand = `env ${webServerEnvString} npm run dev -- --host 127.0.0.1 --port ${devPort} --strictPort`;
// Use preview:e2e which builds, writes deterministic runtime env, and starts preview
const buildAndPreviewCommand = `npm run preview:e2e`;

const webServerCommand = webServerCommandOverride
  ? webServerCommandOverride
  : skipBuild
    ? devCommand
    : buildAndPreviewCommand;

// Allow reusing an externally started server when PLAYWRIGHT_WEB_SERVER_URL is provided (e.g., guardrails workflows).
const reuseExistingServer = process.env.PW_REUSE_SERVER !== '0';
const SMOKE_SPEC_PATTERN = /.*smoke.*\.spec\.ts$/i;
const desktopChrome = { ...devices['Desktop Chrome'] };

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: isCI ? 2 : 0,
  reporter: isCI ? ciReporters : 'list',
  testIgnore: /auth-diagnostics\.spec\.ts$/,
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
  },
});

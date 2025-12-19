import { defineConfig, devices } from '@playwright/test';
import type { ReporterDescription } from '@playwright/test';
import { config as dotenvConfig } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load E2E environment variables from .env.e2e
// CI environments can override these by setting their own env vars
const envE2EPath = resolve(__dirname, '.env.e2e');
if (existsSync(envE2EPath)) {
  const result = dotenvConfig({ path: envE2EPath });
  if (result.error) {
    console.warn('Warning: Failed to load .env.e2e:', result.error.message);
  }
}

const isCI = !!process.env.CI;
const skipBuild = process.env.PLAYWRIGHT_SKIP_BUILD === '1';
const baseUrlEnv = process.env.PLAYWRIGHT_BASE_URL;
const webServerCommandOverride = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND;
const baseURL = baseUrlEnv ?? 'http://127.0.0.1:5173';
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
};

const webServerEnvString = Object.entries(webServerEnvVars)
  .map(([key, value]) => `${key}=${value}`)
  .join(' ');

const devCommand = `env ${webServerEnvString} npm run dev -- --host 127.0.0.1 --port 5173 --strictPort`;
const buildAndDevCommand = `sh -c "env ${webServerEnvString} npm run build && env ${webServerEnvString} npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"`;

const webServerCommand = webServerCommandOverride
  ? webServerCommandOverride
  : skipBuild
    ? devCommand
    : buildAndDevCommand;

// Allow reusing an externally started server when PLAYWRIGHT_WEB_SERVER_URL is provided (e.g., guardrails workflows).
const reuseExistingServer = process.env.PLAYWRIGHT_WEB_SERVER_URL ? true : !isCI;
const SMOKE_SPEC_PATTERN = /.*smoke.*\.spec\.ts$/i;
const desktopChrome = { ...devices['Desktop Chrome'] };

export default defineConfig({
  testDir: 'tests/e2e',
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
  },
});

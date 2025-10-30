import { defineConfig, devices } from '@playwright/test';
import type { ReporterDescription } from '@playwright/test';

const isCI = !!process.env.CI;
const junitOutput = process.env.PLAYWRIGHT_JUNIT_OUTPUT ?? 'junit/results.xml';
const ciReporters: ReporterDescription[] = [
  ['list'],
  ['junit', { outputFile: junitOutput }],
  ['html', { outputFolder: 'playwright-report' }],
];

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: isCI ? 2 : 0,
  reporter: isCI ? ciReporters : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: isCI ? 'on-first-retry' : 'off',
    video: isCI ? 'retain-on-failure' : 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'sh -c "npm run build && npx serve -s dist -l 3000"',
    url: 'http://localhost:3000',
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});

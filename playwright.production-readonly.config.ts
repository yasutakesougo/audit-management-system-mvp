import { defineConfig, devices } from '@playwright/test';

const productionBaseURL =
  process.env.PRODUCTION_BASE_URL ??
  'https://audit-management-system-mvp.momosantanuki.workers.dev';

export default defineConfig({
  testDir: 'tests/production',
  testMatch: /production-readonly-smoke\.spec\.ts$/,
  timeout: 240_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: productionBaseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'production-readonly',
      use: devices['Desktop Chrome'],
    },
  ],
});

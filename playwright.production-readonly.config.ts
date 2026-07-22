import { defineConfig, devices } from '@playwright/test';

const productionBaseURL =
  process.env.PRODUCTION_BASE_URL ??
  'https://audit-management-system-mvp.momosantanuki.workers.dev';
const productionStorageState = 'tests/.auth/production-storageState.json';

export default defineConfig({
  testDir: 'tests/production',
  timeout: 240_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: productionBaseURL,
    headless: false,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'production-auth-setup',
      testMatch: /production-auth\.setup\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        trace: 'off',
        screenshot: 'off',
        video: 'off',
      },
    },
    {
      name: 'production-readonly',
      testMatch: /production-readonly-smoke\.spec\.ts/,
      dependencies: ['production-auth-setup'],
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        storageState: productionStorageState,
      },
    },
  ],
});

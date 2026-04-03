import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const desktopChrome = { ...devices['Desktop Chrome'] };

export default defineConfig({
  testDir: 'tests/integration',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  retries: isCI ? 1 : 0,
  reporter: 'line',
  use: {
    ...desktopChrome,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'integration:setup', use: { ...desktopChrome } },
    {
      name: 'integration',
      use: {
        ...desktopChrome,
        storageState: 'tests/.auth/storageState.json',
      },
    },
  ],
});

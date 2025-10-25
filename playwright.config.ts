// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30 * 1000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 1,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:e2e',
    port: 3000,
    reuseExistingServer: false,
    env: {
      ...process.env,
      VITE_APP_E2E: '1',
      VITE_DEMO_MODE: '1',
      VITE_SKIP_LOGIN: '1',
    },
  },
  testMatch: /.*\.(e2e|spec|smoke)\.(ts|tsx|js)$/,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

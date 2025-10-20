// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30 * 1000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4173',
    headless: true,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  webServer: {
    command: process.env.E2E_SERVER_CMD || 'npm run preview',
    port: Number(process.env.E2E_SERVER_PORT || 4173),
    reuseExistingServer: !process.env.CI,
    env: {
      ...process.env,
      VITE_APP_E2E: '1',
      VITE_DEMO_MODE: '1',
      VITE_SKIP_LOGIN: '1',
    },
  },
  testMatch: /.*\.e2e\.(ts|tsx|js)$/,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});

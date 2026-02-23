import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const isCI = !!process.env.CI;
const deepProjects = (baseConfig.projects ?? []).filter((project) => project.name === 'chromium');

export default defineConfig({
  ...baseConfig,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: isCI ? 1 : baseConfig.retries,
  workers: isCI ? 2 : baseConfig.workers,
  reporter: [['html', { open: 'never' }]],
  testIgnore: [/.*smoke.*\.spec\.ts$/i, '**/tests/e2e/_disabled/**'],
  use: {
    ...(baseConfig.use ?? {}),
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    baseURL: process.env.E2E_BASE_URL ?? (baseConfig.use ?? {}).baseURL,
  },
  projects: deepProjects,
});
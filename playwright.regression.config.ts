import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const REGRESSION_SPEC_PATTERN = /.*regression.*\.spec\.ts$/i;

export default defineConfig({
  ...baseConfig,
  testMatch: REGRESSION_SPEC_PATTERN,
  projects: (baseConfig.projects ?? []).filter((project) => project.name === 'chromium'),
  webServer: {
    ...baseConfig.webServer,
    reuseExistingServer: false,
  },
});

import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

const mobileChrome = {
  ...devices['Pixel 5'],
  viewport: { width: 390, height: 844 },
};

// Port configuration for CI/local portability
const PORT = process.env.E2E_PORT ?? '5173';
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  ...baseConfig,
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: BASE_URL,
  },
  projects: (baseConfig.projects ?? [])
    .filter((project) => project.name === 'smoke')
    .map((project) => ({
      ...project,
      use: {
        ...(project.use ?? {}),
        ...mobileChrome,
        baseURL: BASE_URL,
      },
    })),
});

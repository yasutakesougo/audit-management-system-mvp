import { defineConfig, devices } from '@playwright/test';
import baseConfig from './playwright.config';

const mobileChrome = {
  ...devices['Pixel 5'],
  viewport: { width: 390, height: 844 },
};

export default defineConfig({
  ...baseConfig,
  projects: (baseConfig.projects ?? [])
    .filter((project) => project.name === 'smoke')
    .map((project) => ({
      ...project,
      use: {
        ...(project.use ?? {}),
        ...mobileChrome,
      },
    })),
});

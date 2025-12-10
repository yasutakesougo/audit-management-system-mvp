import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

export default defineConfig({
  ...baseConfig,
  projects: (baseConfig.projects ?? []).filter((project) => project.name === 'smoke'),
});

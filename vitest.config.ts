import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts', './tests/setupTests.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: process.env.CI === 'true',
      },
    },
    maxWorkers: process.env.CI === 'true' ? 1 : undefined,
    fileParallelism: process.env.CI === 'true' ? false : true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/e2e/**',
      'tests/regression/**',
      'playwright.config.ts',
      'playwright.*.config.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/types.ts',
        'src/vite-env.d.ts',
        'vite.config.ts',
        'vitest.config.ts'
      ],
      thresholds: {
        // Temporary buffer after Vitest 4; raise incrementally.
        lines: 44,
        functions: 38,
        branches: 37,
        statements: 43
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});

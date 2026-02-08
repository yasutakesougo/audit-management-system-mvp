import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Robust CI detection (handles CI=true, CI=1, CI=yes, etc.)
const isCI = !!process.env.CI;

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts', './tests/setupTests.ts'],
    // Vitest 4: poolOptions removed, use top-level pool config
    // Note: For production, prefer CLI flags (e.g., vitest run --pool=forks)
    // Config-level CI detection can affect local devs with CI env var set
    pool: isCI ? 'forks' : undefined,
    // forks pool: single worker for CI stability
    maxWorkers: isCI ? 1 : undefined,
    fileParallelism: isCI ? false : true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/e2e/**',
      'tests/integration/**', // Playwright integration tests, not Vitest
      'tests/regression/**',
      'tests/unit/briefing.edge.spec.ts',
      'tests/unit/spClient.schedule.spec.ts',
      'tests/unit/schedule/briefing.user.spec.ts',
      'tests/unit/schedule/month.spec.ts',
      'tests/unit/schedule.spMap*.spec.ts',
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

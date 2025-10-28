import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@fluentui/react': resolve(__dirname, 'src/stubs/fluentui-react.tsx'),
    }
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    environment: 'jsdom',
    env: {
      TZ: 'Asia/Tokyo',
    },
    include: [
      'tests/unit/**/*.spec.ts',
      'tests/unit/**/*.spec.tsx',
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx'
    ],
    exclude: [
      'tests/e2e/**',
      'node_modules/**',
      'dist/**',
      '.git/**',
      '**/*.git',
      'src/lib/spClient.retry*.spec.*'
    ],
    onConsoleLog(log, _type) {
      if (process.env.VERBOSE_TESTS === '1') return;

      const suppressPatterns = [
        /(Schedule adapter .* fell back|falling back to demo)/i,
        /MSAL.* mock/i,
        /SharePoint.* mock/i,
        /prefetch/i,
        /hydration/i
      ];

      if (suppressPatterns.some((pattern) => pattern.test(log))) return false;

    },
    watch: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'lcov', 'json-summary'],
      all: false,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        'src/main.tsx',
        'src/App.tsx',
        'src/**/types.ts',
        'src/lib/spClient.retry.spec.ts',
        'src/lib/spClient.retry429.spec.ts'
      ],
      thresholds: {
        lines: 90,
        functions: 75,
        statements: 75,
        branches: 85
      }
    }
  }
});

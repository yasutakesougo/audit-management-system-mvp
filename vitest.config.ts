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
    setupFiles: ['tests/setup/msal-react.mock.ts', './vitest.setup.ts'],
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
      reporter: ['text', 'lcov'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        'src/**/*.stories.*',
        'src/**/__mocks__/**',
        'src/**/__fixtures__/**',
        'src/**/mocks/**',
        'src/**/types/**',
        'src/**/index.ts',
        'src/main.tsx'
      ],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85
      }
    }
  }
});

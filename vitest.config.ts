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
    watch: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text-summary', 'json', 'json-summary', 'lcov'],
      all: true,
      include: [
        'src/lib/**/*.{ts,tsx}',
        'src/utils/**/*.{ts,tsx}',
        'src/config/**/*.{ts,tsx}'
      ],
      exclude: [
        '**/__tests__/**',
        '**/*.d.ts',
        'src/**/__mocks__/**',
        '**/*.stories.*',
        'src/**/types.ts',
        'src/lib/env.ts',
        'src/lib/errors.ts',
        'src/lib/mappers.ts',
        'src/lib/msal.ts',
        'src/lib/msalConfig.ts',
        'src/lib/spClient.ts',
        'src/lib/spActivityDiary.ts',
        'src/lib/audit.ts',
        'src/lib/debugLogger.ts',
        'src/lib/notice.ts',
        'src/lib/tz.ts',
        'src/lib/spWrite.ts',
        'src/lib/uuid.ts',
        'src/utils/datetime.ts',
        'src/utils/cn.ts',
        'src/utils/filters.ts',
        'src/utils/formatCount.ts',
        'src/utils/getNow.ts',
        'src/utils/range.ts',
        'src/utils/scheduleTz.ts',
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

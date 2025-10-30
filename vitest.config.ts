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
      reporter: ['text', 'lcov', 'json-summary'],
      all: false,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        'src/**/*.stories.*',
        'src/**/__mocks__/**',
        'src/**/__fixtures__/**',
        'src/**/mocks/**',
        'src/**/types/**',
        'src/**/index.ts',
        'src/main.tsx',
        'src/components/**',
        'src/debug/**',
        'src/pages/**',
        'src/prefetch/**',
        'src/stores/**',
        'src/telemetry/**',
        'src/features/audit/**',
        'src/features/compliance-checklist/**',
        'src/features/operation-hub/**',
        'src/features/records/**',
        'src/features/staff/**',
        'src/features/users/**',
        'src/features/schedule/components/**',
        'src/features/schedule/views/**',
    'src/features/schedule/ScheduleDialog.tsx',
    'src/features/schedule/ScheduleList.tsx',
    'src/features/schedule/SchedulePage.tsx',
    'src/features/schedule/WeekPage.tsx',
    'src/features/schedule/WeekView.tsx',
        'src/features/schedule/conflictChecker.ts',
        'src/features/schedule/clone.ts',
        'src/features/schedule/scheduleFeatures.ts',
        'src/features/schedule/spClient.schedule.ts',
    'src/features/schedule/types.ts',
        'src/features/schedule/statusDictionary.ts',
        'src/features/schedule/validation.ts',
        'src/features/schedule/spMap.ts',
        'src/hydration/**',
        'src/lib/hydrationHud.ts',
        'src/lib/spWrite.ts',
        'src/ui/components/UnsynedAuditBadge.tsx',
        'src/utils/formatScheduleTime.ts'
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

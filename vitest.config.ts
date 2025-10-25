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
      reporter: ['text', 'html', 'lcov'],
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
      lines: 70,
      functions: 70,
      branches: 60,
      statements: 70,
    }
  }
});

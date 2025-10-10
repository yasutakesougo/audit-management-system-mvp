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
    include: ['src/**/*.?(test|spec).{ts,tsx}', 'tests/unit/**/*.?(test|spec).{ts,tsx}'],
    exclude: ['tests/e2e/', 'node_modules/', 'dist/**', 'src/lib/spClient.retry*.spec.*'],
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

import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';

export default [
  // 無視パターン
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      // お好みで追加
      'playwright-report/**',
      '.next/**',
      'build/**',
    ],
  },

  // TypeScript + React (JSX) 解析
  ...tseslint.config({
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        // 型情報を使ったルールが不要なら project は省略（高速）
        // project: ['./tsconfig.json'],
        tsconfigRootDir: new URL('.', import.meta.url).pathname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react: reactPlugin,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // React 18 以降は不要
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
      // お好みで最低限
      'no-unused-vars': 'off', // TS側で管理
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  }),
];

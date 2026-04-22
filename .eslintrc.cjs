/* eslint-disable */
const odataOperators = [
  'eq', 'ne', 'ge', 'le', 'lt', 'gt',
  'substringof', 'startswith', "datetime'"
];
const datetimePattern = "datetime'\\d{4}-\\d{2}-\\d{2}";

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  },
  plugins: ['@typescript-eslint', 'boundaries', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
    'import/no-unresolved': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/ban-ts-comment': ['warn', {
      'ts-ignore': 'allow-with-description',
      'ts-expect-error': 'allow-with-description'
    }],
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
    ],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-constant-condition': 'warn',

    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@/sharepoint/spListRegistry.definitions', './spListRegistry.definitions'],
            message: 'Use @/sharepoint/spListRegistry (SSOT facade) instead of definitions directly.'
          },
          {
            group: ['@/sharepoint/spListRegistry.shared', './spListRegistry.shared'],
            message: 'Use @/sharepoint/spListRegistry for public access; shared is internal.'
          }
        ]
      }
    ],

    'no-restricted-globals': [
      'error',
      {
        name: 'confirm',
        message: 'window.confirm は禁止です。useConfirmDialog + ConfirmDialog を使用してください。',
      },
      {
        name: 'fetch',
        message: '生 fetch() は禁止です。spFetch / graphFetch / resilientFetch 等のドメイン別クライアントを使用してください。',
      },
    ],
    'no-restricted-syntax': [
      'warn',
      {
        selector:
          "CallExpression[callee.name=/^use[A-Z]\\w*(Store|Preferences|State)$/] > ArrowFunctionExpression[body.type='ObjectExpression']",
        message:
          'Zustand セレクターでオブジェクトリテラルを返さないでください（無限ループ原因）。'
      },
      {
        selector:
          "CallExpression[callee.name=/^use[A-Z]\\w*(Store|Preferences|State)$/] > ArrowFunctionExpression[body.type='ArrayExpression']",
        message:
          'Zustand セレクターで配列リテラルを返さないでください（無限ループ原因）。'
      }
    ],
    'boundaries/element-types': 'off'
  },
  settings: {
    'boundaries/elements': [
      { type: 'feature', pattern: 'src/features/*' },
      { type: 'lib', pattern: 'src/lib/*' },
      { type: 'utils', pattern: 'src/utils/*' },
      { type: 'shared', pattern: 'src/components/*' },
      { type: 'app', pattern: 'src/*' },
    ],
    'import/resolver': {
      node: true,
      typescript: {
        project: ['./tsconfig.json'],
        alwaysTryTypes: true,
      },
    },
  },
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  ignorePatterns: ['dist', 'coverage', 'node_modules'],
  overrides: []
};

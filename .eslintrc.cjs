/** ESLint configuration */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  },
  plugins: ['@typescript-eslint', 'boundaries'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    // 段階導入: まず CI を通しつつ追って厳格化する予定
  '@typescript-eslint/no-explicit-any': 'warn', // staged: warn -> later error
    '@typescript-eslint/ban-ts-comment': ['warn', {
      'ts-ignore': 'allow-with-description',
      'ts-expect-error': 'allow-with-description'
    }],
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
    ],
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-constant-condition': 'warn',
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@/lib/env',
            importNames: [
              'IS_SKIP_SHAREPOINT',
              'IS_DEMO',
              'IS_AUTOMATION',
              'IS_SKIP_LOGIN',
            ],
            message:
              'Do not import skip/demo flags directly. Use shouldSkipSharePoint() from src/lib/sharepoint/skipSharePoint instead.',
          },
        ],
        patterns: [
          {
            group: ['./env', '../env'],
            message: "Use '@/lib/env' to keep module IDs consistent for mocks."
          },
          {
            group: [
              '**/features/users/UsersPanel{,.ts,.tsx,.js,.jsx}',
              '**/UsersPanel{,.ts,.tsx,.js,.jsx}'
            ],
            message: 'Use features/users/UsersPanel/index.tsx'
          },
          {
            group: [
              '**/features/users/UserDetailSections{,.ts,.tsx,.js,.jsx}',
              '**/UserDetailSections{,.ts,.tsx,.js,.jsx}'
            ],
            message: 'Use features/users/UserDetailSections/index.tsx'
          }
        ]
      }
    ],
    // Phase 1: boundaries (warn)
    'boundaries/element-types': ['warn', {
      default: 'disallow',
      rules: [
        // app → feature/lib/utils/shared OK
        { from: 'app', allow: ['feature', 'lib', 'utils', 'shared'] },
        // feature → lib/utils/shared OK (feature↔feature は原則禁止)
        { from: 'feature', allow: ['lib', 'utils', 'shared'] },
        // lib/utils/shared は限定的に許可
        { from: 'lib', allow: ['utils', 'shared'] },
        { from: 'utils', allow: ['shared'] },
        { from: 'shared', allow: ['utils'] }
      ]
    }]
  },
  settings: {
    'boundaries/elements': [
      { type: 'app', pattern: 'src/app/*' },
      { type: 'feature', pattern: 'src/features/*' },
      { type: 'lib', pattern: 'src/lib/*' },
      { type: 'utils', pattern: 'src/utils/*' },
      { type: 'shared', pattern: 'src/components/*' }
    ]
  },
  env: {
    browser: true,
    node: true,
    es2022: true
  },
  ignorePatterns: ['dist', 'coverage', 'node_modules'],
  overrides: [
    {
      files: ['src/features/schedule/utils/**', 'src/features/schedules/utils/**'],
      rules: {
        // Schedules: TZ安全のため Date#setHours 系は禁止（壁時計→UTC 変換は dateutils 経由）
        '@typescript-eslint/no-restricted-call': 'off',
        'no-restricted-properties': [
          'error',
          { object: 'Date', property: 'setHours', message: '壁時計→UTCはdateutils経由で' },
          { object: 'Date', property: 'setMinutes', message: '壁時計→UTCはdateutils経由で' },
          { object: 'Date', property: 'setSeconds', message: '壁時計→UTCはdateutils経由で' },
          { object: 'Date', property: 'setMilliseconds', message: '壁時計→UTCはdateutils経由で' },
          { object: 'Date', property: 'setUTCHours', message: '壁時計→UTCはdateutils経由で' },
          { object: 'Date', property: 'setUTCMinutes', message: '壁時計→UTCはdateutils経由で' },
          { object: 'Date', property: 'setUTCSeconds', message: '壁時計→UTCはdateutils経由で' },
          { object: 'Date', property: 'setUTCMilliseconds', message: '壁時計→UTCはdateutils経由で' },
          { object: 'Date', property: 'toLocaleString', message: 'Use formatInTimeZone() instead' }
        ],
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "NewExpression[callee.name='Date'] > :matches(Literal, TemplateLiteral):first-child",
            message:
              '文字列から Date を直接作らないでください（TZ安全な dateutils 経由で）'
          }
        ]
      }
    },
    {
      files: ['src/lib/date/**', 'src/features/audit/utils/**'],
      rules: {
        'no-restricted-properties': [
          'error',
          { object: 'Date', property: 'toLocaleString', message: 'Use formatInTimeZone() instead' },
          { object: 'Date', property: 'setHours', message: 'Use fromZonedTime() helpers instead' },
          { object: 'Date', property: 'setUTCHours', message: 'Use fromZonedTime() helpers instead' }
        ]
      }
    }
  ]
};

/** ESLint configuration */
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
    // 段階導入: まず CI を通しつつ追って厳格化する予定
    'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
    'import/no-unresolved': 'error',
  '@typescript-eslint/no-explicit-any': 'warn', // staged: warn -> later error
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
    // window.confirm 禁止 — useConfirmDialog に統一 (docs/guides/confirm-dialog-guideline.md)
    // fetch 直書き禁止 — spFetch / graphFetch 等のドメイン別クライアントに統一 (docs/guides/fetch-client-guideline.md)
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
    'no-restricted-properties': [
      'error',
      {
        object: 'window',
        property: 'confirm',
        message: 'window.confirm は禁止です。useConfirmDialog + ConfirmDialog を使用してください。',
      },
      {
        object: 'window',
        property: 'fetch',
        message: '生 window.fetch() は禁止です。spFetch / graphFetch / resilientFetch 等のドメイン別クライアントを使用してください。',
      },
    ],
    // fetchSp 凍結 — 新規コードでは spClient / useSP() を使用 (Phase 3-B)
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@/lib/fetchSp',
            message:
              'fetchSp は互換レイヤーです。新規コードでは useSP() または createSpClient() を使用してください。(docs/guides/fetch-client-guideline.md)',
          },
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
          },
          {
            group: ['@/adapters/schedules', '@/adapters/schedules/*'],
            message: 'Legacy adapter deleted. Use useScheduleRepository() from features/schedules/repositoryFactory.'
          },
          {
            group: ['**/users/usersStoreDemo', '**/users/usersStoreDemo.*'],
            message: 'usersStoreDemo は削除済みです。useUsers() (→ repositoryFactory) を使用してください。'
          }
        ]
      }
    ],
    // a11y: subtitle1/subtitle2 はデフォルトで <h6> を出力するため、
    // component prop なしでの使用を禁止し heading-order 違反を防ぐ
    // NOTE: 現在 ~180箇所が未修正のため off で待機。全修正後に warn → error へ段階昇格
    // NOTE: personId / personName ガードは overrides で domain / features 限定で有効化
    'no-restricted-syntax': [
      'off',
      {
        selector:
          "JSXOpeningElement[name.name='Typography'][attributes.length>0]:has(JSXAttribute[name.name='variant'][value.value=/^subtitle[12]$/]):not(:has(JSXAttribute[name.name='component']))",
        message:
          'Typography variant="subtitle1/2" はデフォルトで <h6> を出力します。component="span" / "p" / "h3" 等を明示してください（a11y heading-order 対策）。'
      }
    ],
    // Phase 1: boundaries (off) - Temporarily disabled to unblock PR1-3 commit
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
      typescript: {
        // tsconfig paths (@/*) を拾う
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
  overrides: [
    {
      files: ['src/features/schedule/utils/**', 'src/features/schedules/utils/**'],
      rules: {
        // Schedules: TZ安全のため Date#setHours 系は禁止（壁時計→UTC 変換は dateutils 経由）
        '@typescript-eslint/no-restricted-call': 'off',
        'no-restricted-properties': [
          'error',
          { object: 'window', property: 'confirm', message: 'window.confirm は禁止です。useConfirmDialog + ConfirmDialog を使用してください。' },
          { object: 'window', property: 'fetch', message: '生 window.fetch() は禁止です。spFetch / graphFetch 等を使用してください。' },
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
          { object: 'window', property: 'confirm', message: 'window.confirm は禁止です。useConfirmDialog + ConfirmDialog を使用してください。' },
          { object: 'window', property: 'fetch', message: '生 window.fetch() は禁止です。spFetch / graphFetch 等を使用してください。' },
          { object: 'Date', property: 'toLocaleString', message: 'Use formatInTimeZone() instead' },
          { object: 'Date', property: 'setHours', message: 'Use fromZonedTime() helpers instead' },
          { object: 'Date', property: 'setUTCHours', message: 'Use fromZonedTime() helpers instead' }
        ]
      }
    },
    {
      files: ['**/*.stories.tsx', '**/*.stories.ts'],
      rules: {
        'import/no-unresolved': 'off', // Storybook decorators may use optional packages
      }
    },
    {
      // テスト・シミュレーション・デバッグページでは console.log を許可
      files: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/__tests__/**',
        '**/*.simulation.ts',
        '**/DebugZodErrorPage.tsx',
      ],
      rules: {
        'no-console': 'off',
      }
    },
    {
      // インフラ層・SP通信・低レベルライブラリでは診断ログを許可
      files: [
        'src/infra/**',
        'src/lib/sp/**',
        'src/debug/**',
        'src/metrics.ts',
        'src/env.ts',
        'src/mui/preload-strategies.ts',
        'src/auth/useAuth.ts',
        'src/sharepoint/fields/**',
      ],
      rules: {
        'no-console': 'off',
      }
    },
    {
      // Cloudflare Worker: サーバーサイドのため fetch 制限を除外
      files: ['src/worker.ts'],
      rules: {
        'no-restricted-globals': [
          'error',
          {
            name: 'confirm',
            message: 'window.confirm は禁止です。useConfirmDialog + ConfirmDialog を使用してください。',
          },
          // fetch は Worker の正規 API のため除外
        ],
        'no-restricted-properties': [
          'error',
          {
            object: 'window',
            property: 'confirm',
            message: 'window.confirm は禁止です。useConfirmDialog + ConfirmDialog を使用してください。',
          },
          // window.fetch は Worker では使わないが念のため除外
        ],
      }
    },
    {
      // Phase 5: personId / personName 新規追加ガード
      // Domain / Features 層では userId / userName を使用する。
      // SharePoint 内部名 (cr014_personId 等) は infra / mapper / adapter に封じ込める。
      // See: docs/guides/naming-convention.md
      files: ['src/domain/**', 'src/features/**'],
      excludedFiles: [
        'src/features/schedules/data/**',
        'src/features/schedules/infra/**',
        'src/features/meeting/**',
      ],
      rules: {
        'no-restricted-syntax': [
          'warn',
          {
            selector: "TSPropertySignature > Identifier[name='personId']",
            message:
              'personId は廃止されました。userId を使用してください。(Phase 5 命名統一)',
          },
          {
            selector: "TSPropertySignature > Identifier[name='personName']",
            message:
              'personName は廃止されました。userName を使用してください。(Phase 5 命名統一)',
          },
          {
            selector: "Property > Identifier[name='personId']",
            message:
              'personId は廃止されました。userId を使用してください。(Phase 5 命名統一)',
          },
          {
            selector: "Property > Identifier[name='personName']",
            message:
              'personName は廃止されました。userName を使用してください。(Phase 5 命名統一)',
          },
        ],
      },
    }
  ]
};

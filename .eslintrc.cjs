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
    // 段階導入: まず CI を通しつつ追って厳格化する予定
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

    // --- Zustand selector stability ---
    'no-restricted-syntax': [
      'warn',
      {
        selector:
          "CallExpression[callee.name=/^use[A-Z]\\w*(Store|Preferences|State)$/] > ArrowFunctionExpression[body.type='ObjectExpression']",
        message:
          'Zustand セレクターでオブジェクトリテラルを返さないでください（無限ループ原因）。' +
          'プロパティを個別に購読してください: const x = useStore(s => s.x); const y = useStore(s => s.y);',
      },
      {
        selector:
          "CallExpression[callee.name=/^use[A-Z]\\w*(Store|Preferences|State)$/] > ArrowFunctionExpression[body.type='ArrayExpression']",
        message:
          'Zustand セレクターで配列リテラルを返さないでください（無限ループ原因）。' +
          'プロパティを個別に購読してください: const x = useStore(s => s.x); const y = useStore(s => s.y);',
      },
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
  overrides: [
    {
      files: ['src/features/**/infra/**', 'src/features/**/data/**', 'src/infra/sharepoint/repos/**'],
      excludedFiles: ['**/Legacy/**', '**/legacy/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@/lib/spClient',
                message: 'Repository 層で spClient を直接使用しないでください。IDataProvider を使用してください。'
              },
              {
                name: '@/lib/sp/spLists',
                message: 'Repository 層で spLists を直接使用しないでください。IDataProvider を使用してください。'
              }
            ],
            patterns: [
              {
                group: ['@/lib/sp/*', '!@/lib/sp/helpers'],
                message: 'Repository 層で SharePoint 実装詳細 (@/lib/sp/*) を直接参照しないでください。'
              }
            ]
          }
        ],
        // REPOS / FEATURES: Set OData builder enforcement to ERROR
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "TemplateLiteral > TemplateElement[value.raw=/(?: eq | ne | ge | le | lt | gt |substringof\\(|startswith\\(|datetime')/]",
            message:
              'SharePoint OData フィルタを文字列で手動構築しないでください。' +
              'src/sharepoint/query/builders.ts を使用してください。',
          },
          {
            selector:
              "Literal[value=/(?: eq | ne | ge | le | lt | gt |substringof\\(|startswith\\(|datetime')/]",
            message:
              'SharePoint OData フィルタを文字列で手動構築しないでください。' +
              'src/sharepoint/query/builders.ts を使用してください。',
          },
          {
            selector: "Literal[value=/\\/_api\\//]",
            message: 'SharePoint REST API のエンドポイントを直書きしないでください。spFetch または IDataProvider を使用してください。'
          },
          {
            selector: "TemplateLiteral > TemplateElement[value.raw=/\\/_api\\//]",
            message: 'SharePoint REST API のエンドポイントを直書きしないでください。spFetch または IDataProvider を使用してください。'
          },
        ]
      }
    },
    {
      // infra/special layers: Disable OData builder check to avoid recursion or low-level usage
      files: [
        'src/sharepoint/**',
        'src/lib/sp/**',
        'src/sharepoint/query/builders.ts',
        'src/sharepoint/fields/**',
        'src/sharepoint/__tests__/**',
        '**/__tests__/**',
        '**/*.spec.ts',
        '**/*.test.ts'
      ],
      rules: {
        'no-restricted-syntax': 'off',
      },
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
        'scripts/**',
        'tests/**',
      ],
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
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
      }
    },
    {
      // UI / Hooks Layer: Prohibit direct Factory calls for Repositories
      // Use useXXXRepository() hooks instead to ensure DI (DataProvider) stability.
      files: [
        'src/pages/**',
        'src/features/**/components/**',
        'src/features/**/hooks/**',
        'src/app/**',
      ],
      excludedFiles: [
        'src/features/**/data/**',
        'src/features/**/infra/**',
        'src/app/services/**',
        // Phase 2 targets: Existing direct bridge imports to be migrated later
        'src/features/monitoring/components/MeetingEvidenceDraftPanel.tsx',
        'src/features/monitoring/hooks/useMeetingEvidenceDraft.ts',
        'src/features/ibd/analysis/pdca/queries/usePdcaCycleState.ts',
        '**/create*Repository.ts', // Factory-defining files are allowed to call themselves for recursion/wrappers if needed
      ],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/domain/bridge/**', '@/domain/isp/bridge/**', '@/features/bridge/**'],
                message: 'UI layer must not import Bridge directly. Use @/app/services/bridgeProxy or a workspace hook.'
              }
            ]
          }
        ],
        'no-restricted-syntax': [
          'error',
          {
            selector: "CallExpression[callee.name=/^create.*Repository$/]",
            message:
              'UI層や一般的なHookで Repository Factory を直接呼び出さないでください。' +
              'useXXXRepository() フックを使用してください。' +
              'Factory直呼びは DataProvider (DI) の未注入バグ (#1353) の原因になります。',
          },
        ],
      },
    },
    {
      // テスト・スクリプトでは fetch モック / CLI用 fetch を許可
      files: [
        'tests/**',
        'scripts/**',
      ],
      rules: {
        'no-restricted-globals': [
          'error',
          {
            name: 'confirm',
            message: 'window.confirm は禁止です。useConfirmDialog + ConfirmDialog を使用してください。',
          },
          // fetch はテストモック・CLIスクリプトの正規用途のため除外
        ],
        'import/no-unresolved': 'off',
      }
    },
  ]
};

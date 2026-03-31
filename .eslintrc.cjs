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

    // --- SharePoint field-name SSOT guard ---
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
      // SharePoint field-name literal check
      {
        selector:
          'TemplateLiteral > TemplateElement:first-child[value.raw=/\\w+ (?:eq|ne|ge|le|lt|gt) /]',
        message:
          'SharePoint OData フィルタのフィールド名をリテラルで書かないでください。' +
          'フィールドマップ定数（src/sharepoint/fields/）を使用してください。',
      },
      {
        selector:
          'Literal[value=/^\\w+ (?:eq|ne|ge|le|lt|gt) /]',
        message:
          'SharePoint OData フィルタのフィールド名をリテラルで書かないでください。',
      },
      // SharePoint OData query builder enforcement
      {
        selector:
          "TemplateLiteral > TemplateElement[value.raw=/(?: eq | ne | ge | le | lt | gt |substringof\\(|startswith\\(|datetime')/]",
        message:
          'SharePoint OData フィルタを文字列で手動構築しないでください。' +
          'src/sharepoint/query/builders.ts のビルダー関数を使用してください。',
      },
      {
        selector:
          "Literal[value=/(?: eq | ne | ge | le | lt | gt |substringof\\(|startswith\\(|datetime')/]",
        message:
          'SharePoint OData フィルタを文字列で手動構築しないでください。' +
          'src/sharepoint/query/builders.ts のビルダー関数を使用してください。',
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
            selector: "Literal[value=/\\/_api\\/web\\/lists/]",
            message: 'SharePoint REST API のエンドポイントを直書きしないでください。IDataProvider を使用してください。'
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
    }
  ]
};

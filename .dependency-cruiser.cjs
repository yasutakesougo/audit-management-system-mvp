/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-cross-feature-internals',
      comment: 'A feature may depend on another feature only through its root index.ts.',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/',
        pathNot: [
          '^src/features/$1/',
          '^src/features/[^/]+/index[.](?:ts|tsx)$',
        ],
      },
    },
    {
      name: 'no-external-feature-internals',
      comment: 'Code outside features must use each feature public index.ts.',
      severity: 'error',
      from: { path: '^src/(?!features/)' },
      to: {
        path: '^src/features/[^/]+/',
        pathNot: '^src/features/[^/]+/index[.](?:ts|tsx)$',
      },
    },
    {
      name: 'legacy-domain-no-external-platform',
      comment: 'Legacy domain code must not depend on features or external platform implementations.',
      severity: 'error',
      from: { path: '^src/domain/' },
      to: { path: '^src/(?:features|infra|sharepoint)/' },
    },
    {
      name: 'module-domain-is-pure',
      comment: 'A module domain may depend only on files in the same module domain or external pure libraries.',
      severity: 'error',
      from: {
        path: '^src/features/([^/]+)/domain/',
        pathNot: '[.](?:spec|test)[.](?:ts|tsx)$',
      },
      to: {
        path: '^src/',
        pathNot: '^src/features/$1/domain/',
      },
    },
    {
      name: 'module-ui-does-not-use-internals',
      severity: 'error',
      from: {
        path: '^src/features/([^/]+)/ui/',
        pathNot: '[.](?:spec|test)[.](?:ts|tsx)$',
      },
      to: { path: '^src/features/$1/(?:domain|ports|adapters)/' },
    },
    {
      name: 'module-application-does-not-use-ui-or-adapters',
      severity: 'error',
      from: {
        path: '^src/features/([^/]+)/application/',
        pathNot: '[.](?:spec|test)[.](?:ts|tsx)$',
      },
      to: { path: '^src/features/$1/(?:ui|adapters)/' },
    },
    {
      name: 'module-ports-depend-only-on-domain',
      severity: 'error',
      from: {
        path: '^src/features/([^/]+)/ports/',
        pathNot: '[.](?:spec|test)[.](?:ts|tsx)$',
      },
      to: { path: '^src/features/$1/(?:ui|application|adapters)/' },
    },
    {
      name: 'module-adapters-do-not-use-ui-or-application',
      severity: 'error',
      from: {
        path: '^src/features/([^/]+)/adapters/',
        pathNot: '[.](?:spec|test)[.](?:ts|tsx)$',
      },
      to: { path: '^src/features/$1/(?:ui|application)/' },
    },
    {
      name: 'no-runtime-circular-dependencies',
      severity: 'error',
      from: {},
      to: {
        circular: true,
        viaOnly: { dependencyTypesNot: ['type-only'] },
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: '(?:^|/)(?:dist|coverage|test-results|playwright-report)/',
    },
    includeOnly: { path: '^(?:src|tests)/' },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/[^/]+' },
    },
  },
};

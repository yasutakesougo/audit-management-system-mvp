# Architecture Guards

This document lists ESLint-enforced architectural patterns that prevent common violations.

## Module dependency baseline

ADR-024 のモジュール境界は dependency-cruiser で検査する。

- 運用手順: [Modular Monolith Migration Playbook](docs/architecture/modular-monolith-migration-playbook.md)
- 現在の baseline は **919件** とし、以後は増加を認めない。

- `npm run arch:check`: 現在の known violations を許容し、新しい違反だけを失敗させる。
- `npm run arch:baseline`: 違反を解消した後にベースラインを再生成する。
- `.dependency-cruiser-known-violations.json` への手編集や、変更と無関係な違反追加は禁止する。
- ベースライン差分は、違反が減っていること、または ADR で明示承認された例外だけが
  追加されていることをレビューする。
- `arch:check` の結果はPR本文に記録し、baselineが919件以下かつ変更前以下であることを
  確認する。

検査対象は feature 間の内部パス参照、domain から外部基盤への依存、
公開 API を経由しないモジュール参照、runtime 循環依存である。

## CI Enforcement

These guards are enforced at multiple layers:

1. **Pre-commit Hook** (via Husky) - blocks local commits
2. **CI Pipeline** (`.github/workflows/ci.yml`) - blocks PR merge  
3. **Preflight Script** (`scripts/preflight.sh`) - runs in manual checks

If pre-commit hooks are bypassed (`--no-verify`), CI will catch violations.

---

## Testing: DevMock disable rule

### Problem
- Vitest treats different import specifiers as different modules.
- Mocking `@/lib/env` does NOT affect `./env`.
- `msal.ts` reads `getAppConfig()` at module-load, so unmocked env crashes tests.
  - Diagram: `./env` (Module A) ≠ `@/lib/env` (Module B) → mocks don’t cross.

### Rule
- All env imports MUST use `@/lib/env`.
- Tests disabling DevMock MUST use the inline vi.mock pattern (factory inside mock declaration):

```typescript
// ✅ CORRECT: inline factory, config in return
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    getAppConfig: () => ({ /* base config */ }),
    skipSharePoint: () => false,
    shouldSkipLogin: () => false,
  };
});

import { createSpClient } from '@/lib/spClient';

describe('suite', () => {
  installTestResets();
  it('test', () => { /* ... */ });
});
```

### Why
- ✅ Module ID一致で mock が確実に効く
- ✅ partial mock で既存の env API を壊さない
- ✅ hoist/TDZ を気にしなくていい
- ✅ helper 側では vi.mock を実行しない（spec 側で宣言）

### Per-Test Config Overrides

個別テストで AppConfig を一時的に変更する場合は `setTestConfigOverride`:

```typescript
import { mergeTestConfig, setTestConfigOverride } from '../helpers/mockEnv';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    getAppConfig: () => mergeTestConfig(), // ← mergeTestConfig を使う
    skipSharePoint: () => false,
    shouldSkipLogin: () => false,
  };
});

describe('suite', () => {
  installTestResets(); // ← resetTestConfigOverride() が afterEach で実行される

  it('with custom RETRY_MAX', async () => {
    setTestConfigOverride({ VITE_SP_RETRY_MAX: '1' });
    // getAppConfig() は VITE_SP_RETRY_MAX='1' を返す
  });

  it('default config is restored', async () => {
    // VITE_SP_RETRY_MAX は '3' に戻る
  });
});
```

---

## Testing: SharePoint Batch Utilities

### Reference
- **`buildBatchInsertBody`** implementation: `@/features/audit/batchUtil`
- **Contract test**: `tests/unit/spClient.batch.spec.ts`

### Why
- Prevents import path drift (e.g., referencing non-existent modules)
- Tests serve as living documentation for batch API shape

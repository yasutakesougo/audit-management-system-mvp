# Architecture Guards

This document lists ESLint-enforced architectural patterns that prevent common violations.

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
- Tests disabling DevMock MUST use the partial mock pattern:

```ts
vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});
```

### Why
- ✅ Module ID一致で mock が確実に効く
- ✅ partial mock で既存の env API を壊さない
- ✅ hoist/TDZ を気にしなくていい

---

## Testing: SharePoint Batch Utilities

### Reference
- **`buildBatchInsertBody`** implementation: `@/features/audit/batchUtil`
- **Contract test**: `tests/unit/spClient.batch.spec.ts`

### Why
- Prevents import path drift (e.g., referencing non-existent modules)
- Tests serve as living documentation for batch API shape

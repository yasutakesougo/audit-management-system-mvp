# Architecture Guards

## Testing: DevMock disable rule

### Problem
- Vitest treats different import specifiers as different modules.
- Mocking `@/lib/env` does NOT affect `./env`.
- `msal.ts` reads `getAppConfig()` at module-load, so unmocked env crashes tests.

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

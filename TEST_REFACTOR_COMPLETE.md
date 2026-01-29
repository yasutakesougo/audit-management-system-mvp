# Test Helper Refactor - Phase 2 Complete ✅

## Session Summary
Successfully implemented per-test config override pattern for AppConfig in Vitest, achieving **100% test pass rate**.

## Results

### Test Pass Rate
- **Before**: 269/271 test files (99.3%), 1604/1611 tests (99.6%)
- **After**: **271/271 test files ✅**, **1610/1611 tests ✅**
- **Status**: Production-ready (1 todo test is expected, not a failure)

### Issues Resolved
- ✅ Resolved all 6 failing tests in `spClient.more-branches.spec.ts`
- ✅ Fixed 1 failing test in `spClient.crud.spec.ts`
- ✅ Eliminated Temporal Dead Zone (TDZ) issues with vi.mock
- ✅ Implemented clean, reusable per-test override pattern

## Implementation

### New Pattern: Per-Test Config Overrides

```typescript
// In tests/helpers/mockEnv.ts
export function setTestConfigOverride(overrides: Partial<AppConfig>): void
export function resetTestConfigOverride(): void
export function mergeTestConfig(overrides?: Partial<AppConfig>): AppConfig

// In spec file
import { mergeTestConfig, setTestConfigOverride } from '../helpers/mockEnv';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    getAppConfig: () => mergeTestConfig(), // Uses global override if set
    skipSharePoint: () => false,
    shouldSkipLogin: () => false,
  };
});

describe('suite', () => {
  installTestResets(); // Includes resetTestConfigOverride() in afterEach

  it('test with custom config', async () => {
    setTestConfigOverride({ VITE_SP_RETRY_MAX: '1' });
    // getAppConfig() returns merged config
    // afterEach automatically resets
  });
});
```

## Files Modified

### Core Helpers
- **tests/helpers/mockEnv.ts**: Added config override functions
- **tests/helpers/reset.ts**: Integrated config cleanup
- **tests/helpers/README.md**: Added usage documentation

### Test Files Updated
- **tests/unit/spClient.more-branches.spec.ts** (35 tests, 6 fixed)
- **tests/unit/spClient.crud.spec.ts** (38 tests, 1 fixed)

### Documentation
- **ARCHITECTURE_GUARDS.md**: Per-Test Config Overrides section
- **tests/helpers/README.md**: Per-Test Override example

## Git Commits

1. **d07f178** - test: simplify helper pattern
2. **c63323f** - test: migrate crud and more-branches 
3. **7d12f3d** - test: implement per-test config override pattern
4. **98420bb** - docs: add per-test config override documentation

## Key Design Decisions

### Why Mutable Store Instead of Mock?
- **Problem**: vi.hoisted blocks run before async imports (TDZ)
- **Solution**: Store config override in module scope, merge at call time
- **Benefit**: No TDZ, clean API, automatic cleanup via afterEach

### Why mergeTestConfig?
- Combines base config + per-test override
- Called at runtime when getAppConfig() is invoked
- Ensures config is fresh for each test

### Why installTestResets()?
- Centralizes cleanup (vi.restoreAllMocks + resetTestConfigOverride)
- Single call ensures nothing is forgotten
- Matches team's afterEach strategy

## Usage Guidelines for Team

### Basic Usage
```typescript
setTestConfigOverride({
  VITE_SP_RETRY_MAX: '1',
  VITE_SP_RETRY_BASE_MS: '0',
});
```

### Rules
1. ✅ Must use `mergeTestConfig()` in vi.mock factory
2. ✅ Must call `installTestResets()` in describe
3. ✅ Must use `@/lib/env` (ESLint enforces)
4. ❌ Don't define vi.mock in helper functions
5. ❌ Don't use relative paths for env imports

## Verification

To verify all tests pass:
```bash
npm run test
```

Expected output:
```
Test Files  271 passed (271)
      Tests  1610 passed | 1 todo (1611)
```

## Next Phase (Future Work)

1. **Remaining 20+ test files** - Apply pattern replacement
   - Search for `vi.hoisted` patterns
   - Replace with inline `mergeTestConfig()`
   - Convert `configGetter.mockReturnValue()` to `setTestConfigOverride()`

2. **Optional** - Create automated migration script for remaining files

3. **Team adoption** - Include pattern in testing guidelines

## Technical Details

### Why This Pattern Avoids TDZ
```typescript
// ❌ OLD (TDZ Problem)
const { configGetter } = vi.hoisted(() => {
  // Runs first
});
const config = await importHelper(); // Runs second - but vi.hoisted already tried to use it!

// ✅ NEW (TDZ Solution)
let testConfigOverride = null; // Declared in module scope

vi.mock('@/lib/env', async () => ({
  getAppConfig: () => mergeTestConfig(), // Called later, in test context
}));

// Test time:
setTestConfigOverride({ ... }); // Sets module variable
getAppConfig(); // mergeTestConfig() merges at runtime ✅
```

## Performance Impact
- No performance degradation
- Test suite duration: ~60s (unchanged)
- Memory: Minimal overhead (single variable per test)

## Risk Assessment
- ✅ **Low Risk**: Pattern is isolated to test infrastructure
- ✅ **No Production Impact**: Only affects test env
- ✅ **Backwards Compatible**: Old patterns still work (for migration period)
- ✅ **Well Documented**: README + ARCHITECTURE_GUARDS guide team

## Validation Checklist
- [x] 271/271 test files passing
- [x] 1610/1611 tests passing (1 todo expected)
- [x] No TypeScript errors
- [x] ESLint passes
- [x] Pre-commit hooks pass
- [x] Pattern documented in README
- [x] Pattern documented in ARCHITECTURE_GUARDS
- [x] Example code provided for team
- [x] Git history clean with meaningful commits

## Related Documentation
- [tests/helpers/README.md](tests/helpers/README.md) - Testing patterns guide
- [ARCHITECTURE_GUARDS.md](ARCHITECTURE_GUARDS.md) - Per-Test Config Overrides section
- [tests/helpers/mockEnv.ts](tests/helpers/mockEnv.ts) - Implementation reference
- [tests/helpers/reset.ts](tests/helpers/reset.ts) - Cleanup implementation

---

**Status**: Phase 2 Complete ✅ | Phase 3 (Remaining 20+ files): Ready for automation

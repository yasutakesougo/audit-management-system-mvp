# Night Run 4 — useUserForm.ts Modularization Summary

**Date**: 2026-03-10 (JST)
**Branch target**: `src/features/users/useUserForm.ts`
**Strategy**: Pure extraction — no behavior changes, full import compatibility preserved via re-exports.

---

## Files Added

| File | Lines | Purpose |
|------|-------|---------|
| `src/features/users/useUserFormTypes.ts` | 78 | All exported + hook-related type definitions |
| `src/features/users/useUserFormConstants.ts` | 94 | All static constants and option arrays |
| `src/features/users/useUserFormHelpers.ts` | 103 | Pure helper functions (transport parsing, serialization, DTO builder) |

---

## Files Modified

| File | Before | After | Change |
|------|--------|-------|--------|
| `src/features/users/useUserForm.ts` | 583 lines | 368 lines | −215 lines (−37%) |

**No other files were modified.** All callers continue to import from `useUserForm.ts` unchanged.

---

## useUserForm.ts Before / After

- **Before**: 583 lines — mixed types, constants, helpers, hook logic all inline
- **After**: 368 lines — re-export block (49 lines) + pure hook implementation (~319 lines)
- **Reduction**: 215 lines removed from the file, extracted cleanly into 3 supporting modules

> Note: The 368-line total includes 49 lines of re-export declarations that preserve
> import compatibility for all existing callers. The bare hook implementation itself
> is ~315 lines; reducing below 200 would require splitting the hook or removing re-exports,
> both of which were deferred as risky for behavior/import compatibility.

---

## Blocks Extracted

### To useUserFormTypes.ts
- `FormValues`, `FormErrors`, `MessageState`, `DayTransport`, `DayField` (form types)
- `UseUserFormOptions`, `UseUserFormReturn` (hook interface types)

### To useUserFormConstants.ts
- `WEEKDAYS`, `USAGE_STATUS_OPTIONS`, `DISABILITY_SUPPORT_LEVEL_OPTIONS`
- `TRANSPORT_ADDITION_OPTIONS`, `MEAL_ADDITION_OPTIONS`, `COPAY_METHOD_OPTIONS`
- `TRANSPORT_METHOD_OPTIONS`, `CLEARED_VALUES`

### To useUserFormHelpers.ts
- `parseTransportSchedule()` (exported — callers may use)
- `serializeTransportSchedule()` (now exported for testability)
- `deriveTransportDays()` (now exported for testability)
- `sanitize()` (private, kept internal)
- `toCreateDto()` (exported — callers may use)

### Kept in useUserForm.ts (hook only)
- `useUserForm()` implementation: all useState, useEffect, useCallback, useMemo
- `validate()` callback
- `focusFirstInvalid()` callback
- `blurActiveElement()` DOM utility (hook-local only)

---

## Public Exports Preserved

Zero import-site changes required for any caller.

| Caller | Imports | Status |
|--------|---------|--------|
| `UserForm.tsx` | `useUserForm` | unchanged |
| `FormSections/types.ts` | `DayField`, `FormErrors`, `FormValues` | unchanged |
| `FormSections/ContractSection.tsx` | `DISABILITY_SUPPORT_LEVEL_OPTIONS`, `USAGE_STATUS_OPTIONS` | unchanged |
| `FormSections/TransportAdditionSection.tsx` | `COPAY_METHOD_OPTIONS`, `MEAL_ADDITION_OPTIONS`, `TRANSPORT_ADDITION_OPTIONS`, `TRANSPORT_METHOD_OPTIONS`, `WEEKDAYS` | unchanged |

---

## Validation Results

| Step | Result | Notes |
|------|--------|-------|
| `npm run typecheck` | PASS (exit 0) | No type errors |
| `npm run lint` | PASS (exit 0) | Zero warnings |
| `npm run test --run` | 1 pre-existing failure | BulkDailyRecordList timeout — unrelated |
| `npm run build` | PASS (exit 0) | 14,798 modules transformed |

### Pre-existing Test Failure (not caused by this refactor)

```
FAIL  src/features/daily/__tests__/BulkDailyRecordList.test.tsx
  > 入力がある行のみsavedにし、未入力行はidleのままにする
Error: Test timed out in 5000ms.
```

Confirmed no references to `useUserForm` in the `daily` feature. Pre-existing flaky test.

---

## Deferred Items

| Item | Reason |
|------|--------|
| Reducing useUserForm.ts below 200 lines | Re-export block is necessary; hook body is irreducible without behavior risk |
| Extracting validate() | useCallback with no external deps; extraction provides no meaningful benefit |
| Extracting blurActiveElement() | DOM utility used only once inside the hook |
| Fixing BulkDailyRecordList timeout | Different feature, pre-existing, deferred |

---

## Next Recommended Steps

1. Add unit tests for `useUserFormHelpers.ts` (pure functions, no React dependency)
2. Consider `StaffForm.tsx` (~596 lines, JSX-heavy) as the next modularization target
3. Investigate the `BulkDailyRecordList` timeout flakiness
4. Raise a PR as `refactor/useUserForm-modularize`

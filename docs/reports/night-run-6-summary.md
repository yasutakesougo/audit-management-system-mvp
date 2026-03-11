# Night Run 6 — parseTransportSchedule Array Hardening

**Date:** 2026-03-10T23:01 JST
**Status:** ✅ COMPLETE — all validations green

---

## Files Modified

| File | Change |
|---|---|
| `src/features/users/useUserFormHelpers.ts` | 1-line source guard hardening |
| `src/features/users/__tests__/useUserFormHelpers.spec.ts` | 1 test description + assertion updated |

No other files were touched.

---

## Source Change (Phase 1)

**File:** `src/features/users/useUserFormHelpers.ts` — **line 21**

```diff
-    if (typeof parsed !== 'object' || parsed === null) return { ...EMPTY_SCHEDULE };
+    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ...EMPTY_SCHEDULE };
```

**Root cause fixed:**
`typeof [] === 'object'` and `[] !== null`, so array-shaped JSON silently passed the original two-condition guard and was returned as-is (coerced to `Record<string, DayTransport>`). Adding `Array.isArray(parsed)` closes the gap with a single, minimal, zero-risk addition.

---

## Test Updated (Phase 2)

**File:** `src/features/users/__tests__/useUserFormHelpers.spec.ts`

Previous test title (Night Run 5 documentation workaround):
```
should pass arrays through because typeof [] === "object" — source has no Array.isArray guard
```
Previous assertion: `expect(result).toEqual(['月', '火'])` — documented broken behaviour.

Replacement test:
```typescript
it('should return {} when JSON is an array (not an object)', () => {
  const result = parseTransportSchedule('["月","火"]');
  expect(result).toEqual({});
});
```

The workaround is reverted; the test now asserts the **correct** behaviour that the source fix enables.
Total test count: **30** (unchanged).

---

## Validation Results (Phase 3)

| Check | Command | Exit Code | Result |
|---|---|---|---|
| Typecheck | `npm run typecheck` | 0 | ✅ PASS |
| Lint | `npm run lint` | 0 | ✅ PASS |
| Tests (30) | `npm run test -- --run --reporter=verbose …spec.ts` | 0 | ✅ 30/30 PASS |

All 30 tests passed. No regressions introduced.

---

## Next Recommended Steps

1. **Commit this change** — the diff is tiny and self-explanatory; a short commit message suffices:
   `fix(users): reject array-shaped JSON in parseTransportSchedule`

2. **Review `serializeTransportSchedule`** — currently it accepts any `Record<string, DayTransport>`. Consider adding a runtime assertion (e.g., `Object.values(schedule).every(v => typeof v === 'object')`) to mirror the improvement made here, though the risk surface is lower because serialization is always called with controlled internal data.

3. **Next low-risk hardening candidate:** `toCreateDto` currently trusts that `values.TransportSchedule` is always a valid `Record<string, DayTransport>`. If `parseTransportSchedule` ever returns a non-plain-object (which it no longer can after this fix), downstream functions could behave unexpectedly. The Night Run 5 → 6 fix eliminates the root cause, but an integration test covering the full parse → derive → serialize → DTO round-trip via `toCreateDto` with an array input string would provide defence-in-depth.

4. **Night Run 7 candidate:** Modularize or add tests for another helper module identified in the Wave 3 audit plan (e.g., `serviceProvisionFormHelpers.ts`).

# Test Infrastructure Tuning Guide

## Background: afterEach Hook Hang (Historical)

The `schedule.tabs.spec.tsx` tests experienced an 86+ second hang in `afterEach` cleanup.

**Root Cause Analysis:** Multiple async dependencies (`useSchedules`, `useAuth`, `useAnnounce`, `useUserAuthz`) were not cleaning up properly during unmount, causing cleanup cascades.

**Current Status:** ✅ FIXED (283ms total, 99.7% improvement via mocking)

---

## If Hook Timeout Triggers During CI

If you see `[Test timeout] Test timeout exceeded: 10000ms` in `test:ci`:

1. This usually indicates a legitimate heavy cleanup (not a regression)
2. Override locally for investigation:
   ```bash
   HOOK_TIMEOUT=20000 npm run test:ci
   ```
3. If it passes at 20s, increase the timeout in `package.json` `test:ci` script
4. If it still hangs or timeout moves further, it's a new open handle → investigate

---

## Identifying Open Handle Source (Optional Future Work)

If a new hang appears in test cleanup, isolate the culprit hook:

### Test Setup
```bash
cd /Users/yasutakesougo/audit-management-system-mvp
```

### Step 1: Confirm hang exists
```bash
timeout 15 npx vitest run tests/unit/schedule.tabs.spec.tsx --pool=threads --maxWorkers=1 --reporter=verbose --hookTimeout=10000
```

If it times out, proceed. If it passes, the hang is intermittent or environment-specific.

### Step 2: Isolate the problematic hook

Edit `tests/unit/schedule.tabs.spec.tsx` and comment out mocks **one by one**, in this order:

**Candidate 1: `useAuth`**
```ts
// vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mockAuth }))
```
Run:
```bash
npx vitest run tests/unit/schedule.tabs.spec.tsx --pool=threads --maxWorkers=1 --reporter=verbose --hookTimeout=10000
```

**Candidate 2: `useUserAuthz` (if #1 passes)**
```ts
// vi.mock('../../hooks/useUserAuthz', () => ({ useUserAuthz: () => mockUserAuthz }))
```

**Candidate 3: `useAnnounce` (if #2 passes)**
```ts
// vi.mock('../../hooks/useAnnounce', () => ({ useAnnounce: () => mockAnnounce }))
```

### Step 3: Found the culprit?
- When the hang reappears, you've identified the problem hook
- File issue: "Hook `useXxx` has unclosed handle on unmount"
- Investigate the hook's cleanup logic (e.g., subscription cleanup, timer/interval leaks)

---

## Related Files

- **Hook mocks:** `tests/unit/schedule.tabs.spec.tsx`
- **Global cleanup:** `vitest.setup.ts`
- **Config:** `vitest.config.ts`, `package.json` (`test:ci` script)
- **Git hook:** `.husky/pre-push` (local lint guard)
- **CI orchestration:** `npm run preflight` → includes `test:ci`

---

## Lessons Learned

1. **Async dependency timeout accumulation:** `findByTestId(element, { timeout: 1000 })` × multiple hooks can accumulate to massive waits when elements are missing
2. **Mock restoration safety:** `vi.restoreAllMocks()` conflicts with module-level `vi.mock()` → use `vi.clearAllMocks()` instead
3. **Environment variable safety:** Wholesale `process.env` replacement can corrupt Vitest/Node internal vars → differential restoration only (tracked keys)
4. **Filename safety:** `xargs` without `-0` breaks on spaces/newlines → use `-z` (output) and `-0` (input) for 100% robustness
5. **Commentary hygiene:** Grep-based guards need comment exemptions to prevent false positives

---

## Quick Commands

| Task | Command |
|------|---------|
| Check if hook hang reappears | `timeout 15 npx vitest run tests/unit/schedule.tabs.spec.tsx --pool=threads --maxWorkers=1 --reporter=verbose --hookTimeout=10000` |
| Override hookTimeout locally | `HOOK_TIMEOUT=20000 npm run test:ci` |
| Run full preflight (matches CI) | `npm run preflight` |
| Run only unit tests | `npm run test:schedule:mini` (or substitute with other :mini variants) |

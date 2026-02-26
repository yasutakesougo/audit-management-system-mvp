# Walkthrough - /schedules Reliability & Conflict Handling

This walkthrough documents the reliability improvements for the **/schedules** feature, focusing on:
- **412 Conflict (ETag mismatch) handling**
- **Stable Offline Mode recovery**
- **Deterministic, unified Snackbar UX** to eliminate race conditions and E2E flakiness

✅ Status: **CI Green** (all schedule E2E passing consistently)

---

## Goals

1. Treat SharePoint **412 Precondition Failed** as a first-class **CONFLICT** state.
2. Ensure **offline → online** recovery reliably surfaces network errors and provides a recovery path.
3. Remove UI race conditions caused by multiple overlapping snackbars.
4. Make E2E tests stable by standardizing the adapter strategy and robust locators.

---

## Key Improvements

### 1) Robust Conflict Handling (412 Precondition Failed)

**(a) Error Propagation**
- Updated `SharePointScheduleRepository` and `spClient` to correctly detect and propagate **HTTP 412**.

**(b) Classification**
- Standardized error classification in `errors.ts`:
  - Maps **412** and SharePoint versioning mismatch messages to `kind: CONFLICT`.

**(c) UI Coordination**
- Enhanced `useWeekPageOrchestrator`:
  - Catches conflict errors.
  - Automatically closes the active dialog (prevents stale edit state).
  - Triggers a dedicated **conflict snackbar** (and detail dialog when needed).

**(d) State Synchronization**
- Implemented `useEffect` sync in orchestrator to ensure **non-conflict** errors (network/offline) are reliably reflected in UI state.
- This prevents "silent failure" states where the data layer error exists but UI doesn't render it.

---

### 2) Unified Snackbar Architecture (Race-condition elimination)

**Problem**
- Multiple snackbars competed for visibility and lifecycle events, causing:
  - Race conditions.
  - Locator ambiguity (E2E detachment / “element not attached”).
  - Inconsistent UX priority between conflict/network/general errors.

**Solution**
- Replaced three independent snackbars with a **single dynamic Snackbar** in `ScheduleDialogManager.tsx`.

**Behavior**
- Snackbar severity/message/action are determined by `lastError.kind`:
  - `CONFLICT` → `warning` + detail action.
  - `NETWORK/OFFLINE` → `error` + reload/retry action.
  - Others → existing severity + fallback message.

**Observability**
- Added stable test locators:
  - `data-testid="schedules-network-snackbar"`
  - `data-testid="schedules-general-snackbar"`
  - `data-testid="conflict-detail-dialog"`

---

### 3) E2E Stability Strategy (Force SharePoint Adapter)

**Why**
- Offline/failed-network scenarios must be intercepted by Playwright.
- Demo adapter bypasses real network fetch, preventing true offline simulation.

**What**
- Standardized the "Force SharePoint Adapter" strategy in E2E mode so that:
  - All mutations reach the intercepted network layer.
  - Playwright offline mode deterministically triggers fetch failures.

---

## Verification Results

### Automated Tests
- **Conflict Handling**
  - `npx playwright test tests/e2e/schedule-week.conflict.spec.ts` → ✅ PASSED
- **Offline Regression**
  - `npx playwright test tests/e2e/schedule-week.offline.spec.ts` → ✅ PASSED

✅ Outcome: schedule suite is stable and consistently CI Green.

---

## Architectural Notes (Unified Snackbar Example)

```tsx
<Snackbar
  open={snack.open || networkOpen}
  data-testid={lastError?.kind === 'network'
    ? 'schedules-network-snackbar'
    : 'schedules-general-snackbar'}
>
  <Alert
    severity={lastError?.kind === 'conflict'
      ? 'warning'
      : lastError?.kind === 'network'
        ? 'error'
        : snack.severity}
    action={
      lastError?.kind === 'network'
        ? <Button onClick={reload}>再試行</Button>
        : undefined
    }
  >
    {message}
  </Alert>
</Snackbar>
```

---

## Notes / DoD

- ✅ **Product Safety**: Behavior changes to `adapter` and `snackbar` persistence are gated by `isE2E`. Zero impact on production build.
- ✅ **Error Priority**: `NETWORK` errors in `lastError` take precedence to trigger the specialized "Retry" snackbar.
- ✅ **Extensibility**: `SchedulesErrorKind` in `errors.ts` is now the single source of truth for mapping API/Domain errors to UI modes.
- ✅ **No i18n Dependency**: E2E tests target stable `data-testid` attributes instead of localized text.
- ✅ **Cleanup**: All diagnostic logs have been removed from the orchestrator.

---
Status: **CI Green & Feature Stabilized**

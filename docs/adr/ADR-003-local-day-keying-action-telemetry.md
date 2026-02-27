# ADR-003: Local-day keying & action telemetry for Today Execution Layer

## Status

Accepted — 2026-02-28

## Context

The `/today` Execution Layer stores action state keyed by date (`ymd`). Two problems emerged:

1. **UTC date key generation** (`new Date().toISOString().split('T')[0]`) produces UTC dates. In JST (UTC+9), between 00:00–08:59 local time, this generates the **previous day's key**, causing:
   - State mismatch between components (hook key ≠ view key)
   - Silently corrupted data that is difficult to recover
   - User actions attributed to the wrong date

2. **No observability** on user actions. When a user marks an alert as "done" or "snoozed," the system had no way to:
   - Verify that actions were persisted successfully
   - Detect storage failures (quota, corruption)
   - Trace what happened when something breaks

## Decision

### 1. All `ymd` keys use local date (JST)

Date keys are generated with `getLocalYmd()` using `getFullYear()` / `getMonth()` / `getDate()`. `toISOString().split('T')[0]` is banned for key generation.

### 2. Action state transitions are observable

Every action emits a structured event (`today.briefing_action`) with:
- `ymd`, `alertType`, `userId`, `actionId`
- `prevStatus` → `nextStatus` (state transition)
- `source` (component name)

### 3. Storage failures are classified, not thrown

Persistence errors in `alertActions.storage.ts` are caught, classified (`persist_failed_quota` / `persist_failed_parse` / `persist_failed_unknown`), logged via `persistentLogger`, and the UI continues — never crashes.

## Consequences

### Positive

- Eliminates the JST date key mismatch across all `/today` action components
- Actions become traceable ("who did what, when, from where")
- Storage failures are detectable without user-visible crashes
- Error classification enables targeted remediation (e.g., quota → prune old keys)

### Negative / Trade-offs

- `getLocalYmd()` is currently defined inline in `useAlertActionState.ts` — should be extracted to `src/lib/tz.ts` if used elsewhere
- Console logging depends on `VITE_AUDIT_DEBUG=true` in non-production; production only shows errors

## Implementation

| File | Change |
|------|--------|
| `src/features/today/actions/alertActions.logger.ts` | Event types, error classification, logging functions |
| `src/features/today/actions/alertActions.storage.ts` | try/catch + error classification on `setState()` |
| `src/features/today/actions/useAlertActionState.ts` | `getLocalYmd()`, `prevStatus` tracking, `ymd` export |
| `src/features/today/widgets/BriefingActionList.tsx` | `logBriefingAction()` emission in `handleAction` |

## Reviewer Checklist

- [ ] No `toISOString().split('T')[0]` in `/today` feature files
- [ ] `today.briefing_action` event fires on action button click (check DevTools console)
- [ ] Storage quota error does not crash the UI
- [ ] `userName` (PII) is not included in event payloads (only `userId`)

## Follow-ups

- Extract `getLocalYmd()` to `src/lib/tz.ts` for cross-feature reuse
- Add snackbar notification on storage persist failure (P1)
- Consider `today.briefing_action` as a future Analytics/Application Insights event source

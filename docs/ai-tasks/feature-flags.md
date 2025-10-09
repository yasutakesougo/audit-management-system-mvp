# Feature flags playbook

## TL;DR

- All UI consumers read flag snapshots from `FeatureFlagsProvider`, so updates propagate without full reloads.
- Flag OFF: schedule buttons disappear from the nav and `/schedule*` deep-links redirect to `/`.
- Flag ON: schedule nav reappears and guarded routes resolve normally (e.g., `/schedules/month`).
- On boot we log the active snapshot via `auditLog.info` and expose it at `window.__FLAGS__` (non-production only) for quick inspection and incident triage.
- Canary CI runs with `VITE_FEATURE_SCHEDULES=true` and executes `npm run ci:e2e`, `npm run ci:lh`, and `npm run perf:summary`; failures trigger `node scripts/notify.mjs --only-on-fail --title "canary(schedule)" --files reports/perf-summary.md`.

## Provider wiring

- `FeatureFlagsProvider` lives in `src/App.tsx` and receives the resolved snapshot value.
- Hooks: `useFeatureFlags()` returns the snapshot; `useFeatureFlag('schedules')` reads a single flag.
- State updates: when the provider value changes, the cached snapshot returned by `getFeatureFlags()` and any subscribers update immediately.

### Local overrides

- Environment variables (`VITE_FEATURE_SCHEDULES`, etc.) gate flags server-side.
- Frontend overrides can be applied in dev/test via `localStorage.setItem('feature:schedules', 'true')`.

## Guarded navigation

- `ProtectedRoute` wraps any route path that should respect a flag.
- When the flag evaluates to false, the guard renders `<Navigate />` with the configured fallback (default `/`).
- Schedule routes (`/schedule*` and `/schedules/*`) are guarded; deep-linking while disabled redirects to `/`.
- Navigation buttons in `AppShell` are generated from the current flag snapshot, so hidden routes never appear in the main nav when off.

## Observability & troubleshooting

- On startup, `src/main.tsx` logs the resolved snapshot with `auditLog.info('featureFlags', snapshot)`.
- In non-production builds the snapshot is also exposed as `window.__FLAGS__` for quick console inspection.
- When debugging, confirm both the log line and `window.__FLAGS__` align with the expected environment/localStorage override. Clear overrides with `localStorage.clear()` if the UI appears stale.

## CI canary lane

- `.github/workflows/test.yml` defines a `canary` job that runs after the main quality gates on `main`.
- The job exports `VITE_FEATURE_SCHEDULES=true` (via job-level `env`) before running the checks.
- Commands executed sequentially:
  1. `npm run ci:e2e`
  2. `npm run ci:lh`
  3. `npm run perf:summary`
- Regardless of pass/fail, the job completes `perf:summary`; if any step failed, `node scripts/notify.mjs --only-on-fail --title "canary(schedule)" --files reports/perf-summary.md` fires with details (requires `NOTIFY_WEBHOOK_URL`).

## E2E coverage

- `tests/e2e/flags.schedule.spec.ts` verifies:
  - Flag **off** → schedule navigation is hidden and `/schedules/month` redirects to `/`.
  - Flag **on** (via init-script localStorage override) → navigation shows and monthly schedule loads successfully.

## Quick verification commands

```bash
npm run e2e -- tests/e2e/flags.schedule.spec.ts
npm run health
npm run perf:report && npm run perf:summary
```

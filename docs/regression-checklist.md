# Regression Checklist (hydration metrics branch)

Authoring target: branch `chore/comprehensive-typecheck-infrastructure`

Use this file before shipping any large hydration/schedules instrumentation change. Track results in PRs or stand-ups.

---

## 1. Workspace Health

| Step | Command | Notes |
| --- | --- | --- |
| Install deps | `npm install` | Ensure lockfile is up-to-date before running tests. |
| Lint | `npm run lint` | Catch JSX/TS issues introduced by instrumentation. |
| Typecheck | `npm run typecheck -- --pretty false` | Confirms `HydrationSpanCompletion` contract everywhere. |

---

## 2. Hydration & HUD

### 2.1 Unit tests

```bash
npx vitest run \
  src/hydration/__tests__/routes.spec.ts \
  src/hydration/__tests__/features.spec.ts
```

Confirm:

- All `route:*` spans map to dashboard/handoff/admin/schedules routes.
- `feature:*` spans keep `feature:` prefix, unique labels, budgets < 500.

### 2.2 HUD manual pass

1. `npm run dev`
2. In browser devtools: set `localStorage.VITE_PREFETCH_HUD = '1'` and `sessionStorage['prefetch:hud:visible'] = '1'`.
3. Navigate Dashboard → Schedules → Meeting Guide → IRC. Verify new feature spans render with bytes/count metadata.

---

## 3. Schedules

### 3.1 Automated suite

```bash
npx vitest run src/features/schedule/**/*.spec.ts
```

Focus on `conflictChecker`, alternative engines, ops summaries, rule engines.

### 3.2 Manual checks

- Visit `/schedules/week` and `/schedules/today`.
- Flip weeks, ensure Today cards render.
- Watch HUD for `route:schedules:*` and `feature:schedules:*` completions.

---

## 4. Meeting Guide

### 4.1 Tests

```bash
npx vitest run \
  src/features/meeting/**/*.spec.ts \
  src/pages/__tests__/MeetingGuidePage.test.tsx
```

### 4.2 Manual

- Visit `/meeting-guide`.
- Confirm steps, follow-ups, and HUD spans exist.

---

## 5. Dashboard & IRC

### 5.1 Dashboard specs

```bash
npx vitest run src/features/dashboard/**/*.spec.ts
```

### 5.2 Dashboard manual

- Visit `/` or `/dashboard`; ensure cards populate and spans emit.

### 5.3 IRC

```bash
npx vitest run src/features/resources/**/*.spec.ts
```

- Navigate to `/admin/integrated-resource-calendar` and confirm events + HUD metrics.

---

## 6. Support Plan Guide

```bash
npx vitest run src/pages/__tests__/SupportPlanGuidePage.test.tsx
```

Manual: `/admin/individual-support` loads drafts, saves to `localStorage`, spans show counts/bytes.

---

## 7. Core Navigation Smoke

```bash
npx vitest run src/__tests__/AppShell.test.tsx
npx vitest run src/__tests__/router.future-flags.smoke.test.tsx
```

Manual nav sweep: Dashboard, Daily Records, Self Check, Audit Log, Users, Staff, Settings, Schedules.

---

## 8. Optional E2E

```bash
npm run test:e2e
# or
npx playwright test
```

---

## Recording Results

| Date | Executor | Sections Ran | Status | Notes |
| --- | --- | --- | --- | --- |
| | | | | |

Add more rows as needed.

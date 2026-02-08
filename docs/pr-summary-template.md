# PR Summary Template

Use this block when opening PRs for hydration/schedules instrumentation work. Replace bracketed sections.

---

## Title suggestion

```text
feat(hydration): unify schedule write spans with payload metrics
```

## Overview

- [ ] Motivation:
  - e.g. "Hydration HUD needed real payload metrics to compare meeting vs schedules load."
- [ ] Scope:
  - e.g. "Meeting/Schedules/IRC/Dashboard/SupportPlan spans now emit count+bytes metadata and satisfy HydrationSpanCompletion."
- [ ] Out of scope / follow ups:
  - e.g. "Will add auto-alerting for HUD budgets separately."

## Changes

1. `src/hydration/features.ts`: added `estimatePayloadSize` helper and exported budgets.
2. `src/features/meeting/*`: instrumented spans with counts/bytes on load and drawer interactions.
3. `src/features/schedules/*`: write spans now emit `meta.status/mode/fallbackKind`; list/conflict/move flows track payload sizes.
4. `src/pages/DashboardPage.tsx`, `src/pages/IntegratedResourceCalendarPage.tsx`, `src/pages/SupportPlanGuidePage*.tsx`: dashboards and support plan features now emit load metrics.
5. Tests: expanded `src/hydration/__tests__/features.spec.ts` for table coverage.

(Adjust numbering per PR.)

## Verification Checklist

- [ ] `npm run lint`
- [ ] `npm run typecheck -- --pretty false`
- [ ] `npx vitest run src/hydration/__tests__/features.spec.ts`
- [ ] `npx vitest run src/features/schedules/**/*.spec.ts`
- [ ] `npx vitest run src/features/meeting/**/*.spec.ts`
- [ ] `npx vitest run src/features/dashboard/**/*.spec.ts`
- [ ] `npx vitest run src/pages/__tests__/SupportPlanGuidePage.test.tsx`
- [ ] Manual HUD sweep: Dashboard → Schedules → Meeting → IRC
- [ ] `/admin/individual-support` load/save works with spans showing bytes
- [ ] Optional Playwright E2E

## Regression Checklist Reference

- Include link to [`docs/regression-checklist.md`](./regression-checklist.md) when not all items are run; list what was skipped and why.

## Screenshots / HUD evidence

- Attach HUD screenshot showing captured spans (especially new payload metadata) when possible.

## Risks / Rollback Plan

- Describe potential regressions (e.g., span names mismatching dashboards).
- Note how to feature-flag or revert quickly if needed.

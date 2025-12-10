# CI Regression Automation Plan

Goal: ensure every PR touching hydration/schedules instrumentation runs a consistent regression subset without manual reminders.

## 1. Workflow Overview

Create `.github/workflows/regression.yml` with:

- **Triggers**: `pull_request` (for main branches) and `workflow_dispatch` (manual run) plus optional nightly cron.
- **Jobs**:
  1. `prepare`: checkout, setup Node (use `node-version: 20.x`), cache npm, run `npm ci`.
  2. `lint-typecheck`: depends on `prepare`; runs `npm run lint` and `npm run typecheck -- --pretty false`.
  3. `vitest-hydration`: runs `npx vitest run src/hydration/__tests__/routes.spec.ts src/hydration/__tests__/features.spec.ts`.
  4. `vitest-schedules`: runs `npx vitest run src/features/schedule/**/*.spec.ts` with `CI=1` to avoid watch mode.
  5. `vitest-meeting-dashboard`: matrix job covering meeting, dashboard, support plan suites.
  6. Optional `playwright`: gated behind dispatch input or label (parallel tests are expensive).

Each job should use `working-directory: .` and `env: { FORCE_COLOR: 1 }` for readable logs.

## 2. Example Job Snippet

```yaml
jobs:
  prepare:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci

  lint-typecheck:
    needs: prepare
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck -- --pretty false
```

To avoid duplicating install in every job, cache `node_modules` via `actions/cache` or move tests into a single job with multiple steps. Alternatively, use `pnpm` workspace caching if project migrates.

## 3. Mapping to Checklist

| Checklist section | CI job |
| --- | --- |
| 1. Workspace health | `lint-typecheck` |
| 2. Hydration & HUD tests | `vitest-hydration` |
| 3. Schedules | `vitest-schedules` |
| 4. Meeting Guide | `vitest-meeting-dashboard` (target `src/features/meeting/**/*.spec.ts`) |
| 5. Dashboard & IRC | same matrix job (additional command) |
| 6. Support Plan | included in matrix |
| 7. Core Navigation | add `npx vitest run src/__tests__/AppShell.test.ts src/__tests__/router.future-flags.smoke.test.ts` |
| 8. Optional E2E | `playwright` job triggered by label/dispatch |

## 4. Nightly Regression

Add cron trigger to run entire workflow daily at off-peak hours (`'0 18 * * *'` UTC). Store results in GitHub summary; optionally upload HUD screenshots or coverage artifacts.

## 5. Reporting

Use `actions/github-script` or workflow summary to print which checklist sections ran. Example snippet added at job end:

```bash
cat <<'EOF' >> $GITHUB_STEP_SUMMARY
## Regression Summary
- Hydration routes/features ✅
- Schedules suite ✅
- Meeting/Dashboard ✅
EOF
```

For failures, link to `docs/regression-checklist.md` so developers know the manual items to re-run locally.

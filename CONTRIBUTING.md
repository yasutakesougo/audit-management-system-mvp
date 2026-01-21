# Contributing

Thanks for taking the time to contribute! Please follow the guidelines below to help keep the project healthy.

## Preflight before PR

Run the full safety net locally before opening a Pull Request:

```bash
npm run preflight
```

The CI pipeline runs `npm run preflight:ci`, which covers type checking, linting, Users-focused unit tests, and the Users Playwright E2E suite. If a job fails, review the corresponding logs (and any generated Playwright trace/video artifacts), address the issue, and re-run the command locally before pushing new commits.

### Note: Test timeout during `npm run test:ci`

If a test legitimately takes longer than 10 seconds to clean up (e.g., heavy async fixtures), override the hook timeout:

```bash
HOOK_TIMEOUT=20000 npm run test:ci
```

## Local E2E testing (Schedules smoke suite)

For stable local E2E runs without TTY suspension issues, use this pattern:

```bash
# Clean up any existing port usage, start dev server (TTY-free), wait for ready, run E2E, cleanup
lsof -ti :5173 | xargs -r kill -9 && \
nohup npm run dev:5173 </dev/null > /tmp/vite-5173.log 2>&1 & \
sleep 1 && npx wait-on http://127.0.0.1:5173/ --timeout 60000 && \
curl -I http://127.0.0.1:5173/ 2>&1 | head -3 && \
BASE_URL=http://127.0.0.1:5173 npx playwright test tests/e2e/schedule-day.aria.smoke.spec.ts --project=chromium --reporter=line && \
lsof -ti :5173 | xargs -r kill -9
```

**Why this approach:**
- **Avoid `npm run dev &` in terminal** (causes TTY suspension when stdin is not redirected)
- `nohup ... </dev/null` prevents TTY suspension (main cause of dev server hangs)
- `wait-on` confirms HTTP 200 before running tests
- `curl` validates connectivity before E2E
- `lsof -ti :5173 | xargs -r kill` cleans up only the dev server (not other Node processes)

**Troubleshooting:**
- If `wait-on` times out: check `/tmp/vite-5173.log` tail for startup errors
- If playwright times out: verify curl returns HTTP 200 first

- スケジュール週ビューを変更した場合: `npm run test:schedule-week`

## E2E Skip Reduction Strategy (Schedule Suite)

When improving Schedule E2E test coverage, classify skips into **categories**:

| Category | Pattern | Action |
|----------|---------|--------|
| **A** | Root existence, empty state | ✅ Fix by supporting empty state (make tests pass without data) |
| **B** | Data-dependent assertions | ✅ Add env guard (e.g., `E2E_HAS_SCHEDULE_DATA=1` to enable) |
| **C** | Environment-specific (feature flags, SharePoint, UI divergence) | 🤔 Decide: CI fixture vs. integration-only vs. keep skipped |

**Current Category C Inventory (20 skips):**
- **5 skips** in `popover.spec.ts` — Test scaffold placeholders (unimplemented)
- **14 true-fixed skips** — Environment dependencies (no data, feature unavailable, UI divergence in Preview mode)
- **2 SharePoint-only skips** — Require real persistence (fixtures don't save edits); candidate for integration env or `IS_FIXTURES` gate

**Decision framework for C:**
1. **Unimplemented tests** (e.g., popover) → Keep skipped until feature ready
2. **Data-dependent** (no events) → Add `E2E_HAS_SCHEDULE_DATA=1` guard (same as Category B)
3. **Preview UI divergence** (`IS_PREVIEW` guard) → Acceptable; only skip in preview mode
4. **SharePoint persistence** (`IS_FIXTURES` guard) → Acceptable; only skip in fixtures mode
5. **Feature flags unavailable** → Skip with clear reason; revisit when flag enabled

**When PRing skip reductions, explain:** "This skip is Category {A|B|C}, and here's why we can safely remove/gate it."

## Nurse medication layout updates

- When touching the nurse medication layout (`src/features/nurse/medication/MedicationRound.tsx`), refresh the visual baselines locally:

  ```bash
  VITE_SKIP_LOGIN=1 npx playwright test tests/e2e/nurse.med.visual.spec.ts --update-snapshots
  ```

- Commit the updated assets under `tests/e2e/__screenshots__/nurse.med.visual.spec.ts/`.
- The spec relies on `TESTIDS.NURSE_MEDS_GRID_SUMMARY` and `TESTIDS.NURSE_MEDS_GRID_CONTROLS`; keep these identifiers intact when editing the markup.
- Ensure the nurse workspace flags remain enabled by setting `VITE_FEATURE_NURSE=1` (CI uses the same env alongside `VITE_SKIP_LOGIN=1`).

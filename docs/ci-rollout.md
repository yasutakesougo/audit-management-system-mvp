# CI Rollout Playbook (E2E env-guard)

## Goal
Safely roll out env-guarded Playwright suites in CI without test-count mismatch or tenant variance flakiness.

## Phase 2 flags (Schedule)
- E2E_FEATURE_SCHEDULE_NAV="1"
- E2E_FEATURE_SCHEDULE_ACCEPTANCE="1"
- E2E_FEATURE_SCHEDULE_WEEK_MONTH_TAB="1"

## Test pattern (standard)
Replace inline `test.skip(true)` with:

1) Suite guard (execution control by env)
- `test.skip(!FLAG, 'Suite behind env flag')`

2) Tenant variance allowance (keep test flow)
- If an element truly does not exist in a tenant:
  - assert count=0 and early return (only in that branch)
- Otherwise:
  - continue normal expectations / navigation

## Rollout procedure (recommended / stable)
1) Add the env flag to all workflows:
   - .github/workflows/ci.yml
   - .github/workflows/ci-preflight.yml
   - .github/workflows/smoke.yml (typecheck + vitest jobs)
   - .github/workflows/test.yml (Quality Gates)

2) PR → all checks green → merge

3) Main stability check (quality job only)
- Confirm `Quality Gates` -> `quality` job is SUCCESS **twice consecutively** on main.
- Do not block on `canary` completion (it may run long due to LHCI).

## Known infra fix: Quality Gates dev server (port 5173)
To avoid `net::ERR_CONNECTION_REFUSED`:
- Free port 5173 (best-effort): lsof OR fuser fallback
- Start `npm run dev:5173` (strict port)
- wait-on `http://127.0.0.1:5173/`
- Optional: print Vite log head for debugging

## Handy commands (gh)
### Latest Quality Gates run id
`gh run list --branch main --workflow "Quality Gates" --limit 1 --json databaseId --jq '.[0].databaseId'`

### Check quality job only
`gh run view <RUN_ID> --json jobs --jq '.jobs[] | select(.name=="quality") | {name, status, conclusion}'`
## Phase 2 closure (2026-01-22)
- Phase 2 flags (NAV/ACCEPTANCE/WEEK_MONTH_TAB) rolled out to all workflows.
- Quality Gates dev server stability fix (5173 start + wait-on) merged.
- main natural trigger: Quality Gates / quality = SUCCESS (run: 21234106893).
- Phase 2 closed.
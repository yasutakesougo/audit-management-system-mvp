# E2E Deep schedule evidence — 2026-11-20

**Position:** Extra citeable run for the unpublished integrated record. Not a Deploy / #2612 judgment change.

| Item | Value |
| --- | --- |
| Run | [44658944409](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/44658944409) |
| Workflow | E2E Deep Tests (`schedule`) |
| HEAD | `9d0d519` (`main`) |
| Failure notice | 2026-11-20 11:28 JST |
| Run conclusion | failure |

## Lane outcomes (job-level)

Same 5 failed lanes as previous schedule (`44442412713`):

- FAIL: `implementation-hot`, `fixture-memory`, `app-a11y`, `sp-stub`, `general`
- PASS: Integration Scenarios, Union Audit, `transport-date-check`

## New fact (historical; superseded 2026-11-21)

At the time of this note, `transport-date-check` was **5 consecutive PASS**:

`43790676805` → `44001137183` → `44442412713` → `44474414438` → `44658944409`

**STALE as of run [44854380448](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/44854380448)** (`transport-date-check` FAIL on same `9d0d519`). See `docs/evidence/e2e-deep-schedule-2026-11-21/NOTE.md`.

## Explicit non-claims

- `:217` reproduction: **UNKNOWN** (job-level only; do not read general-lane FAIL as `:217` repro).
- Deploy: **HOLD**
- Impact on #2612 judgment: **none**

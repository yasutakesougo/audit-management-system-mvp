# E2E Deep schedule evidence — 2026-11-21

**Position:** Extra citeable run for the unpublished integrated record. Not a Deploy / #2612 judgment change.

| Item | Value |
| --- | --- |
| Run | [44854380448](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/44854380448) |
| Workflow | E2E Deep Tests (`schedule`) |
| HEAD | `9d0d519` (`main`) |
| Failure notice | 2026-11-21 11:36 JST |
| Run conclusion | failure |

## Lane outcomes (job-level)

- FAIL (6): `implementation-hot`, `fixture-memory`, `app-a11y`, `sp-stub`, `general`, **`transport-date-check` (3m17s)**
- PASS: Integration Scenarios, Union Audit

## New fact

Same `9d0d519`: yesterday `transport-date-check` **PASS** ([44658944409](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/44658944409)); today **FAIL**. The **5-consecutive-PASS streak ends here**. Bidirectional wobble reads stronger than a consecutive-PASS narrative. The “5 consecutive PASS” claim in PR #2614 / `docs/evidence/e2e-deep-schedule-2026-11-20/NOTE.md` is **stale as of this run**.

## Explicit non-claims

- `:217` reproduction: **UNKNOWN** (job-level only)
- Deploy: **HOLD**
- Impact on #2612 judgment: **none**

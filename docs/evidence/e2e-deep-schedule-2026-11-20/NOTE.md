# E2E Deep schedule evidence — 2026-11-20

**Position:** Extra citeable run for the unpublished integrated record. Not a Deploy / #2612 judgment change.

**格付け:** PARTIALLY REVIEWED（ジョブ単位のみ）

| Item | Value |
| --- | --- |
| Run | [44658944409](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/44658944409) |
| Workflow | E2E Deep Tests (`schedule`) |
| HEAD | `9d0d519` (`main`) |
| Failure notice | 2026-11-20 11:28 JST |
| Run conclusion | failure |

## Lane outcomes (job-level) — 44658944409

Same 5 failed lanes as previous schedule (`44442412713`):

- FAIL: `implementation-hot`, `fixture-memory`, `app-a11y`, `sp-stub`, `general`
- PASS: Integration Scenarios, Union Audit, `transport-date-check`

## transport-date-check 経過（現在形の「5連続 PASS」主張は不可）

5連続 PASS（`43790676805` → `44001137183` → `44442412713` → `44474414438` → `44658944409`）の後、[44854380448](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/44854380448) で FAIL。同一 commit `9d0d519` で両方向の結果が観測されており、安定回帰より揺れの読みが強まった。

詳細は `docs/evidence/e2e-deep-schedule-2026-11-21/NOTE.md` も参照。

## Follow-up run — 44854380448（追記 2026-11-21）

| Item | Value |
| --- | --- |
| Run | [44854380448](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/44854380448) |
| Workflow | E2E Deep Tests (`schedule`) |
| HEAD | `9d0d519` (`main`) |
| Failure notice | 2026-11-21 11:36 JST |
| Run conclusion | failure |
| 格付け | PARTIALLY REVIEWED（ジョブ単位のみ） |

### Lane outcomes (job-level)

- FAIL 6レーン: `implementation-hot`, `fixture-memory`, `app-a11y`, `sp-stub`, `general`, `transport-date-check`（3m17s）
- PASS: Integration Scenarios、Deep Lane Union Audit

**未投稿の統合記録への位置づけ:** 引用する run が1本増えた（判断変更なし）。

## Explicit non-claims

- `:217` reproduction: **UNKNOWN** (job-level only; do not read general-lane FAIL as `:217` repro).
- Deploy: **HOLD**
- Impact on #2612 judgment: **none**

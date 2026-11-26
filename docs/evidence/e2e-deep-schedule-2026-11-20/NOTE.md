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

## transport-date-check 経過（現在形の「5連続 PASS」「2回連続 FAIL」主張は不可）

5連続 PASS（`43790676805` → `44001137183` → `44442412713` → `44474414438` → `44658944409`）の後、[44854380448](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/44854380448) で FAIL。[44974887699](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/44974887699) でも FAIL（3m54s）し2回連続 FAIL。[45098800410](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/45098800410) では PASS（4m18s）に反転。[45310529346](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/45310529346) でも PASS（3m28s）し2回連続 PASS。[45531144993](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/45531144993) でも PASS（4m54s）し3回連続 PASS。[45740696981](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/45740696981) でも PASS（4m06s）し、4回連続 PASS。同一 commit `9d0d519` で PASS と FAIL の両方向がそれぞれ連続して観測されているため、安定した回帰とも解消とも断定せず、揺れの読みを維持する。

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

## Follow-up run — 44974887699（追記 2026-11-22）

| Item | Value |
| --- | --- |
| Run | [44974887699](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/44974887699) |
| Workflow | E2E Deep Tests (`schedule`) |
| HEAD | `9d0d519` (`main`) |
| Failure notice | 2026-11-22 11:36 JST |
| Run conclusion | failure |
| 格付け | PARTIALLY REVIEWED（ジョブ単位のみ） |

### Lane outcomes (job-level)

- FAIL 6レーン: `general`（22m50s）、`implementation-hot`（16m12s）、`fixture-memory`（9m29s）、`app-a11y`（9m01s）、`sp-stub`（5m48s）、`transport-date-check`（3m54s）
- PASS: Integration Scenarios、Deep Lane Union Audit、Select deep lanes

**未投稿の統合記録への位置づけ:** 引用する run が1本増えた（判断変更なし）。

## Follow-up run — 45098800410（追記 2026-11-24）

| Item | Value |
| --- | --- |
| Run | [45098800410](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/45098800410) |
| Workflow | E2E Deep Tests (`schedule`) |
| HEAD | `9d0d519` (`main`) |
| Failure notice | 2026-11-23 11:30 JST |
| Run conclusion | failure |
| 格付け | PARTIALLY REVIEWED（ジョブ単位のみ） |

### Lane outcomes (job-level)

- FAIL 5レーン: `general`（11m24s）、`implementation-hot`（15m52s）、`fixture-memory`（8m22s）、`app-a11y`（8m14s）、`sp-stub`（7m30s）
- PASS: Integration Scenarios（3m52s）、Select deep lanes、`transport-date-check`（4m18s）、Deep Lane Union Audit（1m51s）

**未投稿の統合記録への位置づけ:** 引用する run が1本増えた（判断変更なし）。

## Follow-up run — 45310529346（追記 2026-11-24）

| Item | Value |
| --- | --- |
| Run | [45310529346](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/45310529346) |
| Workflow | E2E Deep Tests (`schedule`) |
| HEAD | `9d0d519` (`main`) |
| Failure notice | 2026-11-24 11:31 JST |
| Run conclusion | failure |
| 格付け | PARTIALLY REVIEWED（ジョブ単位のみ） |

### Lane outcomes (job-level)

- FAIL 5レーン: `general`（10m43s）、`implementation-hot`（17m09s）、`fixture-memory`（8m36s）、`app-a11y`（7m41s）、`sp-stub`（7m33s）
- PASS: Integration Scenarios（4m42s）、Select deep lanes、`transport-date-check`（3m28s）、Deep Lane Union Audit（1m59s）

**未投稿の統合記録への位置づけ:** 引用する run が1本増えた（判断変更なし）。

## Follow-up run — 45531144993（追記 2026-11-25）

| Item | Value |
| --- | --- |
| Run | [45531144993](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/45531144993) |
| Workflow | E2E Deep Tests (`schedule`) |
| HEAD | `9d0d519` (`main`) |
| Failure notice | 2026-11-25 11:30 JST |
| Run conclusion | failure |
| 格付け | PARTIALLY REVIEWED（ジョブ単位のみ） |

### Lane outcomes (job-level)

- FAIL 5レーン: `general`（11m48s）、`implementation-hot`（16m58s）、`fixture-memory`（9m03s）、`app-a11y`（9m02s）、`sp-stub`（7m28s）
- PASS: Select deep lanes（4s）、Integration Scenarios（3m05s）、`transport-date-check`（4m54s）、Deep Lane Union Audit（1m20s）

**未投稿の統合記録への位置づけ:** 引用する run が1本増えた（判断変更なし）。

## Follow-up run — 45740696981（追記 2026-11-26）

| Item | Value |
| --- | --- |
| Run | [45740696981](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/45740696981) |
| Workflow | E2E Deep Tests (`schedule`) |
| HEAD | `9d0d519` (`main`) |
| Failure notice | 2026-11-26 11:29 JST |
| Run conclusion | failure |
| 格付け | PARTIALLY REVIEWED（ジョブ単位のみ） |

### Lane outcomes (job-level)

- FAIL 5レーン: `general`（13m43s）、`implementation-hot`（16m17s）、`fixture-memory`（10m08s）、`app-a11y`（8m10s）、`sp-stub`（5m48s）
- PASS: `transport-date-check`（4m06s）、Integration Scenarios（3m24s）、Select deep lanes、Deep Lane Union Audit（1m24s）

**未投稿の統合記録への位置づけ:** 引用する run が1本増えた（判断変更なし）。

## Explicit non-claims

- `:217` reproduction: **UNKNOWN** (job-level only; do not read general-lane FAIL as `:217` repro).
- Deploy: **HOLD**
- Impact on #2612 judgment: **none**

# LIVE-SCHEMA-DATA-REMEDIATION-V1 — Optimized Process (Phase 0–10)

```text
LIVE-SCHEMA-DATA-REMEDIATION-V1
Correction-2:
Evidence Collection Process Lock
Correction-3:
Baseline ↔ Evidence identity binding
Facts:
!= Authority
CASE_*_CANDIDATE:
!= Authorized Case
CASE_A_CANDIDATE:
!= DELETE
Item Mutation:
NOT AUTHORIZED until Phase 4 Human GO
Schema Apply:
NOT AUTHORIZED until Phase 8 Human GO
Deploy:
NOT AUTHORIZED
```

This process separates **evidence**, **mechanical candidates**, **human disposition**, **authorized mutation**, and **schema apply**.  
It does **not** replace the locked Definition ([DEFINITION.md](./DEFINITION.md) + Correction-1). Correction-2/3 are **additive**.

## Critical path

```text
Phase 0   Baseline Fix
Phase 1   GET-only Evidence Collection (one-shot)
          Primary: Operator signed-in browser → captures/
          Fallback: Cloud Agent signed-in GET (only if operator unavailable)
Phase 2   Mechanical Candidate Classification
Phase 3   Independent Evidence Review (+ PHASE3_EXIT mechanical gate)
Phase 4   Human Disposition GO / HOLD (per TD+action)
          ├─ Case A/B → Data Remediation Lane
          └─ Case C   → Schema Contract Re-evaluation Lane
Phase 5   Authorized Mutation (small batches; Human GO only)
Phase 6   Post-Mutation GET-only Verification
Phase 7   Mutation Preflight Re-run (once)
Phase 8   Schema Apply Human GO / HOLD
Phase 9   Schema Apply
Phase 10  Post-Apply Verification → LIVE-SCHEMA-GATE-V1 Closure
```

### Operator / Agent / Human handoff

```text
Operator: signed-in GET-only → raw JSON → captures/ → capture identity fixed
Agent:    ingest → classify → Evidence/Decision Pack regen → Phase 3 exit判定
Human:    Phase 3 PASS確認 → Phase 4 TD+action単位 GO / HOLD
```

## Hard rules

| Rule | Meaning |
|---|---|
| Facts ≠ authority | Evidence Pack / Candidate ≠ Human GO |
| Case C off remediation | Never delete/merge Case C to coerce Unique |
| Preflight once | Do **not** re-run Mutation Preflight per TD; once after authorized remediation |
| Schema Apply separate | Remediation GO must not auto-chain to Schema Apply |
| Open PRs parallel | `#2551` / `#2552` / `#2541` are maintenance lanes — not this critical path |
| Review gate | Re-review only on evidence gap, identity mismatch, or classification conflict |

## Phase 0 — Baseline Fix

Pin and re-check only:

- repository / branch / HEAD / `origin/main`
- target list identity (`SupportRecord_Daily`, `DailyRecordRows`, `listId` when known)
- schema identity (do not invent columns)

Artifact: [BASELINE.json](./BASELINE.json)

If HEAD or list identity drifts vs baseline → **HOLD** (do not reuse stale Evidence).

### Correction-3 — mechanical bind (required)

Classifier **must** load `BASELINE.json` and require Evidence dump `baselineHead`:

| Check | Pass | Fail |
|---|---|---|
| `baseline.head` === `dump.baselineHead` (exact) | PASS | HOLD (`BASELINE_HEAD_MISMATCH` / `EVIDENCE_BASELINE_IDENTITY_NOT_MECHANICALLY_BOUND`) |
| Baseline `listId` null + dump has listId | `CAPTURED` → bind into BASELINE | — |
| Baseline `listId` set + dump matches | PASS | — |
| Baseline `listId` set + dump differs/missing | — | HOLD (`BASELINE_LIST_ID_MISMATCH`) |

Evidence Pack must retain:

```text
baselineVerification:
  expectedHead
  observedHead
  result
  listIdentityResult
  lists
```

Mismatch → classify `definition=HOLD` and CLI `exit != 0`. Stale Evidence reuse is **PROHIBITED**.

## Phase 1 — One-shot GET-only Evidence Collection

Collect all fields needed for Human Decision in **one** signed-in browser GET pass.  
Observe only — do not classify as final Case and do not mutate.

Per item (minimum):

- TD ID (stable via frozen parent ID sets)
- Item ID, Title (raw dump only; redacted in committed pack)
- Lifecycle / active state (or `UNKNOWN` if not in schema)
- Business key (Title + RecordDate + UserId presence)
- Relevant business / schema fields
- `contentSignificance: { value, basis, evidence }`
- Created / Modified / Author / Editor (presence + redacted)
- Deletion / archival indicators (`NOT_PROBED` if not safely GET-able)

Artifact: [EVIDENCE_PACK.json](./EVIDENCE_PACK.json)  
Transport: Browser REST **GET-ONLY**. Raw dump gitignored under `captures/`.

## Phase 2 — Mechanical Candidate Classification

| Candidate | Mechanical meaning |
|---|---|
| `CASE_A_CANDIDATE` | Verified empty / insignificant + identity not DIFFERENT + zero children |
| `CASE_B_CANDIDATE` | Children and/or significant content |
| `CASE_C_CANDIDATE` | RecordDate or UserId DIFFERENT → schema lane |
| `AMBIGUOUS` | Evidence gap or conflict |

```text
CASE_*_CANDIDATE != authorized Case
CASE_A_CANDIDATE != DELETE
```

Artifacts: [CANDIDATE_CLASSIFICATION.json](./CANDIDATE_CLASSIFICATION.json), [DECISION_PACK.json](./DECISION_PACK.json), [DECISION_PACK.md](./DECISION_PACK.md)

## Phase 3 — Independent Evidence Review

Review the Decision Pack table once. Re-open GET only if evidence quality fails.

Mechanical exit gate ([PHASE3_EXIT.json](./PHASE3_EXIT.json)) — all must PASS:

| Check | Requirement |
|---|---|
| baselineHead fixed | exact match to BASELINE |
| listIds captured | both lists CAPTURED/PASS |
| TD-001…008 complete | frozen register present |
| contentSignificance | value ∈ TRUE/FALSE/UNKNOWN + basis + evidence |
| classification traceable | candidate + lane + holdReasons |
| Case C separated | schema lane; not data-remediation eligible |
| unresolved ambiguity | count === 0 |
| source capture identity fixed | live capture (not rehydrate HOLD) |

Pack existence alone is **not** Phase 3 PASS.

## Phase 4 — Human Disposition

Per-TD+action GO/HOLD (never one bulk GO for all eight).  
Recommended dispositions and `DELETE GO` / `MERGE GO` labels are **form only** — not authority (`mutationAuthorityStatus=NOT_AUTHORIZED` until Human grants).

Allowed actions:

```text
PRESERVE | DELETE GO | MERGE GO | SCHEMA RE-EVALUATION | HOLD
```

Case C rows may only use `SCHEMA RE-EVALUATION` | `HOLD`.

Decision Pack row fields: TD ID · Observed Item IDs · Candidate Classification · contentSignificance · Evidence refs · Recommended disposition · Requested human action · Expected post-state · Mutation authority status · Reviewer decision · Decision rationale.

Lane split:

```text
TD-001...008
      ↓
 ┌───────────────┬──────────────────┐
 │ Case A / B    │ Case C           │
 │ Data          │ Schema Contract  │
 │ Remediation   │ Re-evaluation    │
 └───────────────┴──────────────────┘
```

## Phases 5–7 — Mutation (future)

- Fix **Target / Action / Expected post-state / Rollback / Evidence** per GO
- Small batches: Case A first, then Case B with explicit change GO; Case C = no item mutation
- Immediate GET-only verify per batch
- Mutation Preflight **once** when remediation + Case C policy are settled → expect `READY`  
  `READY != Schema Apply GO`

## Phases 8–10 — Schema Apply (future)

Separate Human Gate → Apply → Post-Apply GET → Gate closure.

## Current position

```text
#2557 MERGED / LOCKED
★ Phase 0–2 tooling + Phase 3 Exit Checker + Decision Pack TD+action schema READY
Live capture: HOLD (operator dump ABSENT under captures/)
Evidence regenerate from live: BLOCKED (do not invent listIds / significance)
Phase 3 Exit (rehydrate): HOLD
STOP before Phase 4 Human Disposition GO
```

## Tooling

- `scripts/ops/live-schema-data-remediation-investigate.browser.js`
- `scripts/ops/live-schema-data-remediation-classify.mjs`
- `scripts/ops/live-schema-data-remediation/classify.mjs`

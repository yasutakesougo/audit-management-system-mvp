# LIVE-SCHEMA-DATA-REMEDIATION-V1

Resolve `SupportRecord_Daily.Title` duplicate groups that hold LIVE-SCHEMA-MUTATION-V1 preflight.  
**Definition / investigation is not data mutation.**

Full critical path: [`docs/evidence/live-schema-data-remediation-v1/PROCESS.md`](../evidence/live-schema-data-remediation-v1/PROCESS.md) (Phase 0–10).

## Phases (summary)

| Phase | Purpose | SharePoint item writes |
|---|---|---|
| **0 Baseline** | Pin HEAD / lists / authority | **NONE** |
| **1 Evidence** | One-shot GET-only Evidence Pack | **NONE** |
| **2 Candidates** | Mechanical `CASE_*_CANDIDATE` / `AMBIGUOUS` | **NONE** |
| **3 Review** | Independent Evidence Review | **NONE** |
| **4 Human Disposition** | Per-group GO/HOLD; Case C → schema lane | Allowed **only after GO** (A/B) |
| **5–6 Mutation + verify** | Small-batch authorized fixes + GET verify | GO only |
| **7 Preflight** | Mutation Preflight **once** | GET-only |
| **8–10 Schema Apply** | Separate Human GO → Apply → verify | Schema only after Phase 8 |

```text
CASE_*_CANDIDATE != authorized Case
CASE_A_CANDIDATE != DELETE
Facts != Authority
```

## Investigation (GET-ONLY) — Phase 1

Preferred: signed-in browser on `/sites/welfare`.

```text
1. Confirm BASELINE (repo HEAD, site, list titles)
2. Paste scripts/ops/live-schema-data-remediation-investigate.browser.js
3. Save JSON locally (gitignored captures/)
4. Classify → Evidence Pack + Candidates + Decision Pack:
```

```bash
node scripts/ops/live-schema-data-remediation-classify.mjs \
  --input path/to/investigation-raw.json \
  --out docs/evidence/live-schema-data-remediation-v1/DEFINITION_INVESTIGATION.json \
  --evidence-pack docs/evidence/live-schema-data-remediation-v1/EVIDENCE_PACK.json \
  --candidates docs/evidence/live-schema-data-remediation-v1/CANDIDATE_CLASSIFICATION.json \
  --decision-pack docs/evidence/live-schema-data-remediation-v1/DECISION_PACK.md \
  --decision-pack-json docs/evidence/live-schema-data-remediation-v1/DECISION_PACK.json \
  --phase3-exit docs/evidence/live-schema-data-remediation-v1/PHASE3_EXIT.json
```

Primary capture path: **Operator** signed-in browser on `/sites/welfare` → raw JSON under `captures/`.  
Cloud Agent login is **fallback only**.

One-shot fields include structured:

```text
contentSignificance:
  value: TRUE | FALSE | UNKNOWN
  basis: [...]
  evidence: { item observations — no large payloads }
```

## Safety

```text
Duplicate != disposable
Oldest/Newest != canonical
No children != safe to delete
Same Title != same logical record
Automatic winner selection: PROHIBITED
Case C: SCHEMA CONTRACT REASSESSMENT — not delete/merge
```

## Cases (Human-authorized only)

- **A** Verified empty accidental duplicate (content-significance proof required — **P1-1**) → manual removal *candidate* after Human GO  
- **B** Meaningful / children on multiple parents / unverified content → human decision; child work = separate Gate  
- **C** Distinct logical parents sharing Title → **SCHEMA CONTRACT REASSESSMENT** (**P2-1**); do **not** delete/merge to coerce Unique  

Mechanical labels before Human GO are `CASE_A_CANDIDATE` / `CASE_B_CANDIDATE` / `CASE_C_CANDIDATE` / `AMBIGUOUS` only.

## Correction-1 (locked)

```text
LIVE-SCHEMA-DATA-REMEDIATION-V1
Definition Correction-1

P1-1 Case A content significance evidence
P1-2 child evidence strict fail-closed
P1-3 expected 8 groups strict baseline
P2-1 Case C routing clarification
```

## Correction-2 (Evidence Collection — additive)

```text
LIVE-SCHEMA-DATA-REMEDIATION-V1
Correction-2 Evidence Collection

P0 baseline identity pin
P1 one-shot evidence + structured contentSignificance
P2 mechanical candidates only
P3 decision pack (Human blank)
Lane split Case C off data remediation
No item / schema mutation
```

## Correction-3 (Baseline ↔ Evidence identity — additive)

```text
LIVE-SCHEMA-DATA-REMEDIATION-V1
Evidence Collection Correction-3
P1: EVIDENCE_BASELINE_IDENTITY_NOT_MECHANICALLY_BOUND

Required:
1. classifier loads BASELINE.json
2. Evidence dump.baselineHead required
3. baseline.head === evidence.baselineHead (exact)
4. mismatch / null → HOLD + exit != 0
5. captured listId binds into baseline identity
6. known listId mismatch → HOLD
7. Evidence Pack.baselineVerification retained
```

Browser dump must set `baselineHead` to the pinned BASELINE head (`acb5ec3f…`).  
Classify:

```bash
node scripts/ops/live-schema-data-remediation-classify.mjs \
  --input path/to/investigation-raw.json \
  --baseline docs/evidence/live-schema-data-remediation-v1/BASELINE.json \
  --out docs/evidence/live-schema-data-remediation-v1/DEFINITION_INVESTIGATION.json \
  --evidence-pack docs/evidence/live-schema-data-remediation-v1/EVIDENCE_PACK.json \
  --candidates docs/evidence/live-schema-data-remediation-v1/CANDIDATE_CLASSIFICATION.json \
  --decision-pack docs/evidence/live-schema-data-remediation-v1/DECISION_PACK.md
```

## After remediation (future)

```text
duplicateGroupCount = 0
nullOrBlankTitleCount = 0
itemRowsRead = ItemCount
→ LIVE-SCHEMA-MUTATION-V1 preflight READY (once)
→ schema Apply still needs separate Human GO
```

## Parallel maintenance (not this Gate)

Open PRs `#2551` / `#2552` / `#2541` stay on a separate lane. Do not block Schema work to merge them.

## Current position

```text
#2557 MERGED / LOCKED
★ Phase 0–2 + Correction-3 Evidence LOCKED
CI (4bfedfed): required/core/quality PASS · Deep known-failure MATCH
Live Capture: HOLD → see GET_ONLY_NEXT.md
STOP before Phase 4 Human Disposition GO
```

## Related

- CI reconciliation: `docs/evidence/live-schema-data-remediation-v1/CI_RECONCILIATION_4bfedfed.md`
- Correction-3 lock: `docs/evidence/live-schema-data-remediation-v1/CORRECTION_3_LOCK.md`
- GET-only next: `docs/evidence/live-schema-data-remediation-v1/GET_ONLY_NEXT.md`
- Mutation Definition: `docs/evidence/live-schema-mutation-v1/DEFINITION.md`
- Mutation preflight runbook: `docs/runbooks/live-schema-mutation-v1.md`
- ADR-025 parent Title uniqueness contract

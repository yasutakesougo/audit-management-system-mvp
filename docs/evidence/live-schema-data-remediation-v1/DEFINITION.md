# LIVE-SCHEMA-DATA-REMEDIATION-V1 — Definition

```text
LIVE-SCHEMA-DATA-REMEDIATION-V1
Phase:
Definition
Data Mutation Authority:
NOT YET AUTHORIZED
Schema Mutation Authority:
NOT AUTHORIZED
Deploy:
NOT AUTHORIZED
```

Define how to safely resolve the **8 Title duplicate groups** blocking LIVE-SCHEMA-MUTATION-V1 preflight (`TITLE_DUPLICATES`). This phase **investigates and classifies** only. It does **not** rewrite Titles, delete parents, reassign children, mutate schema, or deploy.

## Authority baseline

| Item | Status |
|---|---|
| Repository | `yasutakesougo/audit-management-system-mvp` |
| `main` | `e6dabf377961bcd7f8b61561dcbd86e5a57f7da4` |
| LIVE-SCHEMA-GATE-V1 | `VERIFIED_GAPS` |
| LIVE-SCHEMA-MUTATION-V1 Definition | **MERGED / LOCKED** |
| Mutation preflight | **HOLD** (`TITLE_DUPLICATES = 8`) |
| Schema mutation | **PROHIBITED** |
| Deploy | **NOT AUTHORIZED** |

Site: `https://isogokatudouhome.sharepoint.com/sites/welfare`  
Parent: `SupportRecord_Daily` · Child: `DailyRecordRows` (`ParentID`)

## Critical safety rules

```text
Duplicate != disposable
Oldest != canonical
Newest != canonical
No children != safe to delete
Same Title != same logical record
Automatic winner selection:
PROHIBITED
```

## Read-only investigation (executed)

Transport: Browser REST **GET-ONLY**.  
Raw dump: `captures/investigation-raw.json` (gitignored).  
Redacted machine report: [`DEFINITION_INVESTIGATION.json`](./DEFINITION_INVESTIGATION.json).

| Check | Result |
|---|---|
| Parent ItemCount / rowsRead | **359 / 359** (complete) |
| Child ItemCount / rowsRead | **3868 / 3868** (complete) |
| `duplicateGroupCount` | **8** |
| `duplicateItemCount` | **18** |
| Title null/blank | **0** |
| Child refs via `ParentID` | **COMPLETE** |
| Content-significance capture | **NOT CAPTURED** (pre–Correction-1 dump) |
| Data mutation | **NONE** |

## Correction-1

```text
LIVE-SCHEMA-DATA-REMEDIATION-V1
Definition Correction-1

P1-1 Case A content significance evidence
P1-2 child evidence strict fail-closed
P1-3 expected 8 groups strict baseline
P2-1 Case C routing clarification
```

| Fix | Rule |
|---|---|
| **P1-1** | `EMPTY_DUPLICATE_CANDIDATE` (Case A) requires **verified** content-significance evidence on **every** parent (`UserRowsJSON` / `UserCount` / `LatestVersion` booleans). `childCount=0` alone is insufficient. Missing evidence → `AMBIGUOUS` + `CONTENT_SIGNIFICANCE_UNVERIFIED`. |
| **P1-2** | Child-reference evidence **true-only fail-closed**: `childRefsSummary.ok === true`, `childRefsSummary.enumerationComplete === true`, ParentID resolved, `DailyRecordRows.enumerationComplete === true`. Truthy non-boolean fails. Any gap → `readCompleteness=HOLD`, `definition=HOLD`. |
| **P1-3** | Expected duplicate-group baseline is **exactly 8** in both `duplicateGroups` and **`titleStats.duplicateGroupCount`** (`titleStats` must be present). Count drift → `definition=HOLD`. |
| **P2-1** | Case C (`SCHEMA_CONTRACT_CONFLICT`) routes to **SCHEMA CONTRACT REASSESSMENT** — **not** data remediation delete/merge. `dataRemediationEligible=false`. |

## Group register (8 / 8) — Titles redacted

> **Note (Correction-1):** The executed investigation dump predates content-significance field capture. Case A groups (TD-001, TD-002, TD-007, TD-008) are **blocked** from Case A labeling until re-investigation with updated browser script.

### TD-001 — TEST_LIKE · size 3 · IDs `[7, 12, 15]`

| Field | Value |
|---|---|
| RecordDate | UNVERIFIED (all null) |
| UserId | UNVERIFIED (all null) |
| Children | 0 / 0 / 0 |
| Classification | **AMBIGUOUS** (Case A blocked — `CONTENT_SIGNIFICANCE_UNVERIFIED`) |
| Automatic remediation | **PROHIBITED** |
| Human decision | **YES** |

### TD-002 — TEST_LIKE · size 3 · IDs `[3, 4, 5]`

| Field | Value |
|---|---|
| RecordDate / UserId | UNVERIFIED / UNVERIFIED |
| Children | 0 / 0 / 0 |
| Classification | **AMBIGUOUS** (Case A blocked — `CONTENT_SIGNIFICANCE_UNVERIFIED`) |
| Human decision | **YES** |

### TD-003 — DATE(`2026-05-12`) · size 2 · IDs `[2060, 2063]`

| Field | Value |
|---|---|
| RecordDate | SAME |
| UserId | UNVERIFIED |
| Children | **38** / **16** |
| Classification | **ACTIVE_DUPLICATE** (Case B) |
| Notes | Children on **both** parents → no delete/merge without separate child Gate |
| Human decision | **YES** |

### TD-004 — DATE_LIKE · size 2 · IDs `[2084, 2085]`

| Field | Value |
|---|---|
| RecordDate | SAME |
| UserId | UNVERIFIED |
| Children | **14** / **1** |
| Classification | **ACTIVE_DUPLICATE** (Case B) |
| Human decision | **YES** |

### TD-005 — SHORT · size 2 · IDs `[21, 22]`

| Field | Value |
|---|---|
| RecordDate | **DIFFERENT** |
| UserId | UNVERIFIED |
| Children | 0 / 0 |
| Classification | **SCHEMA_CONTRACT_CONFLICT** (Case C) |
| Route | **SCHEMA CONTRACT REASSESSMENT** — not data remediation delete/merge |
| Human decision | **YES** |

### TD-006 — TEST_LIKE · size 2 · IDs `[6, 11]`

| Field | Value |
|---|---|
| RecordDate | **DIFFERENT** |
| Children | 0 / 0 |
| Classification | **SCHEMA_CONTRACT_CONFLICT** (Case C) |
| Route | **SCHEMA CONTRACT REASSESSMENT** |
| Human decision | **YES** |

### TD-007 — TEST_LIKE · size 2 · IDs `[13, 14]`

| Field | Value |
|---|---|
| Children | 0 / 0 |
| Classification | **AMBIGUOUS** (Case A blocked — `CONTENT_SIGNIFICANCE_UNVERIFIED`) |
| Human decision | **YES** |

### TD-008 — TEST_LIKE · size 2 · IDs `[1, 2]`

| Field | Value |
|---|---|
| RecordDate | SAME |
| Children | 0 / 0 |
| Classification | **AMBIGUOUS** (Case A blocked — `CONTENT_SIGNIFICANCE_UNVERIFIED`) |
| Human decision | **YES** |

## Remediation strategy (future Human GO only)

| Case | When | Future action (not now) |
|---|---|---|
| **A** | Verified empty accidental duplicate (no children; content-significance verified empty; identity consistent) | Manual removal **candidate** only after Human GO |
| **B** | Meaningful / multi-parent children / unverified content | **AUTO REPAIR PROHIBITED** — human data decision; child migration = separate Gate |
| **C** | Same Title, distinct logical parents | **SCHEMA CONTRACT REASSESSMENT** — do **not** coerce Unique via delete/merge |

## Fail-closed (no auto repair)

- Different logical parents share Title (TD-005, TD-006) → schema reassessment, not delete/merge  
- Child rows on multiple duplicate parents (TD-003, TD-004)  
- Partial paging / auth failure / missing child evidence (**P1-2**)  
- Case A without content-significance proof (**P1-1**)  
- Duplicate group count ≠ 8 (**P1-3**)  
- Any ambiguity about canonical record → **human decision**, never auto winner  

## Verification after future remediation

GET-only re-check required:

```text
SupportRecord_Daily enumeration complete
Title duplicateGroupCount = 0
Title nullOrBlankTitleCount = 0
itemRowsRead = ItemCount
contentSignificanceCapture.verified = true
```

Then re-run `LIVE-SCHEMA-MUTATION-V1` preflight → expect `preflightGate=READY`.  
READY still does **not** authorize schema Apply (separate Human GO).

## Prohibited in this Gate

POST/PUT/PATCH/MERGE/DELETE · item Set/Remove · Title rewrite · parent delete · child reassignment · merge · automatic canonical selection · schema mutation · deploy · runtime activation

## Acceptance (Definition)

| Criterion | Status |
|---|---|
| 8/8 groups accounted (**P1-3**) | **PASS** |
| All parent IDs identified | **PASS** |
| Child-reference status known (**P1-2**) | **PASS** |
| Content-significance evidence captured | **PENDING RE-INVESTIGATION** |
| No auto winner | **PASS** |
| Case C routed to schema reassessment (**P2-1**) | **PASS** |
| No item / schema mutation | **PASS** |
| Human decision point per group | **PASS** |
| Rollback/verification plan defined | **PASS** |

## Correction-2 (Evidence Collection — additive)

```text
LIVE-SCHEMA-DATA-REMEDIATION-V1
Correction-2 Evidence Collection
Phase scope: 0 Baseline · 1 Evidence · 2 Candidates
Locked Definition / Correction-1: unchanged
SharePoint mutation: NONE
```

See [PROCESS.md](./PROCESS.md), [BASELINE.json](./BASELINE.json), [CAPTURE_STATUS.md](./CAPTURE_STATUS.md),
[EVIDENCE_PACK.json](./EVIDENCE_PACK.json), [CANDIDATE_CLASSIFICATION.json](./CANDIDATE_CLASSIFICATION.json),
[DECISION_PACK.md](./DECISION_PACK.md).

Mechanical labels are `CASE_*_CANDIDATE` / `AMBIGUOUS` only. Human Disposition (Phase 4) is still required.
Case C stays on **SCHEMA_CONTRACT_REASSESSMENT** — never data remediation delete/merge.

## Correction-3 (Baseline ↔ Evidence identity — additive)

```text
LIVE-SCHEMA-DATA-REMEDIATION-V1
Evidence Collection Correction-3
P1: EVIDENCE_BASELINE_IDENTITY_NOT_MECHANICALLY_BOUND
```

| Rule | Behavior |
|---|---|
| Classifier loads `BASELINE.json` | Required |
| `dump.baselineHead` required | null → HOLD |
| `baseline.head` === `dump.baselineHead` | exact match or HOLD |
| listId first capture | `CAPTURED` → bind into BASELINE |
| known listId mismatch | HOLD |
| Evidence Pack | retains `baselineVerification` |
| CLI | mismatch → `exit != 0` |

Stale Evidence reuse across HEAD / list identity drift is **PROHIBITED**.

## Next (post-merge — no mutation in this Gate)

This Definition PR **does not authorize** SharePoint item writes, schema mutation, or deploy.

Optimized path (Correction-2):

| Step | Gate / action | Notes |
|---|---|---|
| 0–2 | **Evidence Pack + Candidates** | Tooling landed; live browser GET may still be HOLD — see CAPTURE_STATUS.md |
| 3 | **Independent Evidence Review** | One Decision Pack; re-GET only on evidence gaps |
| 4 | **Human Disposition GO/HOLD** | Per row — never bulk GO. Case C → schema lane |
| 5–6 | **Authorized small-batch mutation + GET verify** | Target/Action/Expected/Rollback fixed per GO |
| 7 | **Mutation Preflight once** | Expect READY — still not Schema Apply |
| 8–10 | **Schema Apply Human GO → Apply → verify** | Separate Gate |

**Out of scope until Phase 4 Human GO:** Title rewrite · parent delete · child reassignment · schema mutation · deploy.

Tooling: `scripts/ops/live-schema-data-remediation-investigate.browser.js` · `scripts/ops/live-schema-data-remediation-classify.mjs`  
Runbook: [`docs/runbooks/live-schema-data-remediation-v1.md`](../../runbooks/live-schema-data-remediation-v1.md)

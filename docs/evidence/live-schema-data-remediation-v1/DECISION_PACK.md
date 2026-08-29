# LIVE-SCHEMA-DATA-REMEDIATION-V1 — Decision Pack

```text
Phase: 3 Independent Evidence Review → 4 Human Disposition
Bulk GO: PROHIBITED
Mutation authority: NOT_AUTHORIZED (DELETE GO / MERGE GO are form labels only)
CASE_*_CANDIDATE != authorized Case
CASE_A_CANDIDATE != DELETE
Phase3Exit: HOLD
```

Fill **Requested human action** + **TargetItemIds** + **Expected post-state** + **Rollback** + **Reviewer decision** per TD after Phase 3 PASS.
Allowed actions: `PRESERVE` | `DELETE GO` | `MERGE GO` | `SCHEMA RE-EVALUATION` | `HOLD`.
Case C rows may only use `SCHEMA RE-EVALUATION` or `HOLD` (never DELETE / PRESERVE-as-delete).

| TD | Observed Item IDs | Candidate | Significance | Recommended | Allowed actions | Requested action | TargetItemIds | Expected post-state | Rollback | Mutation authority | Reviewer decision | Rationale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| TD-001 | 7,12,15 | AMBIGUOUS | UNKNOWN | HOLD | HOLD | _blank_ | _blank_ | _blank_ | _blank_ | NOT_AUTHORIZED | _blank_ | _blank_ |
| TD-002 | 3,4,5 | AMBIGUOUS | UNKNOWN | HOLD | HOLD | _blank_ | _blank_ | _blank_ | _blank_ | NOT_AUTHORIZED | _blank_ | _blank_ |
| TD-003 | 2060,2063 | CASE_B_CANDIDATE | UNKNOWN | PRESERVE | PRESERVE / DELETE GO / MERGE GO / HOLD | _blank_ | _blank_ | _blank_ | _blank_ | NOT_AUTHORIZED | _blank_ | _blank_ |
| TD-004 | 2084,2085 | CASE_B_CANDIDATE | UNKNOWN | PRESERVE | PRESERVE / DELETE GO / MERGE GO / HOLD | _blank_ | _blank_ | _blank_ | _blank_ | NOT_AUTHORIZED | _blank_ | _blank_ |
| TD-005 | 21,22 | CASE_C_CANDIDATE | UNKNOWN | SCHEMA RE-EVALUATION | SCHEMA RE-EVALUATION / HOLD | _blank_ | _blank_ | _blank_ | _blank_ | NOT_AUTHORIZED | _blank_ | _blank_ |
| TD-006 | 6,11 | CASE_C_CANDIDATE | UNKNOWN | SCHEMA RE-EVALUATION | SCHEMA RE-EVALUATION / HOLD | _blank_ | _blank_ | _blank_ | _blank_ | NOT_AUTHORIZED | _blank_ | _blank_ |
| TD-007 | 13,14 | AMBIGUOUS | UNKNOWN | HOLD | HOLD | _blank_ | _blank_ | _blank_ | _blank_ | NOT_AUTHORIZED | _blank_ | _blank_ |
| TD-008 | 1,2 | AMBIGUOUS | UNKNOWN | HOLD | HOLD | _blank_ | _blank_ | _blank_ | _blank_ | NOT_AUTHORIZED | _blank_ | _blank_ |

## Lane split

- **DATA_REMEDIATION** (A/B after Human Case authorization): TD+action GO only
- **SCHEMA_CONTRACT_REASSESSMENT** (C): `SCHEMA RE-EVALUATION` / `HOLD` only — no delete/merge
- **HOLD_REVIEW**: evidence gap — do not mutate

## Phase 4 action semantics (form only)

```text
PRESERVE              — keep item(s); no delete
DELETE GO             — authorize delete of named TargetItemIds only (not yet granted)
MERGE GO              — authorize merge of named targets only (not yet granted)
SCHEMA RE-EVALUATION  — Case C lane; never delete/merge to coerce Unique
HOLD                  — no action
```

## Counts

```json
{
  "CASE_A_CANDIDATE": 0,
  "CASE_B_CANDIDATE": 2,
  "CASE_C_CANDIDATE": 2,
  "AMBIGUOUS": 4
}
```

## Phase 3 Exit

```json
{
  "result": "HOLD",
  "unresolvedAmbiguityCount": 4,
  "checks": {
    "baselineHeadFixed": {
      "result": "PASS",
      "detail": "baselineHead bound: acb5ec3f97f7a1d7ee27c3ba0cf0a61f92894ee6"
    },
    "listIdsCaptured": {
      "result": "HOLD",
      "detail": "list identity incomplete: [\"PENDING_CAPTURE\",\"PENDING_CAPTURE\"]"
    },
    "tdRegisterComplete": {
      "result": "PASS",
      "detail": "TD-001...008 all present"
    },
    "contentSignificanceComplete": {
      "result": "PASS",
      "detail": "all parents have value∈{TRUE,FALSE,UNKNOWN} with basis+evidence; Case A not UNKNOWN (unless schema-absent)"
    },
    "classificationTraceable": {
      "result": "PASS",
      "detail": "each TD has candidate+lane+holdReasons"
    },
    "caseCSeparated": {
      "result": "PASS",
      "detail": "all CASE_C_CANDIDATE on SCHEMA_CONTRACT_REASSESSMENT with dataRemediationEligible=false"
    },
    "unresolvedAmbiguity": {
      "result": "HOLD",
      "detail": "unresolvedAmbiguityCount=4"
    },
    "sourceCaptureIdentityFixed": {
      "result": "HOLD",
      "detail": "source capture not fixed (mode=rehydrate-from-definition-investigation, liveCaptureStatus=HOLD) — operator signed-in GET required"
    }
  }
}
```


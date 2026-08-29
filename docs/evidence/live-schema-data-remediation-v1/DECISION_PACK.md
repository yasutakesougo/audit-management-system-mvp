# LIVE-SCHEMA-DATA-REMEDIATION-V1 — Decision Pack

```text
Phase: 3 Independent Evidence Review → 4 Human Disposition
Authority: PENDING (blank until Human fills GO/HOLD per row)
Bulk GO for all 8: PROHIBITED
CASE_*_CANDIDATE != authorized Case
CASE_A_CANDIDATE != DELETE
```

Mechanical candidates only. Fill **Human Decision** per row after Evidence Review.

| TD | Candidate | Significance | State | Suggested disposition | Lane | Human Decision |
|---|---|---|---|---|---|---|
| TD-001 | AMBIGUOUS | UNKNOWN | ambiguous | HOLD pending evidence / human review | HOLD_REVIEW | _GO / HOLD_ |
| TD-002 | AMBIGUOUS | UNKNOWN | ambiguous | HOLD pending evidence / human review | HOLD_REVIEW | _GO / HOLD_ |
| TD-003 | CASE_B_CANDIDATE | UNKNOWN | active/meaningful | preserve / human data decision (child Gate if needed) | DATA_REMEDIATION | _GO / HOLD_ |
| TD-004 | CASE_B_CANDIDATE | UNKNOWN | active/meaningful | preserve / human data decision (child Gate if needed) | DATA_REMEDIATION | _GO / HOLD_ |
| TD-005 | CASE_C_CANDIDATE | UNKNOWN | contract conflict | schema contract re-evaluation (no delete/merge) | SCHEMA_CONTRACT_REASSESSMENT | _GO / HOLD_ |
| TD-006 | CASE_C_CANDIDATE | UNKNOWN | contract conflict | schema contract re-evaluation (no delete/merge) | SCHEMA_CONTRACT_REASSESSMENT | _GO / HOLD_ |
| TD-007 | AMBIGUOUS | UNKNOWN | ambiguous | HOLD pending evidence / human review | HOLD_REVIEW | _GO / HOLD_ |
| TD-008 | AMBIGUOUS | UNKNOWN | ambiguous | HOLD pending evidence / human review | HOLD_REVIEW | _GO / HOLD_ |

## Lane split

- **DATA_REMEDIATION** (A/B after Human Case authorization): small-batch mutation only with per-target GO
- **SCHEMA_CONTRACT_REASSESSMENT** (C): no delete/merge; schema contract track
- **HOLD_REVIEW**: evidence gap — do not mutate

## Authority (Phase 4 — not yet filled)

Per-row examples (do not treat as granted):

```text
TD-00N / Item … → Action … → Expected post-state … → Rollback … → Human GO
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


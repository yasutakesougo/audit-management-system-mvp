# LIVE-SCHEMA-DATA-REMEDIATION-V1

Resolve `SupportRecord_Daily.Title` duplicate groups that hold LIVE-SCHEMA-MUTATION-V1 preflight.  
**Definition / investigation is not data mutation.**

## Phases

| Phase | Purpose | SharePoint item writes |
|---|---|---|
| **Definition** | Identify 8 groups, classify, define Cases A/B/C | **NONE** |
| **Human Data Remediation GO** | Explicit authorize per-group fixes | Allowed **only after GO** |
| **Verify** | GET-only re-count → mutation preflight READY | GET-only |

## Investigation (GET-ONLY)

Preferred: signed-in browser on `/sites/welfare`.

```text
1. Paste scripts/ops/live-schema-data-remediation-investigate.browser.js
2. Save JSON locally (gitignored captures/)
3. Classify (redacted evidence):
```

```bash
node scripts/ops/live-schema-data-remediation-classify.mjs \
  --input path/to/investigation-raw.json \
  --out docs/evidence/live-schema-data-remediation-v1/DEFINITION_INVESTIGATION.json
```

## Safety

```text
Duplicate != disposable
Oldest/Newest != canonical
No children != safe to delete
Same Title != same logical record
Automatic winner selection: PROHIBITED
```

## Cases

- **A** Empty accidental duplicate → manual removal *candidate* after Human GO  
- **B** Meaningful / children on multiple parents → human decision; child work = separate Gate  
- **C** Distinct logical parents sharing Title → schema contract reassessment; do not coerce Unique  

## After remediation (future)

```text
duplicateGroupCount = 0
nullOrBlankTitleCount = 0
itemRowsRead = ItemCount
→ LIVE-SCHEMA-MUTATION-V1 preflight READY
→ schema Apply still needs separate Human GO
```

## Related

- Mutation Definition: `docs/evidence/live-schema-mutation-v1/DEFINITION.md`
- Mutation preflight runbook: `docs/runbooks/live-schema-mutation-v1.md`
- ADR-025 parent Title uniqueness contract

# ADR-021: Soft-Delete Column Governance (DeletedAt / DeletedBy / IsDeleted)

## Status

**Accepted** — 2026-04-26

## Context

During Zombie Column Purge Batch 5-B analysis, the fields `DeletedAt`, `DeletedBy`, and `IsDeleted`
were identified across **8 SharePoint lists** with zero data and minimal code usage:

| List | DeletedAt | DeletedBy | IsDeleted | Code Usage |
|---|---|---|---|---|
| support_procedure_record_daily | ✓ | ✓ | ✓ | ❌ |
| support_record_daily | ✓ | ✓ | ✓ | ❌ |
| staff_master | ✓ | ✓ | ✓ | ❌ |
| staff_attendance | ✓ | ✓ | ✓ | ❌ |
| schedule_events | ✓ | ✓ | ✓ | ❌ |
| monitoring_meetings | ✓ | ✓ | ✓ | ❌ |
| meeting_minutes | (DeletedBy) | ✓ | ✓ | ❌ |
| call_logs | ✓ | ✓ | ✓ | ❌ |

The **only active code usage** is in `src/features/daily/repositories/sharepoint/constants.ts`,
where `IsDeleted` is mapped for the daily record list (logical delete support).

These columns were provisioned as forward-looking infrastructure for a logical deletion pattern,
but the pattern has not been operationalized in the application layer (no delete queries filter
on `IsDeleted`, no UI toggle exists).

## Decision

1. **Classify soft-delete columns as `provision`** (not `keep-warn` or purge targets).
2. **Rationale:** These columns represent legitimate infrastructure investment for a pattern
   that is standard in welfare management systems (audit trail requirements).
3. **Do NOT purge.** Removing and re-creating columns in SharePoint is expensive and risks
   breaking any Power Automate flows that may reference them.
4. **Do NOT add to `essentialFields`.** They are optional infrastructure, not business-critical.

## Governance Tag

Add `governance: 'provision'` to the `isSystemField()` or classify function to ensure these
fields are excluded from zombie candidate lists while remaining visible in infrastructure audits.

## Implementation

The `build-drift-ledger.mjs` classification logic already handles this correctly:
- If `usageCount > 0` → `candidate` (active code reference)
- If `hasData` → `provision` (data exists but no code usage)
- If neither → `keep-warn` (zombie candidate)

Since these columns currently have **no data and no usage**, they correctly fall into `keep-warn`.
To override this, we tag them explicitly in the system fields exclusion or via registry governance.

**Chosen approach:** Add these three field names to the `isSystemField()` function as a
well-known infrastructure pattern, so they are excluded from zombie analysis entirely.
This is the least-invasive approach that immediately reduces ledger noise.

## Consequences

- **Positive:** ~24 rows removed from keep-warn (3 fields × 8 lists)
- **Positive:** Future adoption of logical deletion requires zero schema changes
- **Negative:** Columns consume ~0.01% of SharePoint column budget (negligible)

## References

- Batch 5-B analysis: `docs/zombie-column-purge/batch5b_candidate_analysis.md`
- Drift Ledger: `docs/nightly-patrol/drift-ledger.md`
- ADR-015: SharePoint Infrastructure Hardening and Zombie Cleanup

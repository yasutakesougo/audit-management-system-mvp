# ADR-015: SharePoint Infrastructure Hardening and Zombie Column Cleanup

## Status
Accepted (2026-04-05)

## Context
The system was experiencing constant "Internal Server Error (500)" and "400 Bad Request" failures during SharePoint list provisioning and data access. Diagnostics revealed that several lists (Approval_Logs, User_Feature_Flags) were hitting the **8KB physical row size limit** and the **SharePoint Indexing Limit**.

The root cause was "Zombie Columns": multiple redundant versions of the same logical field created due to naming collisions and schema drift during automated provisioning.

### Key Discovery: Japanese Encoding Collisions
We discovered that SharePoint generates hidden InternalNames when using UCS-2 characters (Japanese) in column titles. 
- Example: "フラグキー" -> `_x30d5__x30e9__x30b0__x30ad__x30`
- If a collision occurs, SharePoint appends a number: `...x300`, `...x301`, etc.
- These names can be 32+ characters long, causing truncation and further collisions.
- Previous cleanup scripts targeting only English patterns (e.g., `ApprovedBy1`) failed to detect these 200+ hidden columns.

## Decision
We performed a surgical infrastructure cleanup and hardening phase:

1.  **Massive Zombie Removal**: Deleted **323 zombie columns** across four main lists using a refined detection script (`zombie-column-purger.mjs`).
2.  **Schema Refactoring**: Removed `ContentBlocksJson` from `MeetingMinutes` selection as it triggered 400 errors due to schema drift. Replaced it with the safe, multi-field reconstruction pattern already present in the repository layer.
3.  **Operational SOP (v2.3)**: Created [column-cleanup-checklist-v2.md](../ops/column-cleanup-checklist-v2.md) as a standard maintenance guide for monthly "Zombie Checkups".
4.  **Tool Promotion**: Moved the cleanup script to `scripts/ops/zombie-column-purger.mjs` for permanent reuse.

## Consequences
- **Zero Errors**: System stability restored; 500/400 errors on core features dropped to zero.
- **Provisioning Recovery**: `provision_failed` status cleared on core lists.
- **Operational OS Maturity**: The maintenance team now has the tools and knowledge to control SharePoint physical limits proactively.
- **Data Integrity**: Safe Reconstruction fallback pattern in MeetingMinutes ensures no data loss despite schema variations.

## References
- [column-cleanup-checklist-v2.md](../ops/column-cleanup-checklist-v2.md)
- [zombie-column-purger.mjs](../../scripts/ops/zombie-column-purger.mjs)

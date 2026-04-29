# MonthlyRecord_Summary Field Unification Audit (#1713)

## 1. Executive Summary
The `MonthlyRecord_Summary` list contains redundant physical fields marked as "zombie candidates" by automated patrol tools. However, a deep data profile reveals that some of these fields, specifically `Key`, hold critical historical data that is not yet present in the canonical registry-matched fields.

**Status: PURGE PROHIBITED** for `Key` and active usage candidates until migration is complete.

## 2. Data Profile (as of 2026-04-29)

| Logical Field | Physical Field (Candidates) | nonNullCount | hasData | Classification |
| :--- | :--- | :--- | :--- | :--- |
| **IdempotencyKey** | `Key` | **35** | true | **Zombie Candidate (Legacy SSOT)** |
| | `Idempotency_x0020_Key` | 1 | true | Registry Match (Canonical Target) |
| **KPI_TotalDays** | `KPI_TotalDays` | 4 | false | Zombie Candidate |
| | `TotalDays` | 1 | false | Registry Match (Canonical Target) |
| | `Total_x0020_Days` | 1 | false | Zombie Candidate |
| **KPI_CompletedRows** | `Completed_x0020_Rows` | 1 | false | Zombie Candidate |
| | `CompletedCount` | 0 | false | Registry Match (Canonical Target) |

## 3. Current Implementation Analysis
The system uses `resolveInternalNamesDetailed` with `BILLING_SUMMARY_CANDIDATES` in `src/features/records/monthly/map.ts`. 

- **Problem**: `BILLING_SUMMARY_CANDIDATES` does NOT include `Key`.
- **Result**: The patrol tool incorrectly identifies `Key` as a zombie because it is not in the allowed candidates list, despite being referenced in the code (35 hits).

## 4. Unification Strategy

### Phase A: Safety Gating (Immediate)
1.  **Add `Key` to `BILLING_SUMMARY_CANDIDATES`**: Temporarily include it in the `idempotencyKey` candidates list to stop the patrol tool from suggesting its deletion.
2.  **Explicit Mapping**: Ensure `resolveInternalNamesDetailed` picks the most "correct" field for writing while allowing legacy fields for reading.

### Phase B: Migration Plan
1.  **Read-Fallback/Write-Canonical**:
    -   **Read**: Try `Idempotency_x0020_Key` first, then `Key`.
    -   **Write**: Always write to `Idempotency_x0020_Key`.
2.  **Migration Script**: Create a script to copy data from `Key` to `Idempotency_x0020_Key` for the 35 identified records.
3.  **Validation**: Verify `nonNullCount` for `Key` becomes 0 after migration.

### Phase C: Purge
1.  Remove `Key` from the candidates list.
2.  Perform the physical purge only after `nonNullCount` is confirmed as 0.

## 5. Acceptance Criteria for Unification
- [ ] No data loss for existing 35 monthly summary records.
- [ ] Power Automate flows (if any) updated to use canonical internal names.
- [ ] Drift ledger shows `Key` as safe-to-purge (Usage: 0, nonNullCount: 0).
- [ ] `src/sharepoint/fields/billingFields.ts` updated to remove legacy candidates.

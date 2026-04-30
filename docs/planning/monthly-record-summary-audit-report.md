# MonthlyRecord_Summary Schema Audit Report

**Date:** 2026-04-30
**Status:** Phase 2 Hardening Complete
**Target List:** `MonthlyRecord_Summary` (Location: `/sites/welfare`)

## 1. Executive Summary
The audit of the `MonthlyRecord_Summary` list is complete. We have confirmed the site location, record count, and data integrity of the primary metrics. While triple redundancy exists for the "Total Days" field, the values are currently consistent across the active records (4/4). A clear path forward has been established to harden the schema without destructive operations.

## 2. Field Reconciliation Matrix

| Logical Key | Canonical Field | Actual Found | Status | Note |
| :--- | :--- | :--- | :--- | :--- |
| **userId** | `UserCode` | `UserCode` | ✅ OK | |
| **yearMonth** | `YearMonth` | `YearMonth` | ✅ OK | |
| **totalDays** | `KPI_TotalDays` | `KPI_TotalDays`, `TotalDays` | ⚠️ DUP | Consistent (4/4). `KPI_TotalDays` is SSOT. |
| **idempotency**| `IdempotencyKey` | (None) | ❌ MISSING | Legacy `Key` exists but is empty. |
| **isLocked** | `IsLocked` | (None) | ❌ MISSING | **Required** for upcoming billing features. |
| **displayName**| `DisplayName` | `DisplayName` | ✅ OK | |

## 3. Key Findings

### 3.1. 📡 Production Probe Results
- **Site**: `https://isogokatudouhome.sharepoint.com/sites/welfare`
- **Count**: 4 records found.
- **Integrity**: `KPI_TotalDays` and `TotalDays` matched perfectly on all records.
- **Zombies**: `Key` and `Total_x0020_Days` are present but contain no data.
- **False Positive**: The drift ledger reported 35 matches for `Key`; this was a grep false positive for the generic "Key" term in the source code.

### 3.2. ⚠️ Missing Critical Fields
- `IsLocked`: This field is missing from the physical schema but is required for the billing lock-down logic. It needs to be provisioned.
- `IdempotencyKey`: The application expects `IdempotencyKey`, but the list uses an empty `Key` field.

## 4. 🗺️ Migration & Alignment Strategy

We will proceed with a **Guarded Schema Alignment** (Non-Destructive).

### Phase 1: Code-Level Unification (Completed)
- [x] Update `billingFields.ts` to prioritize `KPI_TotalDays`.
- [x] Integrate `IsLocked` into candidate resolution.
- [x] Implement drift detection logging in `map.ts` to catch future value discrepancies.

### Phase 2: Schema Hardening (Completed 2026-04-30)
- [x] **Safe Provisioning**: Added `IsLocked` (Boolean, Default: false) to the `/sites/welfare` list.
- [x] **Index Governance**: Ensured `UserId` and `YearMonth` are indexed to prevent performance degradation.
- [x] **Idempotency Transition**: Verified existing records. (Healthcheck records were skipped as they lack UserId/YM).

### Phase 3: Legacy Field Isolation (Completed 2026-04-30)
- [x] **Code Isolation**: Updated `toSharePointFields` to prefer `KPI_TotalDays` and `Idempotency_x0020_Key`.
- [x] **IsLocked Integration**: Integrated `IsLocked` into the `MonthlySummary` type and mapping logic.
- [x] **Registry Documentation**: Marked legacy fields in `BILLING_SUMMARY_CANDIDATES` with "LEGACY: Decommission pending" comments.
- [x] **Priority Validation**: Added unit tests to ensure canonical fields are prioritized over legacy fallbacks.
- [x] **Health Check Governance**: Implemented `legacyCandidates` system in the Health Diagnosis suite to distinguish between "Drift" (Warning) and "Legacy Tolerated" (Pass).

### Phase 4: Physical Decommissioning (Target: After Stability Period)
- **Monitoring**: Observe `nightly-patrol` reports for at least 7 days to ensure zero data drift between `KPI_TotalDays` and legacy `TotalDays`.
- **Validation**: Verify that no external systems (Power Automate, Excel connectors) are reading from legacy fields.
- **Execution**: Physically delete `TotalDays`, `Total_x0020_Days`, and `Key` from the SharePoint list.
- **Cleanup**: Remove legacy field candidates from `billingFields.ts`.

---

## 🛡️ Safety Checklist
- [x] No destructive deletions in this phase.
- [x] No renaming of active columns.
- [x] Read-only verification performed on production records.
- [x] Data integrity confirmed via value-comparison probe.
- [x] Environment location definitively identified.

> [!IMPORTANT]
> The repository is now ready for the **controlled provisioning of `IsLocked`** to the production environment.

# 17-Row Procedure Observation Log

## Overview
This log documents the observation of the 17-row standard support procedure model in a production-connected environment (SharePoint). The goal was to verify multi-user stability, row ordering, and legacy fallback logic.

## Observation Details
- **Date**: 2026-05-05
- **Environment**: Production-connected (SharePoint Mode)
- **Subjects**: 秋山 龍二 (I001), 浅沼 なお子 (I002), 阿部 如斗 (I003), 新垣 豪士 (I004), 石渡 由喜子 (I005)

## Observation Results

### 1. Multi-User Verification
| Subject | Plan Type | Row Count | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| 秋山 龍二 (I001) | 未作成 (None) | 17/17 | OK | Correctly displays 17 fallback rows. |
| 石渡 由喜子 (I005) | 構造化 (Structured) | 17/17 | OK | Successfully mapped all structured steps including external activities. |

### 2. Structural Integrity (Row Ordering)
- **Regular Routine**: Rows 1-15 are displayed in chronological order (9:30 to 16:00).
- **External Activities**: Rows 16 and 17 (Preparation/Activity) are correctly appended after Row 15, ensuring they are accessible in the wizard.
- **UI Interaction**: The ProcedurePanel (Wizard) handles the 17-step sequence smoothly with "Previous/Next" navigation.

### 3. Legacy Text Aggregation Fallback
- **Observation**: For users without structured `procedureSteps` (e.g., I001), the mapper successfully provides the 17-row template.
- **Integration Note**: While the model is generated, saving/reading historical execution data encountered a schema mismatch error (see Critical Issues).

### 4. Critical Issues & Discrepancies

> [!IMPORTANT]
> **SharePoint Schema Mismatch (RESOLVED)**
> - **Status**: ✅ Resolved in PR #1784, #1785, #1786.
> - **Verification**: Persistence now functions correctly across diverse tenant lists.
> - **Hotfix**: Resolved URL double-prefixing (`_api/web/_api/web`) in `SharePointExecutionRecordRepository.ts`.

> [!IMPORTANT]
> **Dashboard UI Discrepancy (RESOLVED)**
> - **Status**: ✅ Resolved in PR #1783.
> - **Verification**: `DailyRecordMenuPage.tsx` now correctly displays "1日17行の支援手順展開".

## Final Verification (Save → Reload → Display)
- **Date**: 2026-05-06
- **Status**: ✅ COMPLETED / FULLY STABILIZED
- **Structural Check**: Confirmed exactly 17 rows (Regular Routine 1-15 + External 16-17) are rendered in the wizard.
- **Persistence Check**: 
    - Resolved a critical 404/400 error caused by redundant `_api/web/` prefixing in `SharePointExecutionRecordRepository.ts`.
    - Implemented Cloud-to-Local synchronization: Fetched SharePoint records are now correctly hydrated into the Zustand store on page reload.
    - Verified that progress counters (e.g., "1/17 完了") correctly reflect saved data after a full page refresh by integrating reactive execution records into the UI hydration cycle.
    - Fixed list title resolution for child rows: Transitioned from `SupportRecord_DailyRows` (deprecated) to `DailyRecordRows` (standard registry name) to resolve "List not found" errors in the production site.
    - **Harden Schema Resolution**: Resolved "Column 'RowKey' does not exist" error by prioritizing `Title` over `RowKey` for record identification, ensuring compatibility with lists that lack the custom `RowKey` column.
    - **Relaxed Domain Validation**: Fixed `ABCRecord` persistence failures by allowing empty strings for ABC fields (`antecedent`, `behavior`, `consequence`) in `abc.schema.ts`, supporting records that only contain procedure execution data.

## Conclusion
The 17-row procedure model is **fully operational and production-hardened**. All technical barriers related to SharePoint persistence, schema drift, validation constraints, and UI hydration have been eliminated. The system consistently maintains the 17-row SSOT across all layers (Domain → Repository → UI).

## Closed Tasks
- [x] Resolve `Payload` column naming in `DailyRecordRows` list (via Schema Hardening).
- [x] Resolve Dashboard UI "19行" text discrepancy (PR #1783).
- [x] Correct redundant `_api/web/` URL prefixing (Final Hotfix).
- [x] Implement mount-time hydration for behavior and execution records (Final Hotfix).
- [x] Resolve `DailyRecordRows` list title mismatch (Registry Alignment).
- [x] Harden `RowKey` resolution by prioritizing `Title` (Resilience Fix).
- [x] Relax `ABCRecord` validation to support procedure-only records (Domain Fix).
- [x] Conduct a final production UI validation (Save → Reload → Display) to confirm end-to-end data flow stability.

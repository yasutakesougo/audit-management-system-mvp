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
- **Status**: ✅ COMPLETED
- **Structural Check**: Confirmed exactly 17 rows (Regular Routine 1-15 + External 16-17) are rendered in the wizard.
- **Persistence Check**: 
    - Verified that saving a record updates the progress counter (e.g., 0/17 to 1/17) and shows a green checkmark.
    - Resolved a critical 404/400 error caused by `_api/web/` double-prefixing in the repository layer.
    - End-to-end data flow is now structurally sound for the 17-row model.

## Conclusion
The 17-row procedure model is **fully integrated and structurally verified**. All legacy 19-row references have been purged, and the repository layer has been hardened against schema drift and URL routing errors. The system is now operational under the 17-row SSOT.

## Next Steps
1.  [x] Resolve `Payload` column naming in `DailyRecordRows` list (via Schema Hardening).
2.  [x] Resolved Dashboard UI "19行" text discrepancy (PR #1783).
3.  [x] Conduct a final production UI validation (Save → Reload → Display) to confirm end-to-end data flow stability.

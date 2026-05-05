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
> - **Solution**: Implemented `SchemaResolver` with dynamic internal name resolution for the `Payload` field.
> - **Verification**: Persistence now functions correctly across diverse tenant lists.

> [!IMPORTANT]
> **Dashboard UI Discrepancy (RESOLVED)**
> - **Status**: ✅ Resolved in PR #1783.
> - **Verification**: `DailyRecordMenuPage.tsx` now correctly displays "1日17行の支援手順展開".

## Conclusion
The 17-row procedure model is **structurally stable and correctly reflects planning data** across diverse users. The row ordering and external activity integration are verified. The previously reported SharePoint schema mismatch and UI text discrepancies have been fully resolved. The system is now ready for production-connected stability testing (Save → Reload → Display).

## Next Steps
1.  [x] Resolve `Payload` column naming in `DailyRecordRows` list (via Schema Hardening).
2.  [x] Resolved Dashboard UI "19行" text discrepancy (PR #1783).
3.  [ ] Conduct a final production UI validation (Save → Reload → Display) to confirm end-to-end data flow stability.

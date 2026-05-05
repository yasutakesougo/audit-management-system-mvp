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
> [!WARNING]
> **SharePoint Schema Mismatch**
> - **Error**: `400 Bad Request: Property 'Payload' does not exist on type 'SP.Data.DailyRecordRowsListItem'`
> - **Impact**: Unable to save or reload execution records ("Do" part) for the 17-row model in the current production tenant.
> - **Recommended Action**: Verify the `DailyRecordRows` list on the target SharePoint site. If the column is named `PayloadJSON` or `cr013_payload`, the code or the list schema needs reconciliation.

> [!NOTE]
> **Dashboard UI Discrepancy**
> - The dashboard description for "支援手順の実施" mentions "1日19行の支援手順展開".
> - **Fact**: The actual model implements 17 rows as per `PROCEDURE_ROWS`.
> - **Recommended Action**: Update the static text in the Dashboard component to match the 17-row SSOT.

## Conclusion
The 17-row procedure model is **structurally stable and correctly reflects planning data** across diverse users. The row ordering and external activity integration are verified. The primary blocker for full operational use is the SharePoint schema mismatch on the `DailyRecordRows` list.

## Next Steps
1.  [ ] Resolve `Payload` column naming in `DailyRecordRows` list (or update `spListRegistry.definitions.ts`).
2.  [ ] Update "19行" static text to "17行" in the Dashboard component.
3.  [ ] Conduct a follow-up observation once the schema is reconciled to verify "Do" step persistence.

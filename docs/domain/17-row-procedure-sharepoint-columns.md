# 17-Row Procedure SharePoint Column Proposal

This document records the proposed SharePoint list schema for the 17-row support procedure model, optimized for audit traceability and snapshotting.

## Background
To ensure that support records remain accurate even if the master support plan (template) is updated, we propose snapshotting the procedure details into the execution record rows. This also enables easier data analysis without parsing complex JSON payloads.

## Proposed List: `DailyRecordRows` (Execution Records)
These columns are intended for the child list that stores the actual execution status for each of the 17 rows.

| Internal Name | Display Name | Type | Description |
| :--- | :--- | :--- | :--- |
| **Title** | Record Key | Text | Composite Key: `date-userId-rowNo` |
| **UserCode0** | User Code | Text | e.g., `I016` |
| **RecordDate0** | Record Date | Date | The date of service |
| **RowNo0** | Row Number | Number | 1 to 17 (SSOT Index) |
| **TimeSlot0** | Time Slot | Text | Snapshot of `timeLabel` |
| **Activity0** | Activity | Text | Snapshot of `activity` |
| **PersonManual0** | Person's Action | Note | Snapshot of `personAction` |
| **SupporterManual0** | Supporter's Action | Note | Snapshot of `supporterAction` |
| **Situation0** | Condition/Response | Note | The actual response/condition recorded |
| **SpecialNote0** | Row Special Note | Note | Specific notes for this step |
| **Completed0** | Execution Status | Text | `completed`, `triggered`, `skipped`, etc. |
| **ProcedureType0** | Block Category | Text | `morning`, `afternoon`, `outing` |
| **ParentRowNo0** | Parent Row Index | Number | Link for external activities (e.g., Row 16 -> Row 5) |
| **CarePoints0** | Daily Care Points | Note | Snapshot of `dailyCarePoints` |
| **CreatedByName0** | Recorded By | Text | Name of the staff who recorded the action |
| **SourceFileName0** | Source Ref | Text | Original Excel/Document reference if imported |

## Proposed List: `SupportTemplates` (Master Data)
Columns for the master template list (17 rows per user).

| Internal Name | Display Name | Type | Description |
| :--- | :--- | :--- | :--- |
| **UserCode0** | User Code | Text | |
| **RowNo0** | Row Number | Number | 1 to 17 |
| **TimeSlot0** | Time Slot | Text | |
| **Activity0** | Activity | Text | |
| **PersonManual0** | Person's Action | Note | |
| **SupporterManual0** | Supporter's Action | Note | |
| **ProcedureType0** | Block Category | Text | |
| **ParentRowNo0** | Parent Row Index | Number | |

## Implementation Notes
- **Suffix '0'**: Used to avoid internal name collisions and resolve SharePoint 400/500 errors observed in legacy environments.
- **Unresolved Note**: Items such as the "タ" notation in Shioda-san's original document should be handled as `SpecialNote0` or addressed during the import verification phase.
- **Mapping Priority**: `RowNo` remains the primary anchor for synchronization between the UI and SharePoint.

## Version History
- 2026-05-06: Initial proposal based on "Shioda-san" severe support data reorganization.

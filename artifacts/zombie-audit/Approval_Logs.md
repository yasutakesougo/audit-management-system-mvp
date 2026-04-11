# Zombie Column Audit — Approval_Logs

**Scan timestamp**: 2026-04-11T10:29:18.707Z
**SSOT source**: `src/sharepoint/fields/childListSchemas.ts` @ 9c749694
**Total fields on list**: 90

## Classification summary

| Tier | Count |
|---|---|
| `keep_ssot` | 5 |
| `keep_system` | 85 |
| `drift_suffix` | 0 |
| `drift_encoded` | 0 |
| `legacy_unknown` | 0 |

## 🔴 Deletion candidates (auto-detected zombies)

_None detected._

## 🟡 Manual review required (legacy_unknown)

_None._

## 🟢 Keep list (do NOT delete)

### SSOT canonical columns (5)

| InternalName | DisplayName | Type |
|---|---|---|
| `ParentScheduleId` | 親スケジュールID | Number |
| `ApprovedBy` | ApprovedBy | Text |
| `ApprovalNote` | ApprovalNote | Note |
| `ApprovalAction` | ApprovalAction | Choice |
| `ApprovedAt` | ApprovedAt | DateTime |

### System / built-in columns (85)

_Hidden / ReadOnly / FromBaseType = true — SharePoint が管理する列。削除禁止。_


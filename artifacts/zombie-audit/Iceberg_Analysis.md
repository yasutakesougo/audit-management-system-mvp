# Zombie Column Audit — Iceberg_Analysis

**Scan timestamp**: 2026-04-22T04:54:46.657Z
**SSOT source**: `src/sharepoint/fields/childListSchemas.ts` @ 113084c0
**Total fields on list**: 91

## Classification summary

| Tier | Count |
|---|---|
| `keep_ssot` | 6 |
| `keep_system` | 85 |
| `drift_suffix` | 0 |
| `drift_encoded` | 0 |
| `legacy_unknown` | 0 |

## 🔴 Deletion candidates (auto-detected zombies)

_None detected._

## 🟡 Manual review required (legacy_unknown)

_None._

## 🟢 Keep list (do NOT delete)

### SSOT canonical columns (6)

| InternalName | DisplayName | Type |
|---|---|---|
| `EntryHash` | EntryHash | Text |
| `SessionId` | SessionId | Text |
| `UserId` | UserId | Text |
| `PayloadJson` | PayloadJson | Note |
| `SchemaVersion` | SchemaVersion | Number |
| `UpdatedAt` | UpdatedAt | DateTime |

### System / built-in columns (85)

_Hidden / ReadOnly / FromBaseType = true — SharePoint が管理する列。削除禁止。_


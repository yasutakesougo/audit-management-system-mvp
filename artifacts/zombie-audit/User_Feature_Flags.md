# Zombie Column Audit — User_Feature_Flags

**Scan timestamp**: 2026-04-11T10:29:18.707Z
**SSOT source**: `src/sharepoint/fields/childListSchemas.ts` @ 9c749694
**Total fields on list**: 89

## Classification summary

| Tier | Count |
|---|---|
| `keep_ssot` | 4 |
| `keep_system` | 85 |
| `drift_suffix` | 0 |
| `drift_encoded` | 0 |
| `legacy_unknown` | 0 |

## 🔴 Deletion candidates (auto-detected zombies)

_None detected._

## 🟡 Manual review required (legacy_unknown)

_None._

## 🟢 Keep list (do NOT delete)

### SSOT canonical columns (4)

| InternalName | DisplayName | Type |
|---|---|---|
| `UserCode` | ユーザーコード | Text |
| `FlagKey` | FlagKey | Text |
| `FlagValue` | FlagValue | Text |
| `ExpiresAt` | ExpiresAt | DateTime |

### System / built-in columns (85)

_Hidden / ReadOnly / FromBaseType = true — SharePoint が管理する列。削除禁止。_


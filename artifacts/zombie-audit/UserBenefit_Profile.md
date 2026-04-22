# Zombie Column Audit — UserBenefit_Profile

**Scan timestamp**: 2026-04-22T04:54:46.657Z
**SSOT source**: `src/sharepoint/fields/childListSchemas.ts` @ 113084c0
**Total fields on list**: 92

## Classification summary

| Tier | Count |
|---|---|
| `keep_ssot` | 7 |
| `keep_system` | 85 |
| `drift_suffix` | 0 |
| `drift_encoded` | 0 |
| `legacy_unknown` | 0 |

## 🔴 Deletion candidates (auto-detected zombies)

_None detected._

## 🟡 Manual review required (legacy_unknown)

_None._

## 🟢 Keep list (do NOT delete)

### SSOT canonical columns (7)

| InternalName | DisplayName | Type |
|---|---|---|
| `User_x0020_ID` | User ID | Text |
| `Grant_x0020_Municipality` | Grant Municipality | Text |
| `Grant_x0020_Period_x0020_Start` | Grant Period Start | DateTime |
| `Grant_x0020_Period_x0020_End` | Grant Period End | DateTime |
| `User_x0020_Copay_x0020_Limit` | User Copay Limit | Text |
| `Meal_x0020_Addition` | Meal Addition | Text |
| `Copay_x0020_Payment_x0020_Method` | Copay Payment Method | Text |

### System / built-in columns (85)

_Hidden / ReadOnly / FromBaseType = true — SharePoint が管理する列。削除禁止。_


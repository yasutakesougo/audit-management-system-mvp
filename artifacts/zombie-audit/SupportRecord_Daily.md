# Zombie Column Audit — SupportRecord_Daily

**Scan timestamp**: 2026-04-11T10:29:18.707Z
**SSOT source**: `src/sharepoint/fields/childListSchemas.ts` @ 9c749694
**Total fields on list**: 130

## Classification summary

| Tier | Count |
|---|---|
| `keep_ssot` | 6 |
| `keep_system` | 85 |
| `drift_suffix` | 0 |
| `drift_encoded` | 26 |
| `legacy_unknown` | 13 |

## 🔴 Deletion candidates (auto-detected zombies)

| InternalName | DisplayName | Type | Classification | Reason |
|---|---|---|---|---|
| `_x8a18__x9332__x65e5_` | 記録日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7279__x8a18__x4e8b__x9805_` | 特記事項 | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `User_x0020_Rows_x0020_JSON` | User Rows JSON | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Approved_x0020_By` | Approved By | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Approved_x0020_At` | Approved At | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `User_x0020_Code` | User Code | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_in_x0020_Time` | Check-in Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_out_x0020_Time` | Check-out Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_in_x0020_Time0` | Check-in Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_out_x0020_Time0` | Check-out Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_in_x0020_Time1` | Check-in Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_out_x0020_Time1` | Check-out Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_in_x0020_Time2` | Check-in Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_out_x0020_Time2` | Check-out Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_in_x0020_Time3` | Check-in Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_out_x0020_Time3` | Check-out Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_in_x0020_Time4` | Check-in Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_out_x0020_Time4` | Check-out Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_in_x0020_Time5` | Check-in Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_out_x0020_Time5` | Check-out Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_in_x0020_Time6` | Check-in Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `Check_x002d_out_x0020_Time6` | Check-out Time | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `User_x0020_Rows_x0020_JSON0` | User Rows JSON | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `User_x0020_Rows_x0020_JSON1` | User Rows JSON | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `User_x0020_Rows_x0020_JSON2` | User Rows JSON | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `User_x0020_Rows_x0020_JSON3` | User Rows JSON | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |

### UI deletion path

1. SharePoint サイト: https://isogokatudouhome.sharepoint.com/sites/welfare
2. リスト設定 → "SupportRecord_Daily" → 列
3. 上表の InternalName と一致する列をクリック → 削除
4. ⚠️ **削除前に必ず `Hidden=false` / `ReadOnly=false` / `FromBaseType=false` であることを UI 側でも再確認**

## 🟡 Manual review required (legacy_unknown)

⚠️ SSOT にもドリフトパターンにも一致しない列です。削除前に必ず以下を確認してください:
- 旧スキーマの残骸か、現役機能が参照しているか
- `git log -S "<InternalName>"` で履歴を追跡
- 管理者とユースケースを確認

| InternalName | DisplayName | Type | Indexed |
|---|---|---|---|
| `cr013_recorddate` | 記録日 | DateTime | true |
| `cr013_specialnote` | 特記事項 | Note | false |
| `cr013_amactivity` | AM活動 | Text | true |
| `cr013_pmactivity` | PM活動 | Text | false |
| `cr013_lunchamount` | 昼食量 | Choice | false |
| `cr013_behaviorcheck` | 問題行動チェック | MultiChoice | false |
| `UserId` | UserId | Text | true |
| `Completed` | Completed | Boolean | true |
| `Incident` | Incident | Boolean | false |
| `IsDeleted` | IsDeleted | Boolean | false |
| `DeletedAt` | DeletedAt | Text | false |
| `DeletedBy` | DeletedBy | Text | false |
| `Status` | Status | Text | false |

## 🟢 Keep list (do NOT delete)

### SSOT canonical columns (6)

| InternalName | DisplayName | Type |
|---|---|---|
| `Latest_x0020_Version` | Latest Version | Number |
| `RecordDate` | RecordDate | DateTime |
| `ReporterName` | ReporterName | Text |
| `ReporterRole` | ReporterRole | Text |
| `UserCount` | UserCount | Number |
| `ApprovalStatus` | ApprovalStatus | Text |

### System / built-in columns (85)

_Hidden / ReadOnly / FromBaseType = true — SharePoint が管理する列。削除禁止。_


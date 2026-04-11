# Zombie Column Audit — Approval_Logs

**Scan timestamp**: 2026-04-11T09:23:12.012Z
**SSOT source**: `src/sharepoint/fields/childListSchemas.ts` @ 9c749694
**Total fields on list**: 345

## Classification summary

| Tier | Count |
|---|---|
| `keep_ssot` | 1 |
| `keep_system` | 85 |
| `drift_suffix` | 0 |
| `drift_encoded` | 259 |
| `legacy_unknown` | 0 |

## 🔴 Deletion candidates (auto-detected zombies)

| InternalName | DisplayName | Type | Classification | Reason |
|---|---|---|---|---|
| `_x627f__x8a8d__x65e5__x6642_` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30e1__x30e2_` | 承認メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x300` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_1` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x300` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_0` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x301` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_2` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x301` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x302` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_3` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x302` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x303` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_4` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x303` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x304` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_5` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x304` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x305` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_6` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x305` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x306` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_7` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x306` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x307` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_8` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x307` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x308` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_9` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x308` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x309` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_10` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x309` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3010` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_11` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3010` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3011` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_12` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3011` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3012` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_13` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3012` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3013` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_14` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3013` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3014` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_15` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3014` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3015` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_16` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3015` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3016` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x65e5__x6642_17` | 承認日時 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3016` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3017` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3017` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3018` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3018` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3019` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3019` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3020` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3021` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3020` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3021` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3022` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3022` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3023` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3023` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3024` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3024` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3025` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3025` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3026` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3026` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3027` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3027` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3028` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3028` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3029` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3029` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3030` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3030` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3031` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3031` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3032` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3032` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3033` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3033` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3034` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3034` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3035` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3035` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3036` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3036` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3037` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3037` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3038` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3038` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3039` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3039` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3040` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3040` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3041` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3041` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3042` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3042` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3043` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3043` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3044` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3044` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3045` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3045` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3046` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3046` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3047` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3047` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3048` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3048` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3049` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3049` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3050` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3050` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3051` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3051` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3052` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3052` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3053` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3053` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3054` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3054` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3055` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3055` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3056` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3056` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3057` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3057` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3058` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3058` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3059` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3059` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3060` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3060` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3061` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3061` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3062` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3062` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3063` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3063` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3064` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3064` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3065` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3065` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3066` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3066` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3067` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3067` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3068` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3068` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3069` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3069` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3070` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3070` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3071` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3071` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3072` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3072` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3073` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3073` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3074` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3074` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3075` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3075` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3076` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3076` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3077` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3077` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3078` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3078` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3079` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3079` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3080` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3080` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3081` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3081` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3082` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3082` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3083` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3083` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3084` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3084` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3085` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3085` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3086` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3086` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3087` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3087` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3088` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3088` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3089` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3089` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3090` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3090` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3091` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3091` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3092` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3092` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3093` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3093` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3094` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3094` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3095` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3095` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3096` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3096` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3097` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3097` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3098` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3098` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x3099` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x3099` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30100` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30100` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30101` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30101` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30102` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30102` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30103` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30103` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30104` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30104` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30105` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30105` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30106` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30106` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30107` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30107` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30108` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30108` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30109` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30109` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30110` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30110` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30111` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30111` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30112` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30112` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30113` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30113` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30114` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30114` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30115` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30115` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30116` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30116` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30117` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x8005__x30b3__x30117` | 承認者コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x627f__x8a8d__x30a2__x30af__x30118` | 承認アクション | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |

### UI deletion path

1. SharePoint サイト: https://isogokatudouhome.sharepoint.com/sites/welfare
2. リスト設定 → "Approval_Logs" → 列
3. 上表の InternalName と一致する列をクリック → 削除
4. ⚠️ **削除前に必ず `Hidden=false` / `ReadOnly=false` / `FromBaseType=false` であることを UI 側でも再確認**

## 🟡 Manual review required (legacy_unknown)

_None._

## 🟢 Keep list (do NOT delete)

### SSOT canonical columns (1)

| InternalName | DisplayName | Type |
|---|---|---|
| `ParentScheduleId` | 親スケジュールID | Number |

### System / built-in columns (85)

_Hidden / ReadOnly / FromBaseType = true — SharePoint が管理する列。削除禁止。_


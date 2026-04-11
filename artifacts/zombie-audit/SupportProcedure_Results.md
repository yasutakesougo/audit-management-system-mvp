# Zombie Column Audit — SupportProcedure_Results

**Scan timestamp**: 2026-04-11T09:23:12.012Z
**SSOT source**: `src/sharepoint/fields/childListSchemas.ts` @ 9c749694
**Total fields on list**: 398

## Classification summary

| Tier | Count |
|---|---|
| `keep_ssot` | 1 |
| `keep_system` | 85 |
| `drift_suffix` | 0 |
| `drift_encoded` | 312 |
| `legacy_unknown` | 0 |

## 🔴 Deletion candidates (auto-detected zombies)

| InternalName | DisplayName | Type | Classification | Reason |
|---|---|---|---|---|
| `_x7d50__x679c__x65e5_` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x30` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x30` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_0` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x300` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_0` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x300` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_1` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x301` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_1` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x301` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_2` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x302` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_2` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x302` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_3` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x303` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_3` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x303` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_4` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x304` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_4` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x304` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_5` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x305` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_5` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x305` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_6` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x306` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_6` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x306` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_7` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x307` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_7` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x307` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_8` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x308` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_8` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x308` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_9` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x309` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_9` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x309` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_10` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3010` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_10` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3010` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_11` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3011` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_11` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3011` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_12` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3012` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_12` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3012` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_13` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3013` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_13` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3013` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_14` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3014` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_14` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3014` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_15` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3015` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_15` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3015` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_16` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3016` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_16` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3016` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_17` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3017` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_17` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3017` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_18` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3018` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_18` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3018` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_19` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3019` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_19` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3019` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_20` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3020` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_20` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3020` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_21` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3021` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_21` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3021` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_22` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3022` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_22` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3022` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_23` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3023` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_23` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3023` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_24` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3024` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_24` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3024` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_25` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3025` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_25` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3025` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_26` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3026` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_26` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3026` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_27` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3027` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_27` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3027` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_28` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3028` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_28` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3028` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_29` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3029` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_29` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3029` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_30` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3030` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_30` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3030` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_31` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3031` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_31` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3031` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_32` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3032` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_32` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3032` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_33` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3033` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_33` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3033` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_34` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3034` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_34` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3034` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_35` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3035` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_35` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3035` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_36` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3036` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_36` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3036` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_37` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3037` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_37` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3037` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_38` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3038` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_38` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3038` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_39` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3039` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_39` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3039` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_40` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3040` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_40` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3040` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_41` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3041` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_41` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3041` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_42` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3042` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_42` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3042` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_43` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3043` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_43` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3043` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_44` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3044` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_44` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3044` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_45` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3045` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_45` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3045` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_46` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3046` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_46` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3046` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_47` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3047` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_47` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3047` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_48` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3048` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_48` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3048` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_49` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3049` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_49` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3049` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_50` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3050` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_50` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3050` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_51` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3051` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_51` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3051` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_52` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3052` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_52` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3052` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_53` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3053` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_53` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3053` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_54` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3054` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_54` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3054` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_55` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3055` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_55` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3055` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_56` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3056` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_56` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3056` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_57` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3057` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_57` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3057` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_58` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3058` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_58` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3058` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_59` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3059` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_59` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3059` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_60` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3060` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_60` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3060` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_61` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3061` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_61` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_62` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3062` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_62` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3061` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_63` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3063` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_63` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3062` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_64` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3064` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_64` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3063` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_65` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3065` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_65` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3064` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_66` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3066` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_66` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3065` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_67` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3067` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_67` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3066` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_68` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3068` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_68` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3067` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_69` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3069` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_69` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3068` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_70` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3070` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_70` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3069` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_71` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3071` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_71` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3070` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_72` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3072` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_72` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3071` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_73` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3073` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_73` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3072` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_74` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_75` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3074` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_74` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3075` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3073` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_75` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3074` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_76` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x30b9__x30c6__x3076` | 結果ステータス | Choice | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x5b9f__x65bd__x30e1__x30e2_76` | 実施メモ | Note | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x62c5__x5f53__x8077__x54e1__x3075` | 担当職員コード | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x7d50__x679c__x65e5_77` | 結果日 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |

### UI deletion path

1. SharePoint サイト: https://isogokatudouhome.sharepoint.com/sites/welfare
2. リスト設定 → "SupportProcedure_Results" → 列
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


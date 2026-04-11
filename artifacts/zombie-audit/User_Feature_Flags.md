# Zombie Column Audit — User_Feature_Flags

**Scan timestamp**: 2026-04-11T09:23:12.012Z
**SSOT source**: `src/sharepoint/fields/childListSchemas.ts` @ 9c749694
**Total fields on list**: 335

## Classification summary

| Tier | Count |
|---|---|
| `keep_ssot` | 1 |
| `keep_system` | 85 |
| `drift_suffix` | 0 |
| `drift_encoded` | 249 |
| `legacy_unknown` | 0 |

## 🔴 Deletion candidates (auto-detected zombies)

| InternalName | DisplayName | Type | Classification | Reason |
|---|---|---|---|---|
| `_x30d5__x30e9__x30b0__x30ad__x30` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x5024_` | フラグ値 | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x6709__x52b9__x671f__x9650_` | 有効期限 | DateTime | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x300` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x301` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x302` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x303` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x304` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x305` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x306` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x307` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x308` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x309` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3010` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3011` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3012` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3013` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3014` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3015` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3016` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3017` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3018` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3019` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3020` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3021` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3022` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3023` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3024` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3025` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3026` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3027` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3028` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3029` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3030` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3031` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3032` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3033` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3034` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3035` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3036` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3037` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3038` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3039` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3040` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3041` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3042` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3043` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3044` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3045` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3046` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3047` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3048` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3049` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3050` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3051` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3052` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3053` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3054` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3055` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3056` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3057` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3058` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3059` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3060` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3061` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3062` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3063` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3064` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3065` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3066` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3067` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3068` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3069` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3070` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3071` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3072` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3073` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3074` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3075` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3076` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3077` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3078` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3079` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3080` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3081` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3082` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3083` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3084` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3085` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3086` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3087` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3088` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3089` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3090` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3091` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3092` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3093` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3094` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3095` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3096` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3097` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3098` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x3099` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30100` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30101` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30102` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30103` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30104` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30105` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30106` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30107` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30108` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30109` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30110` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30111` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30112` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30113` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30114` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30115` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30116` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30117` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30118` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30119` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30120` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30121` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30122` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30123` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30124` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30125` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30126` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30127` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30128` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30129` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30130` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30131` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30132` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30133` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30134` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30135` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30136` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30137` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30138` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30139` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30140` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30141` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30142` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30143` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30144` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30145` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30146` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30147` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30148` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30149` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30150` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30151` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30152` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30153` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30154` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30155` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30156` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30157` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30158` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30159` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30160` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30161` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30162` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30163` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30164` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30165` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30166` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30167` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30168` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30169` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30170` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30171` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30172` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30173` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30174` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30175` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30176` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30177` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30178` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30179` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30180` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30181` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30182` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30183` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30184` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30185` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30186` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30187` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30188` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30189` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30190` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30191` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30192` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30193` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30194` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30195` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30196` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30197` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30198` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30199` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30200` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30201` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30202` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30203` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30204` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30205` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30206` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30207` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30208` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30209` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30210` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30211` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30212` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30213` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30214` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30215` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30216` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30217` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30218` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30219` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30220` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30221` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30222` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30223` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30224` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30225` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30226` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30227` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30228` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30229` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30230` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30231` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30232` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30233` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30234` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30235` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30236` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30237` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30238` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30239` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30240` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30241` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30242` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30243` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30244` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |
| `_x30d5__x30e9__x30b0__x30ad__x30245` | フラグキー | Text | `drift_encoded` | UCS-2 encoded name (_xNNNN_) — typically Japanese display-name auto-encoded |

### UI deletion path

1. SharePoint サイト: https://isogokatudouhome.sharepoint.com/sites/welfare
2. リスト設定 → "User_Feature_Flags" → 列
3. 上表の InternalName と一致する列をクリック → 削除
4. ⚠️ **削除前に必ず `Hidden=false` / `ReadOnly=false` / `FromBaseType=false` であることを UI 側でも再確認**

## 🟡 Manual review required (legacy_unknown)

_None._

## 🟢 Keep list (do NOT delete)

### SSOT canonical columns (1)

| InternalName | DisplayName | Type |
|---|---|---|
| `UserCode` | ユーザーコード | Text |

### System / built-in columns (85)

_Hidden / ReadOnly / FromBaseType = true — SharePoint が管理する列。削除禁止。_


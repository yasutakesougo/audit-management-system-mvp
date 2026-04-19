# 📅 SharePoint 月次点検手順：ゾンビ列クリーンアップ (v3.0)

このドキュメントは、SharePoint リストの物理制約（8KB / インデックス上限）によるエラーを未然に防ぎ、システムを「Operational OS」として安定稼働させるための **月次標準作業手順書 (SOP)** です。

---

### 🚨 前回フェーズの達成成果 (2026-04-05)
*   **323 本** のゾンビ列を削除し、システム全域の 500/400 エラーを解消。
*   日本語エンコード列 (`_x30d5...`) の衝突パターンの特定と排除を完了。

---

### 🆕 今期対象 (2026-04-19 追加)

#### `UserBenefit_Profile_Ext` — `User_x0020_ID` 重複解消

- [ ] **削除対象内部名:** `User_x0020_ID`
- [ ] **canonical（残す列）:** `UserID`
- [ ] **判定根拠:**
  1. Registry SSOT: `spListRegistry.definitions.ts` の `user_benefit_profile_ext.provisioningFields.UserID` が primary、`User_x0020_ID` は candidates fallback
  2. Read path: `DataProviderUserRepository.ts` に `User_x0020_ID` 直参照なし（FieldMap/candidates resolver 経由）
  3. Migration: `scripts/migrate-user-benefit-userid.ps1` が canonical `UserID` を前提として backfill 済み
- [ ] **削除前提条件（2026-04-19 時点で解消済み）:**
  1. CI schema 更新済み: `scripts/ci/schemas/user-benefit-ext.mjs` の `ESSENTIAL_FIELDS` を `['UserID']` に矯正
  2. 参考: `scripts/ci/schemas/users.mjs` も同時に canonical essential 化済み（`Users_Master` 実テナントは canonical のみ存在を確認）
- [ ] **推奨事前確認:**
  - `pwsh ./scripts/migrate-user-benefit-userid.ps1 -DryRun` で `UserID` 列にデータが入っていることを確認
- [ ] **削除後確認:**
  - `/admin/status` で `schema.fields.user_benefit_profile_ext` の drift `UserID -> User_x0020_ID` が消えて `pass` もしくは `warn`（他 drift 残）に遷移

#### `UserBenefit_Profile` — 連番ゾンビ列 285本 一括削除（canonical 3列追加の容量確保）

**背景:** LIVE で「列合計サイズ上限」エラー発生。read-only 棚卸し（2026-04-19 実施・生成物 `tmp/user_benefit_profile_field_audit.json` / `tmp/user_benefit_profile_orphan_report.json`）の結果、**378列中 285列（75%）が orphan・全 `nonEmptyCount=0`**。canonical 3列（`RecipientCertExpiry` / `DisabilitySupportLevel` / `GrantedDaysPerMonth`）追加の前段として削除実施。

- [ ] **削除対象 family（yes 群・全て `nonEmptyCount=0` / 30日更新なし / registry 未記載 / read path 未参照）**

| Family | 列数 | 型 |
|---|---|---|
| `Disability_x0020_Support_x0020_L[0-25]` | 27 | Text |
| `Granted_x0020_Days_x0020_Per_x00[0-25]` | 27 | Text |
| `Meal_x0020_Addition[0-25]` | 27 | Text |
| `Recipient_x0020_Cert_x0020_Expir[0-25]` | 27 | DateTime |
| `User_x0020_Copay_x0020_Limit[0-25]` | 27 | Text |
| `Copay_x0020_Payment_x0020_Method[0-25]` | 26 | Text |
| `Grant_x0020_Municipality[0-25]` | 26 | Text |
| `Grant_x0020_Period_x0020_Start[0-25]` | 26 | DateTime |
| `Grant_x0020_Period_x0020_End[0-25]` | 26 | DateTime |
| `User_x0020_ID[0-19]` | 20 | Text |
| **合計（yes 群）** | **259** | — |

> ⚠️ 実測で `yes=285` と報告あり。上記 family 集計との差分は、表示されていない家族（例: `Recipient_x0020_Cert_x0020_Numb[0-25]` 等）または range の上端差の可能性。実行前に `tmp/user_benefit_profile_orphan_report.json` の全リスト突合を推奨。

- [ ] **削除対象 review 群（1本）**
  - `Recipient_x0020_Cert_x0020_Numbe`（truncation 形式、`_ext` 側との名称衝突のため慎重確認）
  - 判定手順:
    1. 実テナントで本列の `nonEmptyCount` を再確認 → 0 なら削除可
    2. `>0` の場合は `UserBenefit_Profile_Ext.RecipientCertNumber` 側に同一値が存在することを確認してから削除

- [ ] **段階実行計画（family 単位の phase 方式）**
  1. **Phase 1**: yes 群を family 1本ずつ削除 → ゴミ箱パージ → アプリ再実行 → `/admin/status` 確認 → 次 family
     - 目安: 1 family / 回、途中で HTTP 500 や容量エラーが出たら即停止
     - 推奨ツール: `scripts/ops/zombie-column-purger.mjs --force --list=UserBenefit_Profile`
       - ⚠️ 現状 TARGETS に `UserBenefit_Profile` 未登録のため、実行前にスクリプトへ patterns 追記が必要（別PR で対応）
  2. **Phase 2**: `Recipient_x0020_Cert_x0020_Numbe` 単体 review → 判定に従い削除
  3. **Phase 3**: canonical 3列追加
     - `RecipientCertExpiry`（DateTime, DateOnly）
     - `DisabilitySupportLevel`（Text）
     - `GrantedDaysPerMonth`（Text）

- [ ] **削除後の健康診断**
  - `/admin/status` の `schema.fields.user_benefit_profile` で `missingEssential` が空、drift が Phase 3 追加後に減ること
  - Provisioning ログで 500/400 エラーが出ないこと
  - 列合計サイズが canonical 追加後も上限に収まること

- [ ] **ロールバック判断基準**
  - ある family 削除後に `/admin/status` で FAIL が出たら該当 family の削除を停止し、直前ゴミ箱からの復元を検討

---

### 🛠️ 推奨ツール
*   [zombie-column-purger.mjs](../../scripts/ops/zombie-column-purger.mjs)
    *   使い方: `node scripts/ops/zombie-column-purger.mjs --force`

**「少量ずつ削除 → ゴミ箱パージ → アプリ再実行」** を基本サイクルとし、慎重に進めます。

> [!IMPORTANT]
> **削除は1回につき 1〜3列まで**とし、各回ごとに「ゴミ箱パージ → アプリ再実行 → ログ確認」を行ってください。
> また、列の確認は **「表示名（Title）」ではなく「内部名（InternalName）」** を基準に行ってください。
> *※表示名を変えても内部名は変わらないため、表示名ベースの判断は誤判定を招きます。*

---

## 🥇 第1段階：事前準備と安全なゴミ取り

### 📸 事前準備
- [ ] 削除対象リスト（Approval_Logs / User_Feature_Flags）の「列の一覧」画面のスクリーンショットを保存する。
  *理由: 万が一誤って削除した場合に、構成を正確に復元するため。*

### 🛠️ 削除対象の特定ロジック（重要）

単なる `ApprovedBy1` のような連番だけでなく、**日本語名のエンコード形式** でゾンビ化するパターンに注意すること。

| 項目名 | 有効な InternalName (例) | ゾンビ化後のパターン |
| :--- | :--- | :--- |
| フラグキー | `_x30d5__x30e9__x30b0__x30ad__x30` | `...x300`, `...x301`, ..., `...x3010` |
| 承認者コード | `_x627f__x8a8d__x8005__x30b3__x30` | `...x300`, `...x301`, ..., `...x3029` |
| 有効期限 | `_x6709__x52b9__x671f__x9650_` | `...x9650_0`, `...x9650_1`, ..., `...x9650_99` |

**検出ルール:**
1.  各リストの「正解」となる InternalName を `spListRegistry.ts` や `fields/*.ts` から特定する。
2.  その正解名を「前方一致」し、かつ末尾が数字のみで構成されている列はすべて「ゾンビ」とみなし削除する。
3.  SharePoint は InternalName を最大 32 文字程度に切り詰めるため、末尾の数字が衝突して `3010` のように長くなる場合があることに注意。

### 🗑️ 削除OK列（現行参照なし）
以下のパターンの列は、現行コードで一切参照されておらず、削除可能です。

- [ ] `ApprovedBy0`, `ApprovedBy1` ... (Approval_Logs)
- [ ] `ApprovalAction0`, `ApprovalAction1` ... (Approval_Logs)
- [ ] `FlagKey0`, `FlagValue0` ... (User_Feature_Flags)
- [ ] `Field1`, `Field2`, `Column1` ... (すべてのリスト)

### 🔄 実作業後のアクション
- [ ] ゴミ箱を空にする（パージ）
- [ ] アプリを再実行（サーバー起動確認）
- [ ] `provision_failed` の件数を確認する
- [ ] 500 (8KB) / 400 (Schema) エラーの変化を確認する

---

## 🥈 絶対保持：削除厳禁（Current SSOT）
以下の内部名（InternalName）は、絶対に削除しないでください。

### Approval_Logs
- **`ParentScheduleId`** (必須: リレーション)
- **`ApprovedBy`** (必須: 承認者)
- **`ApprovedAt`** (必須: 承認日時)
- **`ApprovalNote`** (必須: 承認メモ)
- **`ApprovalAction`** (必須: 承認アクション)

### User_Feature_Flags
- **`UserCode`** (必須)
- **`FlagKey`** (必須)
- **`FlagValue`** (必須)
- **`ExpiresAt`** (必須)

---

## 🥉 第3段階：要確認（第1段階で解消しない場合のみ）
第1段階実施後も `「列の合計サイズが制限超過」` と出る場合、以下の手順で重複を解消します。

### 判断基準：データ件数と更新時期
- [ ] その列に値が入っている件数（レコード数）を確認する
- [ ] **直近30日で更新された行**に値が入っているか確認する
  *注意: 古いログでも、最近のデータにその列が使われていたら「生きている」と判断し、削除を保留します。*

### 具体的な比較例
1. **`Approved_x0020_By` (空白あり) vs `ApprovedBy` (正規)**
   - [ ] 両方の列が存在し、正規列 (`ApprovedBy`) 側にデータが集約されていることを確認して削除。
2. **日本語由来名 (例: `_x627f__x8a8d__x8005_...`) vs 正規名**
   - [ ] 過去の古いログ（半年前など）のみ入っているか確認し、正規名側に移行済みであれば削除。

---

## 🛑 改善しない場合の次手
**削除で改善しない場合は、列の問題ではなく「リスト構造そのものの飽和」を疑います。**

列を削除してもエラーが続く場合は、単なるサイズ上限（8KB）だけでなく、**「インデックス処理されている列の数（Indexing Limit）」** が上限に達している（500エラー）可能性があります。

1. **不要インデックス列の見直し**: 未使用の列で「インデックス付き」になっているものを解除する。
2. **新リスト再作成の検討**: テンプレート化して再作成することで、内部的な物理構造をリセット。
3. **`Approval_Logs` の分割/アーカイブ**: 半年以上前のデータを別リストへ移動し、現行リストを軽量化。

---

## 🏁 完了判定（手術後の健康診断）
- [ ] アプリの Provisioning ログが `NORMAL` または `SUCCESS` になった
- [ ] 新規データが `ApprovedBy` など正規列に正常に書き込まれている
- [ ] **`MeetingMinutes` 一覧取得で `ContentBlocksJson` 不在による 400 エラーが出なくなった**

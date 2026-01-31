# Schedules リスト Phase 1 セットアップ（確実ルート）

## 概要

SharePoint Online (app-test) に Schedules リストを作成し、Phase 1 必須フィールド（17列）を追加する手順書。

- **対象サイト**: https://isogokatudouhome.sharepoint.com/sites/app-test
- **認証方式**: PnP PowerShell DeviceLogin（ClientID不要、管理者作業なし）
- **所要時間**: 5-10分（手動作成1分 + スクリプト実行4-9分）

---

## Step 0: Schedulesリスト手動作成（1分）

```
1. ブラウザで開く:
   https://isogokatudouhome.sharepoint.com/sites/app-test

2. 「サイトのコンテンツ」→「+ 新規」→「リスト」→「空白のリスト」

3. 設定:
   - 名前: Schedules
   - 説明: Phase 1: Schedule management
   - [作成]

4. 完了（リスト画面が表示されればOK）
```

---

## Step 1-6: PowerShell一括実行（DeviceLogin → フィールド追加 → 検証）

手動作成完了後、**以下を順番にPowerShellで実行**：

```powershell
# PowerShell起動
pwsh

# === Step 1: DeviceLogin接続 ===
$SiteUrl = "https://isogokatudouhome.sharepoint.com/sites/app-test"
Connect-PnPOnline -Url $SiteUrl -DeviceLogin
# ↑ ブラウザが開いてコード（例: A1B2C3D4）入力を求められます

# 🔒 保険: 接続先確認（app-test に繋がっているか）
Get-PnPWeb | Select-Object Title, Url

# === Step 2: リスト存在確認 ===
Get-PnPList -Identity "Schedules" | Select-Object Title, Id

# === Step 3: Phase 1 フィールド追加（17列自動作成） ===
cd /Users/yasutakesougo/audit-management-system-mvp
./scripts/add-schedules-phase1-fields.ps1

# === Step 4: 内部名一覧（全件） ===
$fields = Get-PnPField -List "Schedules"
$fields | Select-Object InternalName, Title, TypeAsString, Required | Sort-Object InternalName | Format-Table -AutoSize

# === Step 5: 必須8項目チェック（最重要） ===
$need = @("EventDate","EndDate","cr014_personType","cr014_personId","RowKey","cr014_dayKey","MonthKey","cr014_fiscalYear")
$fields | Where-Object { $need -contains $_.InternalName } | Select-Object InternalName, Title, TypeAsString, Required | Sort-Object InternalName | Format-Table -AutoSize

# 🔒 保険: 不足項目検出（空なら完全一致）
$missing = $need | Where-Object { $_ -notin $fields.InternalName }
"Missing: " + ($missing -join ", ")
```

---

## 📤 実行後にレビュー用として貼る出力

### 1. 接続先確認（Step 1直後）

```
Title                  Url
-----                  ---
iceberg-pdca-app-test  https://isogokatudouhome.sharepoint.com/sites/app-test
```

### 2. リスト確認（Step 2）

```
Title     Id
-----     --
Schedules xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 3. 必須8項目（Step 5）

```
InternalName      TypeAsString Required
------------      ------------ --------
EventDate         DateTime     True
EndDate           DateTime     True
cr014_dayKey      Date         True
cr014_fiscalYear  Text         True
cr014_personId    Text         True
cr014_personType  Choice       True
MonthKey          Text         True
RowKey            Text         True
```

### 4. 不足チェック（Step 5直後）

```
Missing: 
```
（空なら✅完全一致）

---

## よくある落とし穴と対処

### 1. `cr014_dayKey0` みたいに内部名がズレる

**原因**: Date列の作成時にSharePointが自動でサフィックスを付ける場合がある

**対処**:
1. Step 4の全件一覧で実際のInternalNameを確認
2. `src/infra/sharepoint/fields.ts` の `SCHEDULES_FIELD_MAP` を実名に合わせる
3. スクリプト再実行不要（コード側を実リストに合わせる）

### 2. Choice列の Required が False になる

**原因**: `Add-PnPField` の `-Required $true` が効かない場合がある

**対処**:
1. SharePoint UI で該当列の設定を開く
2. 「この列への情報の入力を必須にする」にチェック
3. 保存

### 3. DeviceLogin で `Access denied`

**原因**: Tenantレベルで PnP Management Shell が制限されている

**対処**（2択）:
- A) SharePoint管理者に依頼して PnP Management Shell を許可
- B) 列追加もUI手動で実施（Phase 1は8列なので10分程度）

---

## Phase 1 必須フィールド仕様（17列）

| InternalName       | 表示名             | Type     | Required | 説明                          |
|--------------------|-------------------|----------|----------|-------------------------------|
| EventDate          | 予定開始日時        | DateTime | ○        | 予定の開始タイムスタンプ         |
| EndDate            | 予定終了日時        | DateTime | ○        | 予定の終了タイムスタンプ         |
| Status             | ステータス          | Choice   | △        | Draft/Confirmed/Cancelled     |
| ServiceType        | サービス種別        | Choice   | △        | 生活介護/就労継続支援A型/B型等   |
| cr014_personType   | 対象者種別          | Choice   | ○        | User/Staff/Org               |
| cr014_personId     | 対象者ID           | Text     | ○        | UserID/StaffID/OrgCode       |
| cr014_personName   | 対象者名           | Text     | △        | 表示用氏名                     |
| AssignedStaffId    | 担当職員ID         | Text     | △        | 担当StaffID                   |
| TargetUserId       | 対象利用者ID       | Text     | △        | サービス対象のUserID           |
| RowKey             | 行キー             | Text     | ○        | GUID推奨（SP.Id独立）         |
| cr014_dayKey       | 日集計キー         | Date     | ○        | yyyy-MM-dd                   |
| MonthKey           | 月集計キー         | Text     | ○        | yyyy-MM                      |
| cr014_fiscalYear   | 年度              | Text     | ○        | 会計年度（例: 2025）          |
| cr014_orgAudience  | 組織スコープ       | Text     | △        | マルチテナント用               |
| Note               | 備考              | Note     | △        | 複数行テキスト                 |
| CreatedAt          | アプリ作成日時     | DateTime | △        | アプリ側管理タイムスタンプ      |
| UpdatedAt          | アプリ更新日時     | DateTime | △        | アプリ側管理タイムスタンプ      |

※ ○=Phase 1必須、△=Phase 1任意（Phase 2以降で必須化の可能性あり）

---

## 次のステップ

1. ✅ **内部名一覧の確認**（この手順書）
2. ⏳ **Integration テスト作成**: `tests/integration/schedules.sp.integration.spec.ts`
3. ⏳ **Adapter 切替**: `src/features/schedules/data/sharePointAdapter.ts` (demo → 実装)
4. ⏳ **Master リスト Phase 1 検証**: Users_Master/Staff_Master の必須列確認

---

## 参考

- スクリプト: [`scripts/add-schedules-phase1-fields.ps1`](../../scripts/add-schedules-phase1-fields.ps1)
- フィールド定義: [`src/infra/sharepoint/fields.ts`](../../src/infra/sharepoint/fields.ts)
- リスト設計: [`docs/sharepoint-lists.md`](../sharepoint-lists.md)

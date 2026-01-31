# Scripts Directory

SharePoint リスト・フィールド自動作成スクリプト集。

## 📋 Schedules リスト Phase 1 セットアップ

**完全ガイド**: [docs/runbooks/schedules-list-setup.md](../docs/runbooks/schedules-list-setup.md)

### クイックスタート（5-10分）

```bash
# 1. Schedulesリスト手動作成（ブラウザUI、1分）
open https://isogokatudouhome.sharepoint.com/sites/app-test
# → 「サイトのコンテンツ」→「+ 新規」→「リスト」
# → 名前: Schedules

# 2. PowerShell実行（17列自動追加）
pwsh

$SiteUrl = "https://isogokatudouhome.sharepoint.com/sites/app-test"
Connect-PnPOnline -Url $SiteUrl -DeviceLogin
Get-PnPWeb | Select-Object Title, Url  # 接続先確認

cd /Users/yasutakesougo/audit-management-system-mvp
./scripts/add-schedules-phase1-fields.ps1

# 3. 検証（内部名一覧）
$fields = Get-PnPField -List "Schedules"
$need = @("EventDate","EndDate","cr014_personType","cr014_personId","RowKey","cr014_dayKey","MonthKey","cr014_fiscalYear")
$fields | Where-Object { $need -contains $_.InternalName } | Select-Object InternalName, TypeAsString, Required | Sort-Object InternalName | Format-Table -AutoSize
```

---

## 📂 スクリプト一覧

### SharePoint リスト作成

| ファイル                          | 用途                                  | 認証方式          | 実行環境      |
|----------------------------------|---------------------------------------|------------------|--------------|
| `create-schedules-list.ps1`      | Schedulesリスト作成                    | DeviceLogin      | PowerShell   |
| `create-schedules-list-rest.sh`  | Schedulesリスト作成（REST API）         | az cli           | bash         |

### SharePoint フィールド追加

| ファイル                               | 用途                                  | 列数  | 認証方式          |
|---------------------------------------|---------------------------------------|------|------------------|
| `add-schedules-phase1-fields.ps1`     | Schedules Phase 1 フィールド追加       | 17   | DeviceLogin      |
| `add-schedules-phase1-fields-rest.sh` | Schedules Phase 1 フィールド追加（REST）| 17   | az cli           |

---

## 🔒 認証方式の選択

### 推奨: PowerShell + DeviceLogin

```powershell
Connect-PnPOnline -Url $SiteUrl -DeviceLogin
```

**メリット**:
- ClientID不要（Entra ID App Registration 不要）
- 管理者作業なし
- テナント制限がゆるい環境で通りやすい

**デメリット**:
- ブラウザでコード入力が必要（CI/CD自動化には不向き）

### 代替: bash + az cli + REST API

```bash
az login
./scripts/create-schedules-list-rest.sh
```

**メリット**:
- az cli で認証済みならそのまま使える
- jq でレスポンス加工が柔軟

**デメリット**:
- `Sites.Manage` 権限が必要（User token では拒否されることが多い）
- Digest取得・エラーハンドリングが複雑

---

## 🚨 トラブルシューティング

### 1. `Specified method is not supported` (PnP)

**原因**: `-Interactive` が macOS/Linux で動かない

**対処**: `-DeviceLogin` に変更（既に修正済み）

### 2. `Access denied` (REST API)

**原因**: az cli user token に `Sites.Manage` 権限なし

**対処**: PowerShell + DeviceLogin ルートに切り替え

### 3. `cr014_dayKey0` など内部名ズレ

**原因**: SharePoint が Date/Choice 列作成時にサフィックス付与

**対処**:
1. `Get-PnPField` で実際の InternalName を確認
2. `src/infra/sharepoint/fields.ts` を実名に合わせる

---

## 📖 関連ドキュメント

- **実行ガイド**: [docs/runbooks/schedules-list-setup.md](../docs/runbooks/schedules-list-setup.md)
- **フィールド定義**: [src/infra/sharepoint/fields.ts](../src/infra/sharepoint/fields.ts)
- **リスト設計**: [docs/sharepoint-lists.md](../docs/sharepoint-lists.md)
- **Phase 2-2 完了報告**: [IMPLEMENTATION_REPORT.md](../IMPLEMENTATION_REPORT.md)

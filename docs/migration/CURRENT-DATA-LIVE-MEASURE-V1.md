# CURRENT-DATA-LIVE-MEASURE-V1

> **Mode**: READ ONLY（SharePoint への書き込みは一切行いません）  
> **Purpose**: 現行 SharePoint リストのライブ計測  
> **Date**: 2026-09-14  
> **Script**: `scripts/measure/CURRENT-DATA-LIVE-MEASURE-V1.ps1`

---

## READ surface（契約）

本スクリプトが SharePoint 上で読む対象は次に限定します。いずれも **READ ONLY** です。

**Primary lists（6）**

- `Users_Master`
- `Staff_Master`
- `Org_Master`
- `Daily_Attendance`
- `SupportRecord_Daily`
- `DailyActivityRecords`

**Auxiliary child-list candidates（exact 2, READ ONLY only）**

- `DailyRecordRows`
- `SupportRecord_DailyRows`

子行件数は `SupportRecord_Daily` の移行判断に必要なため、上記 2 リストの存在確認と `ItemCount` のみを追加計測します。これ以外のリストは探索しません。

---

## 実行手順

### 前提

- PowerShell 7+ (`pwsh`)
- PnP.PowerShell モジュール
- SharePoint サイトへの読み取り権限
- `-SiteUrl` は必須（組織固有 URL をソースに持たない）
- `-ClientId` は引数、または環境変数 `PNP_CLIENT_ID` / `VITE_MSAL_CLIENT_ID` / `VITE_AAD_CLIENT_ID`

### コマンド

```powershell
# 対話ログイン（ブラウザ）
pwsh ./scripts/measure/CURRENT-DATA-LIVE-MEASURE-V1.ps1 `
  -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>" `
  -ClientId "<entra-app-client-id>"

# デバイスログイン（CICD/サーバー）
pwsh ./scripts/measure/CURRENT-DATA-LIVE-MEASURE-V1.ps1 `
  -SiteUrl "https://<tenant>.sharepoint.com/sites/<site>" `
  -ClientId "<entra-app-client-id>" `
  -UseDeviceLogin
```

### 出力

- `artifacts/live-measure-v1/CURRENT-DATA-LIVE-MEASURE-V1.json`
- `artifacts/live-measure-v1/CURRENT-DATA-LIVE-MEASURE-V1.csv`

このディレクトリは `.gitignore` 済みです。出力は件数のみ（識別キーの raw sample は含みません）。

---

## 共通計測結果

| リスト | Exists | ItemCount | EarliestCreated | LatestModified | KeyField | KeyFieldAvailable | DuplicateKeyCount | MissingKeyCount |
|:---|:---:|:---:|:---|:---|:---|:---:|:---:|:---:|
| Users_Master | | | | | UserID | | | |
| Staff_Master | | | | | StaffID | | | |
| Org_Master | | | | | OrgCode/Title | | | |
| Daily_Attendance | | | | | UserCode/UserID | | | |
| SupportRecord_Daily | | | | | Title | | | |
| DailyActivityRecords | | | | | UserCode/UserID | | | |

---

## 個別計測結果

### Users_Master

| 項目 | 値 |
|:---|---:|
| UserCode uniqueness | |
| Transport 系値あり件数 | |
| Benefit 系値あり件数 | |
| 分割対象件数（Transport or Benefit） | |

### Daily_Attendance

| 項目 | 値 |
|:---|---:|
| Date range (min) | |
| Date range (max) | |
| UserCode 欠損件数 | |
| RecordDate 欠損件数 | |
| Target key `{UserCode}_{RecordDate}` 重複数 | |

### SupportRecord_Daily

| 項目 | 値 |
|:---|---:|
| Parent count | |
| Date range (min) | |
| Date range (max) | |
| Parent key 重複数 | |
| Embedded row 総数（UserRowsJSON 配列要素数） | |
| Parse 不能 row 件数 | |
| Auxiliary `DailyRecordRows` Exists / ItemCount | |
| Auxiliary `SupportRecord_DailyRows` Exists / ItemCount | |
| Child row 総数（上記 auxiliary 2 件の ItemCount 合計） | |
| ConversionPlannedCount | |

`ConversionPlannedCount` = `EmbeddedRowTotal` + `ChildRowTotal`  
（子行への正規化予定件数。親 1 件に JSON が 10 行あれば Embedded 側は 10 と数える）

### DailyActivityRecords

| 項目 | 値 |
|:---|---:|
| Record count | |
| Date range (min) | |
| Date range (max) | |
| User key 欠損件数 | |
| Orphan candidate count（Users_Master に存在しない UserCode） | |

### Staff_Master

| 項目 | 値 |
|:---|---:|
| Count | |
| Latest Modified | |
| Key uniqueness | |

### Org_Master

| 項目 | 値 |
|:---|---:|
| Count | |
| Latest Modified | |
| Key uniqueness | |

---

## 備考

- 本計測は READ ONLY です。`Get-PnPList`, `Get-PnPListItem`, `Get-PnPField` のみを使用しています。
- 件数が多いリスト（数万件以上）の場合、`-PageSize 5000` でページング取得しますが、実行時間が長くなる可能性があります。
- 重複キー・孤児候補は **件数のみ** 出力します。識別キーの raw sample は保持しません。
- 実際の数値は上記スクリプトを実行した後、出力された JSON/CSV から転記してください。

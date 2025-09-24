# SharePoint Provisioning Guide

本書は GitHub Actions と PnP.PowerShell を用いた **SharePoint リスト自動作成／上書き更新** の手順をまとめたものです。

## 概要

- スキーマは `provision/schema.json` に外出し。
- ワークフロー `.github/workflows/provision-sharepoint.yml` から `scripts/provision-spo.ps1` を呼び出して適用。
- **WhatIf（ドライラン）**で計画を確認 → 問題なければ本実行。

## 事前準備

- Entra アプリ（Application permissions）
  - 例: `Sites.FullControl.All` 等
  - 管理者同意付与
- GitHub Secrets
  - `AAD_TENANT_ID`, `AAD_APP_ID`, `SPO_RESOURCE`
  - 認証は以下いずれか
    - `SPO_CERT_BASE64` + `SPO_CERT_PASSWORD`（証明書）
    - `SPO_CLIENT_SECRET`（クライアントシークレット）

## ワークフロー入力

| 入力 | 既定値 | 説明 |
|------|--------|------|
| siteRelativeUrl | `/sites/welfare` | 対象サイト相対URL |
| schemaPath | `provision/schema.json` | スキーマパス |
| whatIf | `true` | ドライラン（変更なし） |
| applyFieldUpdates | `true` | 軽微メタ更新（型一致時） |
| forceTypeReplace | `false` | 型不一致時に `*_v2` 作成＋値コピー |
| recreateExisting | `false` | リスト削除→再作成（破壊的） |

## スキーマ書式

`displayName` / `internalName` / `type` は必須。以下はオプション: `addToDefaultView`, `description`, `required`, `enforceUnique`, `maxLength`, `choices`, `choicesPolicy`。

```json
{
  "lists": [
    {
      "title": "SupportRecord_Daily",
      "fields": [
        { "displayName": "記録日", "internalName": "cr013_recorddate", "type": "DateTime", "addToDefaultView": true },
        { "displayName": "特記事項", "internalName": "cr013_specialnote", "type": "Note", "addToDefaultView": true, "description": "自由記述", "required": false }
      ]
    }
  ]
}
```

### フィールドキー一覧

| キー | 型 | 説明 |
|------|----|------|
| displayName | string | 表示名 |
| internalName | string | 内部名（作成後は変更しない） |
| type | string | Text/Note/DateTime/Number/URL 等 |
| addToDefaultView | boolean | 既定ビューに追加 |
| description | string | 列の説明 |
| required | boolean | 必須 |
| enforceUnique | boolean | 一意制約（Text/Number/URL 等） |
| maxLength | number | 最大文字数（Text） |
| choices | string[] | Choice列の選択肢 |
| choicesPolicy | string | Choice の更新ポリシー (`additive`/`replace`) |
| lookupListTitle | string | Lookup 対象リストのタイトル (type=Lookup) |
| lookupField | string | Lookup 対象リストの参照列内部名 (既定 `Title`) |
| allowMultiple | boolean | 複数値許可 (User/Lookup) |
| principalType | string | User 列: `User` / `SecurityGroup` / `SharePointGroup` / `All` |
| choicesPolicy | string | `additive` (既定) / `replace`(将来用)。additive は不足だけ追加・削除しない |

## 手順フロー

1. `whatIf: true` で実行し差分確認
2. 問題なければ `whatIf: false` で本適用
3. 型不一致が許容される場合のみ `forceTypeReplace: true`（`*_v2` 作成）

## 型変更ポリシー

- SPO は列の型直接変更不可
- 回避策: 新列 `<internalName>_v2` 作成 → 値コピー → 新列利用
- 旧列は手動で後片付け可能

### 型差替え決定表 (Quick Matrix)
| 現在型 | 望む型 | forceTypeReplace=false | forceTypeReplace=true | データ影響 | 推奨 |
|--------|--------|------------------------|-----------------------|-----------|------|
| Text | Note | スキップ (警告) | `_v2` 作成+コピー | 大 (長文許容へ) | WhatIf で差分確認後 true |
| Note | Text | スキップ | `_v2` 作成+コピー | 文字数切捨て懸念 | 慎重 (要アーカイブ) |
| Text | Choice | スキップ | `_v2` + 手動再分類 | 中 | 事前クリーニング |
| Choice | Text | スキップ | `_v2` + 値コピー | 小 | 低リスク |
| Any | Lookup/User | スキップ | `_v2` + 手動再紐付け | 大 | 計画必須 |

### ロールバック手順 (簡易)
1. WhatIf JSON (`changes.json`) を保存 (事前スナップショット)
2. 本適用後、異常検知 (想定外列 / フィールド欠落 等)
3. 対象リストのみ: 旧列 `_v2` 生成前の列を再利用可能なら参照を戻す
4. 破壊的変更 (recreateExisting=true) を実行していた場合はバックアップ (手動エクスポート) からリスト再インポート
5. 必要に応じて Issue 化し再発防止 (schema review mandatory 化)


## 出力例（WhatIf）

```
List exists: SupportRecord_Daily
  - Add field: cr013_recorddate (DateTime)
Existing fields snapshot: SupportRecord_Daily
  - Title (Type=Text, Req=False, Unique=False, Title='Title')
```

## FAQ
### Lookup / User に関する注意
| 質問 | 回答 |
|------|------|
| Lookup の参照先が存在しない | その列はスキップし Summary に警告が出ます |
| allowMultiple を false→true にしたい | サポートされ再プロビジョンされます (WhatIf で確認) |
| true→false に戻したい | 破壊的変更のため自動変更せず警告のみ |
| principalType を変えたい | 既存列では XML 直接編集が必要な場合があり、現行は新規 *_v2 推奨 |

| 質問 | 回答 |
|------|------|
| 安全に試したい | `whatIf: true` を使う |
| 型不一致を解消したい | `forceTypeReplace: true` で `_v2` 移行 |
| 一意制約が付けられない | 既存重複データを除去 |
| 大量移行が遅い | 今後バッチ対応予定 |

## トラブルシュート

| 症状 | 原因候補 | 対処 |
|------|----------|------|
| 401/403 | 権限不足/同意なし | アプリ権限と管理者同意確認 |
| 列が作成されない | スキーマ誤り | `ValidateSchema` エラーメッセージ確認 |
| 一意制約失敗 | 重複値存在 | 重複除去後再実行 |

## 今後の拡張

## Choice 変更ポリシー詳細

- `additive`: スキーマにあるが現在ない選択肢のみ追加。既存にあってスキーマに無い選択肢は削除しない（Job Summary に `! Keep existing`）。
- `replace`: 現行スクリプトでは警告し、実際の挙動は additive と同じ（将来バージョンで置換対応予定）。
- 不要選択肢を排除したい場合は、データ影響を分析し手動クリーンアップ or 別列移行戦略を検討。

- JSON Schema + `Test-Json` バリデーション
- PR への差分コメント投稿
- Batch API による大量移行最適化
- Lookup / User フィールド高度設定

---

最終更新: 2025-09-23

## WhatIf 変更のレビュー手順（JSON アーティファクト）

1. GitHub Actions から `Provision SharePoint Lists` を `whatIf: true` で手動実行。
2. 実行完了後、Artifacts の **provision-changes** をダウンロード。
3. 展開した `provision/changes.json` をエディタ / jq で開き `summary.byKind` と個別 `changes[]` を確認。
4. 問題なければ再度 `whatIf: false` で本適用。

メモ:
- 本適用でも `-EmitChanges` を付ければ最新状態を JSON 化可能。
- CI の PR レビューでは差分を JSON で検証 → 承認後に本番適用、の運用が簡素化されます。

### JSON 構造（抜粋）
```jsonc
{
  "timestamp": "2025-09-23T12:34:56.789Z",
  "site": "https://tenant.sharepoint.com/sites/example",
  "whatIf": true,
  "summary": { "total": 12, "byKind": [ { "kind": "CreateList", "count": 1 } ] },
  "changes": [ "Create list: AuditLog", "  - Add field: status (Choice)" ]
}
```

---

## 拡張例: Choice / Lookup / User / entry_hash 設計サンプル

### Choice 例 (additive ポリシー)
```jsonc
{
  "displayName": "ステータス",
  "internalName": "status",
  "type": "Choice",
  "choices": ["New", "InProgress", "Closed"],
  "choicesPolicy": "additive",
  "addToDefaultView": true
}
```
初回実行後にスキーマへ `"Archived"` を追加すると WhatIf で:
```
Choices: + Add choices Archived (keep existing: New,InProgress,Closed)
```

### Lookup 例 (単一選択)
```jsonc
{
  "displayName": "関連記録",
  "internalName": "related_record",
  "type": "Lookup",
  "lookupListTitle": "SupportRecord_Daily",
  "lookupField": "Title",
  "allowMultiple": false
}
```
注意: 参照先リストが未作成の場合はスキップされ警告行が `changes` に追加されます。

### User 列 (複数可 / グループ許容)
```jsonc
{
  "displayName": "担当者",
  "internalName": "owners",
  "type": "User",
  "allowMultiple": true,
  "principalType": "All"  // User / SecurityGroup / SharePointGroup / All
}
```

### entry_hash 列 (冪等性用 Text)
プロビジョニングで一意制約列として追加するケース:
```jsonc
{
  "displayName": "entry_hash",
  "internalName": "entry_hash",
  "type": "Text",
  "enforceUnique": true,
  "maxLength": 128,
  "description": "監査イベントの冪等性キー (SHA-256 64hex)"
}
```
フロントエンド / Backfill スクリプトは canonical JSON (Title, Action, User, Timestamp, Details) をハッシュ化。

### 型差替え（Type Migration）フロー図
Mermaid 図で `forceTypeReplace` 有効時の分岐例:
```mermaid
flowchart TB
  A[既存列 取得] --> B{型一致?}
  B -- Yes --> C[メタ更新 (displayName/desc/choices etc)]
  B -- No --> D{forceTypeReplace?}
  D -- No --> E[Type mismatch ログ + スキップ]
  D -- Yes --> F[ *_v2 列作成 ] --> G[ 旧列値コピー best-effort ] --> H[ *_v2 列を利用開始 ]
```

### 運用 Tips
- Choice で不要選択肢を物理削除したい場合は `_v2` 移行 or 手動メンテを検討
- Lookup の allowMultiple 変更 (false→true) は安全 / true→false は破壊的で自動化しない
- User 列 principalType 変更は SharePoint 制約により再作成パターン推奨

---

## Backfill entry_hash (Smoke) ワークフロー概要

`Backfill entry_hash (Smoke)` ワークフローは既存 `Audit_Events` の空 / 未設定 `entry_hash` を後付与するための安全なドライラン + 本実行パスを提供します。

| 入力 | 説明 |
|------|------|
| siteRelativeUrl | 対象サイト相対パス |
| whatIf | true で書き込み無し (metrics の Updated は 0) |
| batchSize | 一括更新バッチサイズ |

WhatIf 実行 (推奨): アーティファクト `backfill-metrics` を確認し `Needed` 件数を把握 → 問題なければ `whatIf=false` で本実行。

`backfill-metrics.json` サンプル:
```jsonc
{
  "Site": "https://contoso.sharepoint.com/sites/welfare",
  "Needed": 124,
  "Updated": 0,
  "Duration": 1.84231,
  "Mode": "WHATIF",
  "BatchSize": 100,
  "Timestamp": "2025-09-23T10:22:11.120Z"
}
```

本実行後（`whatIf=false`）は Updated が Needed と一致していれば全補完完了。差異が残る場合はバッチサイズ調整や再実行を検討。


Trigger WhatIf smoke 2025-09-24T06:23:25Z.
Trigger Apply test 2025-09-24T09:23:59Z

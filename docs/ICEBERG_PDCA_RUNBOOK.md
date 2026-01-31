# Iceberg PDCA Runbook

本ドキュメントは「Iceberg PDCA」機能を **SharePoint（REST API）** で運用するための手順書です。  
開発（dev/app-test）から本番（welfare）への移行、疎通確認、よくあるエラーの対処までをまとめます。

---

## 1. 目的

- 利用者ごとの PDCA（PLAN/DO/CHECK/ACT）を SharePoint List に保存する
- 画面で一覧表示・作成・編集（削除は運用方針次第）を行う
- 本番ではログ出力・書き込み権限を抑制して事故を防ぐ

---

## 2. 前提

- SharePoint Site が存在する（例：`/sites/app-test` と `/sites/welfare`）
- List `Iceberg_PDCA` が存在する
- Azure AD / MSAL で SharePoint に対するトークンが取得できる（Read/Write スコープ）

---

## 3. 環境変数（重要）

### 必要な SharePoint リソース

| リスト名 | 用途 | 場所 |
|---------|------|------|
| `Iceberg_PDCA` | PDCA 記録 | `/sites/welfare` または `/sites/app-test` |
| `Users_Master` | 利用者マスター | 同一サイト |

### 列スキーマ（Iceberg_PDCA）

| 表示名 | 内部名 | 型 | 説明 |
|-------|--------|------|------|
| Title | Title | 1行テキスト | PDCA タイトル（必須） |
| UserID | UserID0 | 1行テキスト | 対象利用者 ID |
| Summary | Summary0 | 複数行テキスト | PDCA 概要・メモ |
| Phase | Phase0 | 選択肢 | PLAN / DO / CHECK / ACT |
| Created | Created | 日時 | 作成日時（自動） |
| Modified | Modified | 日時 | 更新日時（自動） |

⚠️ **注意**: `UserID0`, `Summary0`, `Phase0` は **内部名** です。SharePoint 側で列を作成する際、表示名と内部名がズレないよう確認してください（[確認方法](#シェアポイント側の検証)）。

---

## 環境別設定

### 開発環境（localhost:5173）

```bash
# .env.local
VITE_WRITE_ENABLED=1           # staff も作成可能にする
VITE_SP_SITE_RELATIVE=/sites/app-test
VITE_SP_SITE_URL=https://isogokatudouhome.sharepoint.com/sites/app-test
VITE_AUDIT_DEBUG=1             # デバッグログ出力（任意）
```

### 本番環境（welfare）

```bash
# .env.local / env ファイル
VITE_WRITE_ENABLED=0           # admin のみ書き込み
VITE_SP_SITE_RELATIVE=/sites/welfare
VITE_SP_SITE_URL=https://isogokatudouhome.sharepoint.com/sites/welfare
VITE_AUDIT_DEBUG=0             # ログ抑制
```

---

## 動作確認チェックリスト

### 1. 基本動作（全環境）

- [ ] `/analysis/iceberg-pdca` が表示される
- [ ] 利用者セレクタで利用者を選択可能
- [ ] Network でリクエストが 200 を返す（空一覧でも成功）

### 2. 書き込み権限確認

**admin ロール:**
- [ ] 作成フォームが表示される
- [ ] 作成→POST が 201 を返す
- [ ] 編集ボタンが表示される
- [ ] 更新→PATCH が 204 を返す

**staff ロール:**
- [ ] VITE_WRITE_ENABLED=1: フォーム表示 ✅
- [ ] VITE_WRITE_ENABLED=0: フォーム非表示 ✅

### 3. データ永続性

- [ ] 作成後、リロードでデータが残っている
- [ ] 更新後、Modified 日時が変わっている
- [ ] Phase が PLAN / DO / CHECK / ACT で正しく保存される

---

## よくあるエラーと対処

### 400 Bad Request（列が見つからない）

**症状**: POST/PATCH で 400 が返る

**原因**: SharePoint 列の内部名（InternalName）がズレている
- コードは `UserID0` / `Summary0` / `Phase0` を期待
- リスト側が `UserID` / `Summary` / `Phase` で作成されている

**対処**:
1. [SharePoint Fields API で確認](#シェアポイント側の検証)
2. ズレていたら **リスト列を作り直す**（内部名は後から変更できません）

### 404 Not Found（リスト見つからない）

**症状**: GET で 404

**原因**:
- `VITE_SP_SITE_RELATIVE` が間違っている
- Iceberg_PDCA リストが該当サイトにない

**対処**:
```bash
# 環境変数を確認
echo $VITE_SP_SITE_RELATIVE
echo $VITE_SP_SITE_URL

# 手動でリストにアクセス可能か確認
# https://isogokatudouhome.sharepoint.com/sites/welfare/Lists/Iceberg_PDCA
```

### 204 No Content で JSON パースエラー

**症状**: 更新時に "Unexpected end of JSON input"

**原因**: SharePoint が 204（ボディなし）を返す仕様。修正済み。

**対処**: キャッシュを削除してリロード（通常は自動回復）

### アクセス拒否（403）

**症状**: 任意のリクエストで 403

**原因**: ユーザーに SharePoint サイトへのアクセス権がない

**対処**:
1. SharePoint サイトの権限を確認
2. 該当ユーザーを Visitors / Members グループに追加

---

## SharePoint 側の検証

### 列の内部名を確認

```
GET https://isogokatudouhome.sharepoint.com/sites/{site}/
_api/web/lists/getbytitle('Iceberg_PDCA')/fields
?$select=Title,InternalName
```

**期待される応答**:
```json
{
  "value": [
    { "Title": "UserID", "InternalName": "UserID0" },
    { "Title": "Summary", "InternalName": "Summary0" },
    { "Title": "Phase", "InternalName": "Phase0" }
  ]
}
```

### リスト自体の存在確認

```
GET https://isogokatudouhome.sharepoint.com/sites/{site}/_api/web/lists/getbytitle('Iceberg_PDCA')
```

---

## 開発上のヒント

### debug ログを有効化

```bash
VITE_AUDIT_DEBUG=1
```

Console で以下が出力されます（dev のみ）:
- `[iceberg-pdca/pages] mounted { writeEnabled, ... }`
- `[iceberg-pdca] { role, isAdmin, canWrite, selectedUserId }`

### 権限テスト用

本番 (`VITE_WRITE_ENABLED=0`) でも staff に書き込みさせたい場合：

```bash
# 一時的に
VITE_WRITE_ENABLED=1
npm run dev
```

⚠️ 本番推進前に必ず `VITE_WRITE_ENABLED=0` に戻す

---

## 問い合わせ・トラブルシューティング

詳細は以下を参照:
- [migration ガイド](./checklists/iceberg-pdca-migration-app-test-to-welfare.md)
- [リスト スキーマ](./sharepoint/iceberg-pdca-list-schema.md)

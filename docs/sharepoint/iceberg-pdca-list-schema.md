# SharePoint: Iceberg_PDCA List Schema

本ドキュメントは SharePoint List `Iceberg_PDCA` の列定義と、InternalName の確認方法をまとめます.

---

## 1. 列一覧（期待）

| 表示名 (Title) | 用途 | 例 | InternalName（例） |
|---|---|---|---|
| Title | レコードタイトル（任意） | "test2" | Title |
| UserID | 利用者ID（文字列） | "U-001" | UserID0 |
| Summary | 要約（文字列/複数行） | "支援の要点…" | Summary0 |
| Phase | PDCAフェーズ（Choice/文字列） | "PLAN/DO/CHECK/ACT" | Phase0 |
| Created/Modified | 監査用 | - | Created/Modified |

> **重要:** SharePoint は、列を作り直したり同名列が存在した履歴があると、InternalName が `UserID0` のようにズレることがあります。  
> REST API の `$select/$filter/POST body` は **InternalName** が必須です。

---

## 2. InternalName の確認（fields API）

### 2.1 一覧で確認（推奨）

app-test の例：

https://isogokatudouhome.sharepoint.com/sites/app-test/_api/web/lists/getbytitle('Iceberg_PDCA')/fields?$select=Title,InternalName

welfare の例：

https://isogokatudouhome.sharepoint.com/sites/welfare/_api/web/lists/getbytitle('Iceberg_PDCA')/fields?$select=Title,InternalName

---

### 2.2 特定列だけ確認（例）

Summary（Title または InternalName が Summary のものを探す）：

…/_api/web/lists/getbytitle('Iceberg_PDCA')/fields?$select=Title,InternalName&$filter=Title eq 'Summary' or InternalName eq 'Summary'

Phase：

…/_api/web/lists/getbytitle('Iceberg_PDCA')/fields?$select=Title,InternalName&$filter=Title eq 'Phase' or InternalName eq 'Phase'

---

## 3. REST API 利用例

### 3.1 List items（GET）

例（UserID0 で絞り込み）：

…/_api/web/lists/getbytitle('Iceberg_PDCA')/items?$select=Id,Created,Modified,UserID0,Title,Summary0,Phase0&$filter=UserID0 eq 'U-001'&$orderby=Modified desc&$top=200

---

### 3.2 Create（POST 201）

Request URL：

…/_api/web/lists/getbytitle('Iceberg_PDCA')/items

Body（InternalName）：
```json
{
  "Title": "test2",
  "UserID0": "U-001",
  "Summary0": "test2",
  "Phase0": "DO"
}
```

---

### 3.3 Update（PATCH/MERGE 204）

SharePoint は更新で 204 No Content を返すことが多いです（空ボディ）。
- 204 でも成功扱いにする
- `res.json()` を無条件で呼ばない（空ボディ対応必須）

---

## 4. トラブルシュート

### 4.1 400: フィールドが存在しない

例：
- フィールドまたはプロパティ 'UserID' は存在しません。

→ InternalName が違う可能性が高い。fields API で確認して置換する。

---

## 5. メモ欄（本番確定値）

welfare site で最終確認した値を記録：
- UserID: ______________
- Summary: ______________
- Phase: ______________

（ここが埋まっていれば、将来の改修・移行が一気に楽になります）

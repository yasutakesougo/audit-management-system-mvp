# SharePoint × React 最強デバッグコマンド10

> **対象**: A班開発チーム全員
> **効果**: API原因調査 30分 → 2〜3分
> **前提**: ブラウザでテナントにログイン済み（MSAL認証トークン取得済み）

---

## 使い方

### ブラウザから直接叩く場合

```
https://{tenant}.sharepoint.com/sites/{site}/_api/web/lists/getbytitle('{ListName}')/...
```

Chrome で **JSON Viewer 拡張** を入れると結果が見やすくなります。

### アプリ内 DevTools Console から叩く場合

```js
// MSAL トークンを取得
const token = (await msalInstance.acquireTokenSilent({
  scopes: ['https://{tenant}.sharepoint.com/AllSites.Read'],
  account: msalInstance.getAllAccounts()[0],
})).accessToken;

// fetcher ヘルパー
const spFetch = (path) =>
  fetch(`https://{tenant}.sharepoint.com/sites/{site}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json;odata=nometadata',
    },
  }).then(r => r.json());
```

以降、`spFetch(path)` で結果を確認できます。

---

## ① 最小 SELECT（List生存確認）

**目的**: List がアクセス可能か、1秒で確認

```
/_api/web/lists/getbytitle('Users_Master')/items?$top=1&$select=Id
```

```js
await spFetch("/_api/web/lists/getbytitle('Users_Master')/items?$top=1&$select=Id")
```

| 結果 | 意味 |
|------|------|
| `{ value: [{ Id: 1 }] }` | ✅ 正常 |
| `404` | ❌ List が存在しない |
| `403` | 🔒 権限不足 |
| `401` | 🔒 トークン有効期限切れ |

> **使いどころ**: デプロイ直後、List が壊れていないかの第一チェック

---

## ② 全フィールド取得（InternalName 確認）

**目的**: テナントにあるフィールドの全貌を一発で掴む

```
/_api/web/lists/getbytitle('Users_Master')/items?$top=1&$select=*
```

```js
const item = await spFetch("/_api/web/lists/getbytitle('Users_Master')/items?$top=1&$select=*");
console.table(Object.entries(item.value[0]).map(([k,v]) => ({ field: k, value: v, type: typeof v })));
```

> **使いどころ**: `FIELD_MAP` に書く InternalName を確認したいとき

---

## ③ List フィールドスキーマ（最頻出）

**目的**: InternalName / TypeAsString / Required を一覧表示

```
/_api/web/lists/getbytitle('Users_Master')/fields?$filter=Hidden eq false&$select=InternalName,Title,TypeAsString,Required
```

```js
const fields = await spFetch("/_api/web/lists/getbytitle('Users_Master')/fields?$filter=Hidden eq false&$select=InternalName,Title,TypeAsString,Required");
console.table(fields.value.map(f => ({
  internal: f.InternalName,
  display: f.Title,
  type: f.TypeAsString,
  required: f.Required,
})));
```

| TypeAsString | JS送信型 | 注意 |
|-------------|---------|------|
| `Text` | `string` | |
| `Note` | `string` | 改行含む |
| `Number` | `number` | |
| `DateTime` | `string` (ISO) | `2025-01-15T00:00:00Z` |
| `Boolean` | `boolean` | |
| `Choice` | `string` | 選択肢の値そのまま |
| `Lookup` | `number` (ID) | ⚠️ ID で送信必須 |
| `User` | `number` (ID) | ⚠️ UserInfoList の ID |

> **使いどころ**: Step2 フィールド照合で `missing` が出たとき

---

## ④ Lookup 構造確認

**目的**: Lookup 列の参照先 List と参照先フィールドを特定

```
/_api/web/lists/getbytitle('Users_Master')/fields?$filter=TypeAsString eq 'Lookup'&$select=InternalName,Title,LookupList,LookupField
```

```js
const lookups = await spFetch("/_api/web/lists/getbytitle('Users_Master')/fields?$filter=TypeAsString eq 'Lookup'&$select=InternalName,Title,LookupList,LookupField");
console.table(lookups.value);
```

> **使いどころ**: POST 時に `"Value does not fall within the expected range"` が出たとき
> `LookupList` の GUID から参照先 List を特定 → 有効な ID を確認

---

## ⑤ 最新レコード取得

**目的**: データが実際に入っているか、最新レコードを確認

```
/_api/web/lists/getbytitle('DailyActivityRecords')/items?$orderby=Modified desc&$top=3&$select=Id,UserCode,RecordDate,Modified
```

```js
const recent = await spFetch("/_api/web/lists/getbytitle('DailyActivityRecords')/items?$orderby=Modified desc&$top=3&$select=Id,UserCode,RecordDate,Modified");
console.table(recent.value);
```

> **使いどころ**: 「データが保存されない」報告があったとき
> `Modified` を見て直近の書き込みを確認

---

## ⑥ 特定 ID 取得

**目的**: Create / Update したレコードをピンポイントで確認

```
/_api/web/lists/getbytitle('Handoff')/items(42)?$select=Id,Title,Message,Status,Modified
```

または filter 構文:

```
/_api/web/lists/getbytitle('Handoff')/items?$filter=Id eq 42&$select=*
```

```js
const item = await spFetch("/_api/web/lists/getbytitle('Handoff')/items(42)?$select=*");
console.log(JSON.stringify(item, null, 2));
```

> **使いどころ**: Step4 CRUD テストで Create したアイテムの中身を確認

---

## ⑦ 条件検索（$filter）

**目的**: 特定条件のレコードを絞り込む

```
/_api/web/lists/getbytitle('Handoff')/items?$filter=Status eq '未対応'&$top=5&$select=Id,Title,Status,Created
```

### よく使う filter パターン

| パターン | 構文 |
|---------|------|
| 文字列一致 | `$filter=Status eq '未対応'` |
| 数値比較 | `$filter=Id gt 100` |
| 日付範囲 | `$filter=RecordDate ge '2025-01-01' and RecordDate le '2025-01-31'` |
| NULL チェック | `$filter=UserCode ne null` |
| 部分一致 | `$filter=substringof('テスト', Title)` |

```js
const filtered = await spFetch("/_api/web/lists/getbytitle('Handoff')/items?$filter=Status eq '\u672a\u5bfe\u5fdc'&$top=5&$select=Id,Title,Status");
console.table(filtered.value);
```

> **使いどころ**: 特定ユーザー・特定日付のデータが正しく保存されているか確認

---

## ⑧ Lookup 展開（$expand）

**目的**: Lookup / User 列のオブジェクト情報を取得

```
/_api/web/lists/getbytitle('DailyActivityRecords')/items?$top=1&$select=Id,Author/Title,Author/EMail&$expand=Author
```

```js
const expanded = await spFetch("/_api/web/lists/getbytitle('DailyActivityRecords')/items?$top=1&$select=Id,Author/Title,Author/EMail&$expand=Author");
console.log(expanded.value[0].Author);
// → { Title: "山田太郎", EMail: "yamada@tenant.onmicrosoft.com" }
```

### 注意点

| ルール | 理由 |
|--------|------|
| `$select` に `Author/Title` のように子プロパティを指定 | 抜けると odata エラー |
| `$expand=Author` がないと展開されない | Lookup はデフォルトで ID のみ |
| Person 列は `Author` ではなく `AuthorId` で POST | 書き込みは ID を使う |

> **使いどころ**: ユーザー名やメール等を一緒に表示したいとき

---

## ⑨ ページング（$top + @odata.nextLink）

**目的**: 大量データの全件取得

```
/_api/web/lists/getbytitle('Users_Master')/items?$top=200&$select=Id,FullName
```

```js
// 全件取得ヘルパー
async function fetchAll(path) {
  const results = [];
  let url = path;
  while (url) {
    const data = await spFetch(url);
    results.push(...(data.value || []));
    // @odata.nextLink があれば次ページ
    url = data['odata.nextLink'] || data['@odata.nextLink'] || null;
  }
  console.log(`Total: ${results.length} items`);
  return results;
}

const allUsers = await fetchAll("/_api/web/lists/getbytitle('Users_Master')/items?$top=200&$select=Id,FullName");
```

### ページングの仕様

| 設定 | 値 |
|------|-----|
| SharePoint デフォルト `$top` | 100 |
| 最大 `$top` | 5000 |
| ページキー | `@odata.nextLink` (またはレスポンス内の `odata.nextLink`) |
| 推奨 `$top` | 200〜500（メモリとのバランス） |

> **使いどころ**: 「全ユーザー一覧が途中で切れている」等のバグ調査

---

## ⑩ List メタ情報取得（EntityType 他）

**目的**: POST に必要な `ListItemEntityTypeFullName` を取得

```
/_api/web/lists/getbytitle('Handoff')?$select=Title,Id,ItemCount,ListItemEntityTypeFullName,Created
```

```js
const meta = await spFetch("/_api/web/lists/getbytitle('Handoff')?$select=Title,Id,ItemCount,ListItemEntityTypeFullName,Created");
console.log({
  title: meta.Title,
  itemCount: meta.ItemCount,
  entityType: meta.ListItemEntityTypeFullName,
  created: meta.Created,
});
// → { entityType: "SP.Data.HandoffListItem", itemCount: 42, ... }
```

### POST テンプレート（Create）

```js
const entityType = meta.ListItemEntityTypeFullName;

const createResp = await fetch(
  `https://{tenant}.sharepoint.com/sites/{site}/_api/web/lists/getbytitle('Handoff')/items`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json;odata=nometadata',
      Accept: 'application/json;odata=nometadata',
    },
    body: JSON.stringify({
      __metadata: { type: entityType },
      Title: 'テスト引継ぎ',
      Message: 'Console から作成',
      Status: '未対応',
    }),
  }
);
const created = await createResp.json();
console.log('Created Id:', created.Id);
```

> **使いどころ**: Step4 で Create が 400 エラーになるとき、まず EntityType が正しいか確認

---

## 🔥 トラブルシューティング逆引き表

| エラー | 原因 | 使うコマンド |
|--------|------|-------------|
| `404 Not Found` | List 名が違う / List が存在しない | ① 最小 SELECT |
| `403 Forbidden` | 権限不足 | ① 最小 SELECT |
| `Field or property 'Xxx' does not exist` | InternalName が違う | ③ フィールドスキーマ |
| `Value does not fall within the expected range` | Lookup ID が無効 | ④ Lookup 構造 → ⑥ 参照先確認 |
| `400 Bad Request` (POST時) | Required 列の欠落 / 型不一致 | ③ Required 一覧 → ⑩ EntityType |
| `データが途中で切れる` | ページング未実装 | ⑨ ページング |
| `Column not found` ($orderby) | InternalName の typo | ② 全フィールド取得 |
| `User not found` | Person 列に名前を送っている | ④ Lookup 構造（User = Lookup） |

---

## 🛠 プロジェクト固有のショートカット

本プロジェクトの主要リスト用コピペテンプレート:

```js
// Users_Master
spFetch("/_api/web/lists/getbytitle('Users_Master')/items?$top=3&$select=Id,UserID,FullName,UserCode")

// Staff_Master
spFetch("/_api/web/lists/getbytitle('Staff_Master')/items?$top=3&$select=Id,StaffId,StaffName,Role")

// DailyActivityRecords
spFetch("/_api/web/lists/getbytitle('DailyActivityRecords')/items?$orderby=Modified desc&$top=3&$select=Id,UserCode,RecordDate,TimeSlot")

// Handoff
spFetch("/_api/web/lists/getbytitle('Handoff')/items?$orderby=Created desc&$top=3&$select=Id,Title,Message,Status,Category")

// Attendance_Daily
spFetch("/_api/web/lists/getbytitle('Attendance_Daily')/items?$top=3&$select=Id,UserCode,RecordDate,Status")

// Staff_Attendance
spFetch("/_api/web/lists/getbytitle('Staff_Attendance')/items?$top=3&$select=Id,StaffId,RecordDate,Status")

// Schedules
spFetch("/_api/web/lists/getbytitle('Schedules')/items?$top=3&$select=Id,Title,EventDate,Category")
```

---

## 📊 検証ツールとの連携

| デバッグコマンド | 対応する検証ステップ |
|-----------------|---------------------|
| ① 最小 SELECT | Step1: リスト存在確認 |
| ③ フィールドスキーマ | Step2: フィールド照合 |
| ② 全フィールド取得 | Step3: SELECT 検証 |
| ⑩ EntityType + POST | Step4: CRUD 確認 |

`/admin/debug/opening-verification` の結果と組み合わせて使うと最速で原因特定できます。

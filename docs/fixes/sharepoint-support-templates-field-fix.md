# SharePoint SupportTemplates フィールド名修正ドキュメント

## 問題の概要

SharePoint リスト "SupportTemplates" への GET リクエストが 500 エラーを返す。
エラー詳細: **「列 'userCode' が存在しません」**

### 原因

SharePoint Fields API で取得した実際の内部名と、コード内で使用していた名前が一致していない。

| コード内で使用 | 実際の内部名 | 状態 |
|---------------|-------------|------|
| `userCode`    | `UserCode0` | ❌ NG |
| `rowNo`       | `RowNo0`    | ❌ NG |
| `timeSlot`    | `TimeSlot0` | ❌ NG |
| `activity`    | `Activity0` | ❌ NG |
| `personManual`    | `PersonManual0` | ❌ NG |
| `supporterManual` | `SupporterManual0` | ❌ NG |

## 修正内容

### 1. src/sharepoint/fields.ts に正しいフィールドマップを追加

#### Before (修正前)
```typescript
// SupportTemplates 用のフィールドマップが存在しない
// コード内で直接 'userCode', 'rowNo' などをハードコードしていた可能性
```

#### After (修正後)
```typescript
export const FIELD_MAP_SUPPORT_TEMPLATES = {
  id: 'Id',
  title: 'Title',
  userCode: 'UserCode0',        // ✅ 正しい内部名
  rowNo: 'RowNo0',              // ✅ 正しい内部名
  timeSlot: 'TimeSlot0',        // ✅ 正しい内部名
  activity: 'Activity0',        // ✅ 正しい内部名
  personManual: 'PersonManual0',        // ✅ 正しい内部名
  supporterManual: 'SupporterManual0',  // ✅ 正しい内部名
  created: 'Created',
  modified: 'Modified',
} as const;
```

### 2. SharePointProcedureTemplateRepository の作成

新しいリポジトリファイル: `src/features/daily/infra/SharePointProcedureTemplateRepository.ts`

#### 正しい使用例

```typescript
import { FIELD_MAP_SUPPORT_TEMPLATES } from '@/sharepoint/fields';

// ✅ 正しい: フィールドマップ経由で内部名を取得
const filter = `${FIELD_MAP_SUPPORT_TEMPLATES.userCode} eq 'I001'`;
// 結果: "UserCode0 eq 'I001'"

const orderby = FIELD_MAP_SUPPORT_TEMPLATES.rowNo;
// 結果: "RowNo0"
```

## 動作確認手順（3ステップ）

### Step 1: SharePoint Fields API で内部名を確認

```bash
GET https://{tenant}.sharepoint.com/sites/{site}/_api/web/lists/getbytitle('SupportTemplates')/fields?$select=InternalName,Title
```

### Step 2: リスト項目を取得（200 OK を確認）

```bash
GET https://{tenant}.sharepoint.com/sites/{site}/_api/web/lists/getbytitle('SupportTemplates')/items?$select=Id,Title,UserCode0,RowNo0,TimeSlot0,Activity0&$filter=UserCode0 eq 'I001'&$orderby=RowNo0 asc
```

### Step 3: アプリケーションで動作確認

```typescript
import { createSupportTemplateRepository } from '@/features/daily/infra/SharePointProcedureTemplateRepository';

const repo = createSupportTemplateRepository(acquireToken);
const templates = await repo.getTemplatesByUser('I001');
console.log('テンプレート取得成功:', templates.length, '件');
```

## 検証用 API URL

```
GET https://isogokatudouhome.sharepoint.com/sites/welfare/_api/web/lists/getbytitle('SupportTemplates')/items
  ?$select=Id,Title,UserCode0,RowNo0,TimeSlot0,Activity0,PersonManual0,SupporterManual0
  &$filter=UserCode0 eq 'I001'
  &$orderby=RowNo0 asc
  &$top=100
```

上記 URL にアクセスして **HTTP 200** が返れば修正成功です。

## 影響範囲

### 直接影響
- **src/sharepoint/fields.ts**: FIELD_MAP_SUPPORT_TEMPLATES の追加
- **src/features/daily/infra/SharePointProcedureTemplateRepository.ts**: 新規作成

### データ取得への影響
1. 支援手順テンプレートの取得が正常動作
2. UserCode によるフィルタリングが正常動作  
3. RowNo による並び替えが正常動作

### UI 表示への影響
1. daily/support ページでテンプレートが正しく表示
2. 手順の順序が RowNo 順で正しく表示
3. テンプレート管理画面でフィルタリングが動作

## まとめ

| 項目 | 変更前 | 変更後 |
|------|--------|--------|
| フィールド名 | `userCode`, `rowNo` | `UserCode0`, `RowNo0` |
| エラー | 500: 列が存在しません | 200 OK |
| $filter | 失敗 | 成功 |
| $orderby | 失敗 | 成功 |
| データ取得 | 不可 | 可能 |

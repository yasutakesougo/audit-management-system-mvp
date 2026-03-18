# SharePoint: Handoffs List Schema Design

本ドキュメントは、監査対応MVPアプリにおける「申し送り（Handoff）」データをSharePointリストとして管理するための設計定義です。
MonitoringMeetingsの実装パターンに準拠し、LocalからSharePointへの切り替えをスムーズに行えるように設計されています。

## 1. 基本情報

- **リストの表示名 (Title)**: `Handoffs`
- **リストの内部名 (Name)**: `Handoffs`
- **用途**: 日々の申し送り事項（対象者指定と全体共有の両方）、重要度、既読状態の記録・管理。

## 2. フィールド一覧 (List Columns)

| 表示名 (DisplayName) | 内部名 (InternalName) | 型 (Type) | 必須 (Required) | 一意性 / 制限 / 備考 |
|---|---|---|---|---|
| タイトル (Title) | `Title` | Text | `TRUE` | `[userId]_{targetDate}_{priority}` の形式。レコードの検索・一覧時のプレビュー用途。 |
| Record ID | `cr015_recordId` | Text | `TRUE` | **Index=TRUE**, **EnforceUniqueValues=TRUE**。UUID等のユニークキー。REST APIのキーとしても利用。 |
| User ID | `cr015_userId` | Text | `FALSE` | 対象者指定がある場合のみ設定（無しの場合は「全体共有」として扱う）。 |
| 対象日 | `cr015_targetDate` | Text | `TRUE` | **Index=TRUE**。`YYYY-MM-DD` 形式。日付でのフィルタリングに使用。一覧画面での読み込み単位。 |
| 本文 | `cr015_content` | Note | `TRUE` | 複数行テキスト (Plain text)。実際の申し送り内容。 |
| 優先度 | `cr015_priority` | Text | `TRUE` | `normal`, `high`, `emergency` のいずれかが入る（運用時はChoiceではなくTextで受け取る方が拡張性が高く安全）。 |
| ステータス | `cr015_status` | Text | `TRUE` | `unread`, `read` のいずれか。既読化の判定に利用。 |
| 記録者名 | `cr015_reporterName` | Text | `TRUE` | 申し送りを記載した職員の名称（文字列）。 |
| 記録日時 | `cr015_recordedAt` | Text | `TRUE` | ISO8601形式のタイムスタンプ。申し送りの作成日時。 |

*※ SharePointの運用上、内部名の競合や予約語を避けるため、プレフィックス(`cr015_`)を付けて一意性を持たせます。*

## 3. インデックス・制約設計

| フィールド名 | 設定要件 | 理由 |
|---|---|---|
| `cr015_recordId` | `Indexed="TRUE" EnforceUniqueValues="TRUE"` | GET by ID, UPDATE, DELETE時のキーとして確実に 1レコードを特定するため。 |
| `cr015_targetDate` | `Indexed="TRUE"` | Dashboardや `/today` 画面で「指定した日付の申し送りのみ」を `OData $filter` で高速に取り出すため。 |

## 4. OData API 呼び出し例 (CRUD)

### 4.1. 一覧取得 (Get Handoffs by Date)
特定の日の申し送りを取得し、全体や特定ユーザー向けの情報を一覧表示します。
```http
GET /_api/web/lists/getbytitle('Handoffs')/items?$select=Id,Title,cr015_recordId,cr015_userId,cr015_targetDate,cr015_content,cr015_priority,cr015_status,cr015_reporterName,cr015_recordedAt&$filter=cr015_targetDate eq '2026-03-18'&$orderby=cr015_status desc, cr015_priority desc
```

### 4.2. 作成 (Create)
```json
// POST /_api/web/lists/getbytitle('Handoffs')/items
{
  "Title": "U-1122_2026-03-18_high",
  "cr015_recordId": "hnd-uuid-1234",
  "cr015_userId": "U-1122",
  "cr015_targetDate": "2026-03-18",
  "cr015_content": "午後からの活動時、少し疲れが見られました。様子を見てください。",
  "cr015_priority": "high",
  "cr015_status": "unread",
  "cr015_reporterName": "鈴木 職員",
  "cr015_recordedAt": "2026-03-18T10:00:00.000Z"
}
```

### 4.3. 更新 (Mark as Read / Update)
既読（`status = 'read'`）への変更など。Idではなく `cr015_recordId` でアイテムを特定し PATCH します。
```json
// PATCH /_api/web/lists/getbytitle('Handoffs')/items(SP_Item_ID)
// IF-MATCH: *
{
  "cr015_status": "read"
}
```

## 5. Field Map (TS側 アプリケーションとのマッピング)

`src/features/handoff/sp/handoffSpSchema.ts` のような場所で、以下のマッピング定義を記述します。

```typescript
export const HandoffSpColumns = {
  recordId: 'cr015_recordId',
  userId: 'cr015_userId',
  targetDate: 'cr015_targetDate',
  content: 'cr015_content',
  priority: 'cr015_priority',
  status: 'cr015_status',
  reporterName: 'cr015_reporterName',
  recordedAt: 'cr015_recordedAt',
} as const;
```

これにより、アプリケーション内で SharePoint の内部名変更に振り回されずに堅牢なデータ変換（DTO ⇆ Entity）が可能になります。

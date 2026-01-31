# Staff_Attendance リスト セットアップ（Phase 3.3-C）

## 目的

SharePoint Online の Staff_Attendance リストを **安全に作成/補完** し、アプリの勤怠管理を SharePoint で動かすための最短手順。

- DRY_RUN 既定で **破壊的変更なし**
- 足りない列だけ追加（型不一致は警告ログのみ）

---

## 事前準備

- SharePoint サイト URL（例: `https://<tenant>.sharepoint.com/sites/app-test`）
- 認証: `SP_TOKEN` もしくは `az` CLI ログイン済み

---

## Step 1: DRY_RUN（安全確認）

```bash
SITE_URL="https://<tenant>.sharepoint.com/sites/app-test" \
LIST_TITLE="Staff_Attendance" \
DRY_RUN=true \
npm run sp:setup:staff-attendance
```

期待されるログ:
- `list exists` もしくは `would create list`
- `Missing fields → would add:` のみ（変更は入らない）

---

## Step 2: 実適用（作成/不足列追加）

```bash
SITE_URL="https://<tenant>.sharepoint.com/sites/app-test" \
LIST_TITLE="Staff_Attendance" \
DRY_RUN=false \
npm run sp:setup:staff-attendance
```

期待されるログ:
- リストがなければ作成
- 足りない列だけ追加
- 型不一致は WARN でスキップ（破壊的変更なし）

---

## Step 3: SharePoint UI で確認

- `Staff_Attendance` リストを開く
- 以下の列が見えていること
  - `StaffId`, `RecordDate`, `Status`, `Note`, `CheckInAt`, `CheckOutAt`, `LateMinutes`

---

## Step 4: アプリ側の切替（app-test）

`.env.local` などに追加:

```
VITE_STAFF_ATTENDANCE_STORAGE=sharepoint
VITE_SP_SITE_URL=https://<tenant>.sharepoint.com/sites/app-test
```

UI確認:
- `/admin/staff-attendance`
- 1件編集（upsert）
- bulk 編集（status/checkInAt 上書き、note 空なら保持）

---

## 実行例ログ（app-test）

### DRY_RUN=true（変更なし）

```
> audit-management-system-mvp@0.1.0 sp:setup:staff-attendance
> node --import tsx scripts/sp/setupStaffAttendanceList.ts

[sp-setup] ✅ List exists: Staff_Attendance
[sp-setup] 📝 DRY_RUN: Missing fields → would add:
  - StaffId (Text)
  - RecordDate (DateTime)
  - Status (Choice)
  - CheckInAt (DateTime)
  - CheckOutAt (DateTime)
  - LateMinutes (Number)
  - Note (Note)
```

### APPLY（DRY_RUN=false）

```
> audit-management-system-mvp@0.1.0 sp:setup:staff-attendance
> node --import tsx scripts/sp/setupStaffAttendanceList.ts

[sp-setup] ✅ List exists: Staff_Attendance
[sp-setup] ➕ Adding field: StaffId (Text)
[sp-setup] Failed to add field StaffId. status=400 {"error":{"code":"-1, Microsoft.Data.OData.ODataException","message":{"lang":"ja-JP","value":"プロパティ 'AddToDefaultView' は型 'SP.XmlSchemaFieldCreationInformation' に存在しません。型で定義されているプロパティ名のみ使用してください。"}}}
```

### IDEMPOTENT（2回目実行）

```
> audit-management-system-mvp@0.1.0 sp:setup:staff-attendance
> node --import tsx scripts/sp/setupStaffAttendanceList.ts

[sp-setup] ✅ List exists: Staff_Attendance
[sp-setup] ➕ Adding field: StaffId (Text)
```

---

## Troubleshooting

### 400: AddToDefaultView エラー

```
プロパティ 'AddToDefaultView' は型 'SP.XmlSchemaFieldCreationInformation' に存在しません。
```

**原因**: `createfieldasxml` では `AddToDefaultView` が受け付けられない場合がある

**対処**: `SchemaXml` のみ送信する（`AddToDefaultView` を除去）

---

## 参考

- スクリプト: [scripts/sp/setupStaffAttendanceList.ts](../../scripts/sp/setupStaffAttendanceList.ts)
- フィールド定義: [src/sharepoint/fields.ts](../../src/sharepoint/fields.ts)

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

## 参考

- スクリプト: [scripts/sp/setupStaffAttendanceList.ts](../../scripts/sp/setupStaffAttendanceList.ts)
- フィールド定義: [src/sharepoint/fields.ts](../../src/sharepoint/fields.ts)

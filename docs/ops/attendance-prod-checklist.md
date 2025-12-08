# Attendance 本番モードチェックリスト

Attendance（通所実績）機能を SharePoint + 認証ありで動かす際のチェックリストです。
対象ページ: `/daily/attendance`

---

## 1. 前提確認

- [ ] レポジトリが最新の `main` 相当
- [ ] `docs/design/attendance.md` を確認し、データモデルと列マッピング案を把握
- [ ] ローカルで `npm run dev:attendance` による UI 起動ができている（5176）

---

## 2. Entra ID 設定（必要なら）

- [ ] SPA アプリ登録済み（Schedules と同一アプリでも可）
- [ ] Redirect URI に `http://localhost:5176/auth/callback` を追加（本番ドメインがあれば併記）
- [ ] SharePoint 委任スコープ（例: `AllSites.Read` / 必要なら `AllSites.Manage`）を追加し、管理者同意を実行

---

## 3. SharePoint 設定

- [ ] サイト URL / Resource / SiteRelative が `.env.local` と一致
- [ ] リスト `Daily_Attendance` を作成済み
- [ ] 列が揃っている（内部名ベース。詳細は `docs/design/attendance.md`）
  - `Title` (text)
  - `RecordDate` (date)
  - `UserIdId` (lookup: Users_Master)
  - `AttendanceStatus` (choice/text)
  - `AttendInCount` (number)
  - `AttendOutCount` (number)
  - `CheckInTime` / `CheckOutTime` (datetime)
  - `ProvidedMinutes` (number)
  - `TransportTo` / `TransportFrom` (bool)
  - `IsEarlyLeave` (bool)
  - `AbsentMorningContacted` (bool)
  - `AbsentMorningMethod` (choice/text)
  - `EveningChecked` (bool)
  - `EveningNote` (text)
  - `IsAbsenceAddonClaimable` (bool)
  - `UserConfirmedAt` (datetime)
  - `Notes` (text)
  - `@odata.etag` / `Created` / `Modified` (既定)

---

## 4. .env.local（本番相当例）

```bash
VITE_FORCE_SHAREPOINT=1
VITE_SKIP_LOGIN=0
VITE_SP_RESOURCE=https://<tenant>.sharepoint.com
VITE_SP_SITE_RELATIVE=/sites/<siteName>
VITE_SP_BASE_URL=https://<tenant>.sharepoint.com/sites/<siteName>
VITE_SP_LIST_ATTENDANCE=Daily_Attendance
VITE_ATTENDANCE_DISCREPANCY_THRESHOLD=0.8
VITE_ABSENCE_MONTHLY_LIMIT=3
VITE_FACILITY_CLOSE_TIME=17:30
# MSAL
VITE_MSAL_CLIENT_ID=<Application (client) ID>
VITE_MSAL_TENANT_ID=<Directory (tenant) ID>
VITE_MSAL_REDIRECT_URI=http://localhost:5176/auth/callback
VITE_LOGIN_SCOPES=openid profile
VITE_MSAL_SCOPES=https://<tenant>.sharepoint.com/AllSites.Read
VITE_SP_SCOPE_DEFAULT=https://<tenant>.sharepoint.com/AllSites.Read
```

チェック:

- [ ] `VITE_FORCE_SHAREPOINT=1` / `VITE_SKIP_LOGIN=0`
- [ ] MSAL の ClientId/TenantId が Entra と一致
- [ ] SITE/RESOURCE/SCOPES が実環境と一致

---

## 5. 動作確認手順（本番相当）

1. dev 起動（5176 固定）

```bash
npm run dev:attendance
```

1. ログイン → `/daily/attendance` に遷移

- [ ] ProtectedRoute 経由でサインインを要求
- [ ] トークン取得エラーが出ていない

1. UI 挙動

- [ ] 指定日の通所行が表示される（データがある場合）
- [ ] 出席 / 欠席 / 送迎フラグの入力ができる
- [ ] 乖離アラートや欠席加算フラグが期待通りに変化する（実装済み範囲で）

---

## 6. テスト

- [ ] `npm run test:attendance:mini` がローカルで PASS
- [ ] 必要に応じて E2E: `tests/e2e/attendance.basic.spec.ts`, `tests/e2e/attendance.record.spec.ts`

---

## 7. ロールアウトメモ

- ステージングで 1〜6 を実施後、本番の `.env` に反映。
- Schedules との突合（欠席加算/乖離）を運用手順に記載。
- 国保連 CSV 出力（将来実装）時は Attendance を単一真実ソースとする。

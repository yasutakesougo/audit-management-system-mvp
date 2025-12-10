# Daily Support Records 本番モードチェックリスト

対象ページ: `/daily/support`（TimeBased/TimeFlow 記録）

---

## 1. 前提確認

- [ ] レポジトリが最新の `main` 相当
- [ ] `docs/design/daily-support-records.md` を確認済み（SP マッピング / Schedules・Attendance 連携）
- [ ] ローカルで `npm run dev:daily` が起動できる（5177）

---

## 2. Entra ID 設定（必要に応じて）

- [ ] SPA アプリ登録済み（既存アプリを流用しても可）
- [ ] Redirect URI に `http://localhost:5177/auth/callback` を追加（本番ドメインがあれば併記）
- [ ] SharePoint 委任スコープ（例: `AllSites.Read` / 必要なら `AllSites.Manage`）を追加し、管理者同意済み

---

## 3. SharePoint 設定

- [ ] サイト URL / Resource / SiteRelative が `.env.local` と一致
- [ ] リスト `SupportRecord_Daily` を作成済み
- [ ] 列が揃っている（内部名ベース。詳細は design doc）
  - `Title`
  - `cr013_personId`
  - `cr013_date`
  - `cr013_status`
  - `cr013_reporterName`
  - `cr013_reporterId`
  - `cr013_draftJson`
  - `cr013_payload`
  - `cr013_kind`
  - `cr013_group`
  - `Created` / `Modified` / `Id`

---

## 4. .env.local（本番相当例）

```bash
VITE_FORCE_SHAREPOINT=1
VITE_SKIP_LOGIN=0
VITE_SP_RESOURCE=https://<tenant>.sharepoint.com
VITE_SP_SITE_RELATIVE=/sites/<siteName>
VITE_SP_BASE_URL=https://<tenant>.sharepoint.com/sites/<siteName>
VITE_SP_LIST_DAILY=SupportRecord_Daily
# MSAL
VITE_MSAL_CLIENT_ID=<Application (client) ID>
VITE_MSAL_TENANT_ID=<Directory (tenant) ID>
VITE_MSAL_REDIRECT_URI=http://localhost:5177/auth/callback
VITE_LOGIN_SCOPES=openid profile
VITE_MSAL_SCOPES=https://<tenant>.sharepoint.com/AllSites.Read
VITE_SP_SCOPE_DEFAULT=https://<tenant>.sharepoint.com/AllSites.Read
```

チェック:

- [ ] `VITE_FORCE_SHAREPOINT=1` / `VITE_SKIP_LOGIN=0`
- [ ] MSAL ClientId/TenantId が Entra と一致
- [ ] SITE/RESOURCE/SCOPES が実環境と一致

---

## 5. 動作確認手順（本番相当）

1. dev 起動（5177）

```bash
npm run dev:daily
```

1. ログイン → `/daily/support` に遷移

- [ ] ProtectedRoute 経由でサインインを要求
- [ ] トークン取得エラーが出ていない

1. UI 挙動

- [ ] 指定日の記録が読み込まれる（デモデータ or SP データ）
- [ ] 新規記録の作成/更新ができる（TimeBased or TimeFlow）
- [ ] 下書き保存と完了状態が区別できる

---

## 6. テスト

- [ ] `npm run test:daily:mini` がローカルで PASS
- [ ] 必要に応じて UI テスト（`src/features/daily/__tests__/*.test.tsx`）を実行

---

## 7. ロールアウトメモ

- ステージングで 1〜6 を踏んでから本番に `.env` を反映。
- Attendance の欠席日は記録を抑止する/注意文を出す運用を決める。
- PDF/CSV 出力を使う場合は、`cr013_payload` のスキーマとテンプレートを同期する。

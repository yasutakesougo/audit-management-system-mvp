# Schedules 本番モードチェックリスト

Schedules（通所スケジュール）機能を **SharePoint + 認証あり** で有効化する際のチェックリストです。

- 対象ページ: `/schedules/week`（将来的に `/schedules/day`, `/schedules/month` も想定）
- 想定環境: Entra ID + SharePoint Online + Vite 環境変数

---

## 1. 前提確認

- [ ] レポジトリを最新の `main` に更新している
- [ ] `docs/design/schedules.md` を一度目を通し、データモデル／フラグの概要を理解している
- [ ] ローカル開発で `npm run dev:schedules` により UI 確認ができている

---

## 2. Entra ID（Azure AD）設定

1. **アプリ登録**

- [ ] Entra ID で SPA アプリ登録済み
- [ ] `Application (client) ID` と `Directory (tenant) ID` を控えている
  - 例: `VITE_MSAL_CLIENT_ID=...` / `VITE_MSAL_TENANT_ID=...`

1. **リダイレクト URI**

- [ ] Authentication → SPA redirect URIs に以下を登録済み
  - [ ] `http://localhost:5175/auth/callback`（ローカル dev 用）
  - （本番ホストが決まっていれば）`https://<本番ドメイン>/auth/callback`

1. **API 権限（SharePoint）**

- [ ] `SharePoint` の委任スコープを追加済み（例: `AllSites.Read` / 必要に応じて `AllSites.Manage`）
- [ ] 「管理者の同意」を実行済みで「admin consented」が表示されている

---

## 3. SharePoint 設定

1. **サイト URL の確認**

- [ ] サイト URL: `https://isogokatudouhome.sharepoint.com/sites/welfare`
- [ ] `.env.local` と一致している
  - [ ] `VITE_SP_RESOURCE=https://isogokatudouhome.sharepoint.com`
  - [ ] `VITE_SP_SITE_RELATIVE=/sites/welfare`
  - [ ] `VITE_SP_BASE_URL=https://isogokatudouhome.sharepoint.com/sites/welfare`

1. **リスト `ScheduleEvents` の確認**

- [ ] リスト名 `ScheduleEvents` が存在する
  - [ ] 必要な列が揃っている（内部名ベース。詳細は `docs/design/schedules.md` 参照）
    - 共通: `Title`, `EventDate`, `EndDate`, `Status`, `cr014_category`, `cr014_dayKey`, `cr014_fiscalYear`, `Notes`/`Note`, `LocationName`/`Location`, `AllDay`(任意), `RRule`/`RecurrenceData`(任意)
    - 利用者: `ServiceType` + `cr014_serviceType`, `cr014_personType`, `cr014_personId`, `cr014_personName`, `TargetUserId` Lookup (Users), `cr014_externalPersonName`/`Org`/`Contact`, `cr014_staffIds`/`cr014_staffNames`, `AssignedStaffId`
    - 組織: `SubType`, `cr014_orgAudience`, `cr014_resourceId`, `ExternalOrgName`
    - 職員: `SubType`, `cr014_dayPart`（年休用）, `cr014_staffIds`/`cr014_staffNames`（任意）
    - 互換: `Start`/`End`（Schedules 互換列。存在すれば自動で書き込まれる）
    - SP 既定: `@odata.etag`, `Created`, `Modified`
  

---

## 4. .env.local（本番相当モード）の設定

ローカルで **SharePoint + 認証あり** モードを試すときの最小例:

```bash
# ===== SharePoint リスト名 =====
VITE_SP_LIST_COMPLIANCE=guid:576f882f-446f-4f7e-8444-d15ba746c681
VITE_SP_LIST_USERS=Users_Master
VITE_SP_LIST_STAFF=Staff_Master
VITE_SP_LIST_OFFICES=Offices
VITE_SP_LIST_SCHEDULES=ScheduleEvents
VITE_SP_LIST_DAILY=SupportRecord_Daily
VITE_SP_LIST_ATTENDANCE=Daily_Attendance

# ===== 機能フラグ =====
VITE_FEATURE_SCHEDULES=1
VITE_FEATURE_SCHEDULES_SP=1
VITE_SKIP_ENSURE_SCHEDULE=1
VITE_WRITE_ENABLED=1

# Demo 無効 + SharePoint 強制 + ログイン必須
VITE_DEMO_MODE=0
VITE_FORCE_SHAREPOINT=1
VITE_SKIP_LOGIN=0

# ===== Azure AD / MSAL =====
VITE_MSAL_CLIENT_ID=<Application (client) ID>
VITE_MSAL_TENANT_ID=<Directory (tenant) ID>
VITE_MSAL_REDIRECT_URI=http://localhost:5175/auth/callback

# 初回ログインで要求する OIDC 系 + SharePoint 委任スコープ
VITE_LOGIN_SCOPES=openid profile
VITE_MSAL_SCOPES=https://isogokatudouhome.sharepoint.com/AllSites.Read
VITE_SP_SCOPE_DEFAULT=https://isogokatudouhome.sharepoint.com/AllSites.Read

# ===== SharePoint サイト =====
VITE_SP_RESOURCE=https://isogokatudouhome.sharepoint.com
VITE_SP_SITE_RELATIVE=/sites/welfare
VITE_SP_BASE_URL=https://isogokatudouhome.sharepoint.com/sites/welfare
```

チェック:

- [ ] `VITE_FORCE_SHAREPOINT=1` / `VITE_SKIP_LOGIN=0` になっている
- [ ] MSAL の ClientId/TenantId が Entra の登録と一致する
- [ ] SCOPES/RESOURCE/SITE が実環境と一致する

---

## 5. 動作確認手順（本番相当）

1. dev 起動（5175 固定）

```bash
npm run dev -- --port 5175
```

1. ログインフロー

- `http://localhost:5175/schedules/week` にアクセス
- ProtectedRoute によりサインインが求められる
- MSAL のログインポップアップで職員アカウントでサインイン
- サインイン後、自動で `/schedules/week` に戻る

1. コンソールログ確認

- `[schedules] using SharePoint port` が出力される
- MSAL dummy テナントエラーが出ていない
- 「SharePoint のアクセストークン取得に失敗しました」エラーが出ていない

1. UI 挙動

- 現在日付の週が表示される
- 利用者のスケジュールが表示される（データがある場合）
- フィルターや週ナビ（前週/次週/今週）が動作する

---

## 6. E2E テスト（任意、本番モード確認）

- Playwright の baseURL を 5175 に合わせるか、VITE_* で切り替える
- `npm run test:schedule-week` を実行し主要シナリオが PASS することを確認
- CI の regression ワークフローに `npm run test:schedule-week` が含まれていることを確認

---

## 7. ロールアウトメモ

- 本番環境に同じ `.env` 設定（相当値）を反映
- 先にステージングで 1〜6 を実施
- 職員向けに「日別ビューで出欠確認／週別ビューで通所パターン確認」など運用ルールを周知

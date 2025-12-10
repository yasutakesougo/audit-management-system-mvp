# Nurse モジュール 本番モードチェックリスト

> 対象: Nurse（バイタル・投薬・緊急メモ）を SharePoint 本番サイトに接続する前の確認メモ

## 1. 前提

- Entra ID (旧 Azure AD) アプリ登録は Schedules / Attendance / Daily と共通を想定。
- SharePoint サイト: `https://isogokatudouhome.sharepoint.com/sites/welfare`。
- Users / Attendance / Daily で `userCode` が安定運用されていること。

## 2. Entra / アプリ登録の確認

1. Authentication: SPA Redirect URI にローカル (`http://localhost:3000/auth/callback` など) が登録済み。ポート 5179 を使う場合は追加。
2. API permissions (委任):
   - 必須: `AllSites.Read`
   - 更新が必要なら `AllSites.Manage` も検討。
3. 管理者同意済みか確認。

## 3. SharePoint リスト設計の確認（例）

- バイタル記録: `Nurse_Vitals`
  - 必須候補: `UserCode`, `RecordedAt`, `BP/HR/SpO2/Temperature`, `RecordedBy`
- 投薬記録: `Nurse_Medications`
  - 必須候補: `UserCode`, `AdministeredAt`, `DrugName`, `Dosage`, `Route`, `Status`, `AdministeredBy`, `DoubleCheckedBy`, `Reason`
- 緊急・事故メモ: `Nurse_Incidents`
  - 必須候補: `UserCode`, `OccurredAt`, `Summary`, `RecordedBy`

> 確定した列は `docs/design/nurse.md` と `src/sharepoint/fields.ts` を同期する。

## 4. `.env.local`（本番相当例）

```env
VITE_SP_RESOURCE=https://isogokatudouhome.sharepoint.com
VITE_SP_SITE_RELATIVE=/sites/welfare
VITE_SP_BASE_URL=https://isogokatudouhome.sharepoint.com/sites/welfare

VITE_AAD_CLIENT_ID=0d704aa1-d263-4e76-afac-f96d92dce620
VITE_AAD_TENANT_ID=650ea331-3451-4bd8-8b5d-b88cc49e6144
VITE_MSAL_CLIENT_ID=0d704aa1-d263-4e76-afac-f96d92dce620
VITE_MSAL_TENANT_ID=650ea331-3451-4bd8-8b5d-b88cc49e6144
VITE_MSAL_REDIRECT_URI=http://localhost:3000/auth/callback
VITE_LOGIN_SCOPES=openid profile
VITE_MSAL_SCOPES=https://isogokatudouhome.sharepoint.com/AllSites.Read
VITE_SP_SCOPE_DEFAULT=https://isogokatudouhome.sharepoint.com/AllSites.Read

VITE_FORCE_SHAREPOINT=1
VITE_SKIP_LOGIN=0
```

## 5. 本番相当モードでの動作確認

1. `.env.local` を本番相当に設定。
2. `npm run dev:nurse`（または `npm run dev`）で起動。
3. ブラウザで `/nurse` にアクセスし、サインイン。
4. 確認ポイント:
   - 当日通所中の利用者が一覧に出る（Attendance と整合）。
   - バイタル/投薬/メモを1件登録し、SharePoint リストに保存されることを確認。

## 6. CI / 回帰テスト

- mini: `npm run test:nurse:mini`（バイタル・投薬・キュー/同期系のユニットを束ねる）。
- GitHub Actions: Quality Gates で「Nurse mini tests (optional)」を実行。安定後は `continue-on-error: false` を検討。

## 7. ロールアウト注意点

- `userCode` を Users_Master と完全一致させる。揺れや重複が無い状態で本番投入。
- 投薬・バイタルの記録者 ID/氏名の運用を決め、ダブルチェック要件がある場合はフィールドに反映。
- 事故・ヒヤリハットとの連携方針（リスト名・列）を事前に合意。

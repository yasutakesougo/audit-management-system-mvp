# Environment Mode Policy

この文書はデータ取得モードと認証ガードの運用ルールを固定し、起動時の想定外動作を防ぐための運用ガイドです。

## 1. データモードの基本方針

- `VITE_SP_ENABLED=true` の場合、SharePoint 接続モードを前提にします。
- `VITE_SP_ENABLED` が未設定・`false`・曖昧な値の場合はローカルモード扱いです。
- `VITE_FORCE_DEMO` や `VITE_DEMO_MODE`、`VITE_SKIP_LOGIN` はデータモードを直接切り替えず、認証・表示の運用前提を変えるだけのフラグです。

## 2. 運用パターン

### A. 本番相当（MSAL + SharePoint）

1. 起動前提:
   - `VITE_E2E=0`
   - `VITE_E2E_MSAL_MOCK=0`
   - `VITE_SKIP_LOGIN=0`
   - `VITE_SKIP_SHAREPOINT=0`
2. 認証必須項目:
   - `VITE_MSAL_CLIENT_ID`（必須）
   - `VITE_MSAL_TENANT_ID`（必須）
   - `VITE_MSAL_REDIRECT_URI`（本番登録との一致が推奨）
3. SharePoint:
   - `VITE_SP_RESOURCE`、`VITE_SP_SITE_RELATIVE` を設定

### B. E2E / MSAL mock

1. 最低構成:
   - `VITE_E2E=1`
   - `VITE_E2E_MSAL_MOCK=1`
   - `VITE_SKIP_LOGIN=1`
   - `VITE_SKIP_SHAREPOINT=1`
   - `VITE_DEMO_MODE=1`（または `VITE_FORCE_DEMO=1`）
2. 用途:
   - CI/E2E の安定実行、共有環境の短時間再現
3. MSAL識別子:
   - `VITE_MSAL_CLIENT_ID`、`VITE_MSAL_TENANT_ID` はテスト用値で可

## 3. 本番相当起動での確認対象

- MSAL の識別子が欠損していないこと
- Redirect URI が本番登録と origin / path で齟齬がないこと
- SharePoint 接続変数が揃っていること
- skip フラグの残留がないこと

## 4. 旧仕様との整合

本書はデータモードの運用方針を固定し、`VITE_SKIP_LOGIN`/`VITE_FORCE_DEMO` の挙動を「データモードではなく運用制御」として扱います。
実装詳細は `src/lib/env.ts` / `src/lib/env.schema.ts` です。

> [!NOTE]
> `VITE_MSAL` 系の必須前提は環境監査や起動ガードの結果に基づき、運用手順で優先確認してください。

# 🔐 MSAL / Azure AD 認証ガイド

> 対象: 開発チーム / Azure 管理者  
> 関連: [playbook.md](./playbook.md#2-方針の全体構造)

---

## 1. 目的

本システムでは **MSAL.js (Microsoft Authentication Library)** を使用し、
Azure Active Directory によるシングルサインオン (SSO) と
トークンベース認証を採用しています。

---

## 2. 登録と構成

| 設定項目 | 値の例 | 備考 |
|-----------|---------|------|
| アプリ名 | 磯子区障害者地域活動ホーム業務システム | SPA 登録 |
| サポートアカウント | 所属組織のユーザーのみ | マルチテナント不要 |
| リダイレクト URI | `http://localhost:3000/auth/callback` | ローカル用 |
| スコープ | `https://isogokatudouhome.sharepoint.com/AllSites.Read` | SharePoint 連携 |

---

## 3. 実装方針

- 認証フロー: **redirect-first**, fallback to popup  
- トークン取得: `acquireTokenSilent` → `acquireTokenRedirect`  
- 設定: `.env.local`
  ```bash
  VITE_MSAL_CLIENT_ID=<AppID>
  VITE_MSAL_TENANT_ID=<TenantID>
  VITE_MSAL_REDIRECT_URI=http://localhost:3000/auth/callback
  VITE_MSAL_SCOPES=https://isogokatudouhome.sharepoint.com/AllSites.Read
  VITE_MSAL_LOGIN_FLOW=redirect
  ```

---

## 4. トークン管理・リフレッシュ

- silent flow 成功率を維持するため `cacheLocation=sessionStorage` を利用。  
- トークン更新間隔: 50 分（既定の 3600 秒 - 600 秒）。  
- サインアウトは `logoutRedirect` に統一。  
- `redirectStartPage` で遷移前 URL を保持し、復帰を保証。

---

## 5. 監査・検証

- `msal.ts` ログに `[MSAL CONFIG]` が出ないことを確認。  
- CSP Report で `frame-ancestors` 違反が出ないかを監視。  
- 失敗時は MSAL の `errorCode`, `subError` を記録し、NDJSON に残す。

---

## 6. 参考資料

- [MSAL.js Docs](https://learn.microsoft.com/azure/active-directory/develop/msal-overview)  
- [SPA アプリ登録手順](https://learn.microsoft.com/azure/active-directory/develop/scenario-spa-app-registration)

# Entra ID + Graph API + AADSTS50011 解決ガイド

**目的:** Redirect URI を追加して AADSTS50011 を解消し、Graph API によるスケジュール取得を本番化

---

## 📋 **チェックリスト**

### 1️⃣ **Entra ID: SPA Redirect URI 設定**

**実施場所:** https://entra.microsoft.com

1. **アプリ登録**を開く
   - アプリID: `0d704aa1-d263-4e76-afac-f96d92dce620`
   - またはスイッチャーで「すべてのアプリケーション」 → 「アプリ登録」 → 検索

2. **認証 (Authentication)** セクションに移動

3. **シングルページアプリケーション (SPA)** セクション
   - 「URI を追加」をクリック
   - 追加する URI:
     ```
     https://isogo-system.momosantanuki.workers.dev
     ```
   - **保存**をクリック

4. ✅ **確認:** SPA セクションに新しい URI が表示されることを確認

**補足:** Preview/Branch URL でのテストが必要な場合
- Entra では基本ワイルドカード(`*.momosantanuki.workers.dev`)が使用できないため、
- 使用予定の個別 URL を「その都度追加」する運用が現実的です。
- 例：`https://debug-branch.momosantanuki.workers.dev` など

---

### 2️⃣ **アプリ側: MSAL 設定確認**

**ファイル:** `src/auth/msalConfig.ts`

```ts
// redirectUri が本番URL に一致していることを確認
export const msalConfig = {
  auth: {
    clientId: effectiveClientId,
    authority: `https://login.microsoftonline.com/${effectiveTenantId}`,
    redirectUri: safeOrigin,  // <- window.location.origin を使用
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
};
```

**確認項目:**
- ✅ `clientId` = `0d704aa1-d263-4e76-afac-f96d92dce620` から環境変数で指定
- ✅ `tenantId` = 組織テナント ID から環境変数で指定
- ✅ `redirectUri` = `window.location.origin` (= `https://isogo-system.momosantanuki.workers.dev`)
- ✅ `authority` = `https://login.microsoftonline.com/{tenantId}`

**環境変数確認 (.env.local または Cloudflare Build):**

```bash
# Cloudflare Pages → Settings → Environment variables (Build time)
VITE_MSAL_CLIENT_ID=0d704aa1-d263-4e76-afac-f96d92dce620
VITE_MSAL_TENANT_ID=<your-tenant-id>
# オプション (デフォルト使用時は未設定でOK)
# VITE_MSAL_REDIRECT_URI=https://isogo-system.momosantanuki.workers.dev
# VITE_MSAL_AUTHORITY=https://login.microsoftonline.com/<tenant-id>
```

---

### 3️⃣ **Graph API 権限設定（401/403 対策）**

**実施場所:** https://entra.microsoft.com → 対象アプリ

1. **API のアクセス許可 (API Permissions)** に移動

2. **アクセス許可の追加**
   - 「Microsoft Graph」を選択
   - 「委任されたアクセス許可」を選択
   - 検索: `Calendars.Read` / `Calendars.Read.Shared`
   - ☑️ チェックを入れて「アクセス許可を追加」

3. **必要に応じて管理者の同意を付与**
   - 「(テナント名) に対して管理者の同意を付与」をクリック
   - ⚠️ 同意がない場合、ユーザーのアカウント自体で同意が求められる

**確認項目:**
- ✅ `Calendars.Read` または `Calendars.Read.Shared` が許可一覧にある
- ✅ 緑のチェック (✔️) で「同意済み」と表示されている

**参考:** スケジュール機能の実装仕様に応じて調整
- **読み取りのみ:** `Calendars.Read`
- **共有カレンダーも読む:** `Calendars.Read.Shared`
- **作成・更新も対応:** `Calendars.ReadWrite` / `Calendars.ReadWrite.Shared`

---

### 4️⃣ **本番環境: 動作確認**

**実施場所:** https://isogo-system.momosantanuki.workers.dev

#### ステップ 1: ブラウザキャッシュ完全クリア
```
Cmd+Shift+R （Mac）または Ctrl+Shift+R （Windows/Linux）
```
- MSAL は `localStorage` にトークン/キャッシュを保存
- 旧設定が残っていると認証が失敗することがあるため

#### ステップ 2: ログイン実施
1. 「ログイン」ボタンをクリック
2. Microsoft Entra ID で認証
3. 初回は「アクセス許可をお願いします」ダイアログが出現
   - 「承認」 をクリック

#### ステップ 3: コンソール確認（開発者ツール: F12）

**成功時:** 以下のログが出現する
```
✅ [schedules] using Graph port
✅ Graph API Call: GET /me/calendarview (200 OK)
✅ Schedules loaded: 5 items
```

**失敗時の診断:**

| エラー | 原因 | 解決方法 |
|--------|------|--------|
| **AADSTS50011** | Redirect URI 未登録 | Entra で URI を追加 → ブラウザリロード |
| **AADSTS65001** | 同意がない | Entra で「管理者の同意を付与」 |
| **401 Unauthorized** | トークン無効 | `localStorage` クリア → 再ログイン |
| **403 Forbidden** | 権限不足 | Entra で `Calendars.Read` を追加 |
| **Network Error** | CSP 違反 | CSP ヘッダーに `https://graph.microsoft.com` 含まれているか確認 |

---

### 5️⃣ **トラブルシューティング（よく出るケース）**

#### **ケース A: ログイン後も Demo port のままの場合**

```
❌ [schedules] using Demo port
```

**原因:** `VITE_FEATURE_SCHEDULES_GRAPH=true` が Vite に反映されていない

**確認方法:**
```bash
# ビルド時ログで確認
# Cloudflare Deployments → Build details を確認
# VITE_FEATURE_SCHEDULES_GRAPH=true が表示されているか？
```

**解決方法:**
1. Cloudflare Pages → Settings → Environment variables を確認
2. `VITE_FEATURE_SCHEDULES_GRAPH=true` が設定されているか
3. なければ追加 → 新しい rebuild PR を作成

#### **ケース B: キャッシュの懸念**

```
localStorage / sessionStorage に MSAL キャッシュが残っていると、
古い設定で動作し続けることがあります。
```

**清掃方法（コンソール）:**
```javascript
// アカウント情報をクリア
localStorage.clear();
sessionStorage.clear();
// ページリロード
location.reload();
```

或いはブラウザの「キャッシュクリア」機能で一括処理

#### **ケース C: CSP 違反でブロック**

Network タブで `graph.microsoft.com` への呼び出しが**赤（ブロック）**になっている場合

```
❌ Content Security Policy: ... graph.microsoft.com
```

**解決方法:** CSP ヘッダーを確認 → Graph.microsoft.com が許可リストに入っているか

- **ファイル:** `src/scripts/csp-headers.mjs`
- **確認:**
  ```javascript
  defaultConnectSources: [
    "'self'",
    'https://graph.microsoft.com',  // ← これが必須
    'https://login.microsoftonline.com',
    // ...
  ]
  ```

---

## 🎯 **最終確認チェック**

| 項目 | 状態 | 証拠 |
|------|------|------|
| Entra: SPA Redirect URI 追加 | ✅ / ❌ | Entra 認証 → SPA 一覧に表示 |
| MSAL 環境変数設定 | ✅ / ❌ | `VITE_MSAL_CLIENT_ID`, `VITE_MSAL_TENANT_ID` 確認 |
| Graph 権限追加 | ✅ / ❌ | Entra API Permissions → `Calendars.Read` 表示 |
| 管理者同意 | ✅ / ❌ | Entra API Permissions → ✔️ 同意済み |
| Console: Graph port | ✅ / ❌ | 本番 URL → F12 → `[schedules] using Graph port` |
| Graph API 200 OK | ✅ / ❌ | Network タブ → `/me/calendarview` ステータス 200 |
| スケジュール表示 | ✅ / ❌ | UI で予定が表示される |

---

## 📞 **問題が発生した場合**

以下を貼付いただけるとスムーズです：

1. **ログイン失敗時の AADSTS エラー全文**
   ```
   コピペ例: AADSTS50011: The redirect URI ...
   ```

2. **Graph 呼び出し失敗時の Network タブ**
   ```
   リクエスト URL: https://graph.microsoft.com/v1.0/me/calendarview
   ステータス: 403 Forbidden
   Response: {"error": {"code": "Authorization_RequestDenied", ...}}
   ```

3. **ブラウザコンソール全文**
   ```
   F12 → Console タブ → エラーメッセージをコピー
   ```

---

**進捗:** Entra ID 設定完了 → Redirect URI 反映 → 本番確認 で完全解決! 🎉


# RBAC 運用ガイド

> **対象**: システム管理者・運用担当者
> **最終確認日**: 2026-03-13
> **関連 Issue**: #786

---

## 1. ロール体系

本システムは **3段階ロール** で権限管理を行います。

| ロール | レベル | 対象ユーザー | 概要 |
|---|---|---|---|
| `admin` | 3 (最高) | 管理者・サービス管理責任者 | 全機能アクセス可。管理ツール、自己点検、監査、テンプレート管理等 |
| `reception` | 2 | 受付・事務担当 | 請求処理、サービス提供実績、月次帳票、勤怠管理 |
| `viewer` | 1 (最低) | 一般職員 | 日次記録閲覧、利用者一覧、引継ぎタイムライン、会議メモ |

ロールは **上位互換** です。`admin` は `reception` と `viewer` の全権限を含みます。

---

## 2. Azure AD グループ設定

### 現在のグループ ID

| グループ | Entra ID Object ID | 環境変数 |
|---|---|---|
| 管理者 | `b1271c8c-e89e-4e06-940d-05e850a6e49a` | `VITE_AAD_ADMIN_GROUP_ID` |
| 受付 | `10c9b01a-8846-4f9c-afce-e4e71feae51e` | `VITE_AAD_RECEPTION_GROUP_ID` |

### ロール判定フロー

1. MSAL でテナント認証
2. `useUserAuthz` が Graph API `/me/memberOf` を呼び出し
3. ユーザーの所属グループ ID を取得
4. admin Group ID に含まれる → `admin`
5. reception Group ID に含まれる → `reception`
6. いずれにも含まれない → `viewer`

### メンバー追加手順

新規職員にロールを割り当てる場合：

1. [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **グループ**
2. 該当グループを検索（Object ID で検索可）
3. **メンバー** → **メンバーの追加** でユーザーを追加
4. 追加後、ユーザーが**再ログイン**すると新ロールが反映されます

> ⚠️ グループメンバーの変更は、ユーザーが次にログインした時点で反映されます。
> キャッシュされたセッションでは旧ロールのままです。

---

## 3. 防御アーキテクチャ（3層）

### Layer 1: ナビゲーション非表示

`navigationConfig.ts` の `audience` フィルタにより、権限外のメニューは**ナビに表示されません**。

| audience | 表示条件 |
|---|---|
| `all` | 全ロール |
| `staff` | staff / admin |
| `admin` | admin のみ |
| `['reception', 'admin']` | reception 以上 |

### Layer 2: ルートガード (`RequireAudience`)

URL 直接アクセスを防ぐため、各ルートに `RequireAudience` コンポーネントを配置。
権限不足の場合は **403 画面** を表示します。

### Layer 3: Fail-Closed ロジック

`useUserAuthz` は以下の場合に安全側に倒します：

- `adminGroupId` が未設定 → **`viewer` を返す**（本番モード時）
- Graph API エラー → **`viewer` にフォールバック**
- 環境未準備（`envReady = false`） → **`viewer` + `ready: false`**

---

## 4. 環境変数チェックリスト

### 本番環境 (Cloudflare Worker)

| 変数 | 期待値 | 現在の状態 | 確認方法 |
|---|---|---|---|
| `VITE_SKIP_LOGIN` | **未設定 or `false`** | ✅ `.env.production` に未記載 | ビルド時に含まれない |
| `VITE_DEMO_MODE` | **未設定 or `false`** | ✅ `.env.production` に未記載 | ビルド時に含まれない |
| `VITE_E2E` | **未設定** | ✅ 未記載 | テスト用のみ |
| `VITE_AAD_ADMIN_GROUP_ID` | グループ ID | ✅ 設定済み | `.env.production` + Worker binding |
| `VITE_AAD_RECEPTION_GROUP_ID` | グループ ID | ✅ 設定済み | `.env.production` + Worker binding |

### Worker Runtime ENV 注入 (allowlist)

`worker.ts` の `RUNTIME_ENV_ALLOWLIST` に含まれる変数のみ、Runtime で `window.__ENV__` に注入されます。

**`VITE_SKIP_LOGIN` と `VITE_DEMO_MODE` は allowlist に含まれていません。**
これにより、仮に Worker binding にこれらの変数が設定されても、クライアントには到達しません。

---

## 5. ローカル開発との違い

| 設定 | ローカル (`.env.local`) | 本番 (`.env.production`) |
|---|---|---|
| `VITE_SKIP_LOGIN` | `1` (MSAL不要) | 未設定 (MSAL必須) |
| `VITE_DEMO_MODE` | `1` (モックデータ) | 未設定 (実データ) |
| `VITE_AAD_ADMIN_GROUP_ID` | 未設定 (全員admin) | 設定済み (グループ判定) |
| Vite DEV フラグ | `true` | `false` |

> 📝 ローカルでは `shouldSkipLogin()` が `true` になるため、
> `RequireAudience` と `AdminGate` は全てバイパスされます。
> これは **意図した動作** です（開発時に認証不要にするため）。

---

## 6. トラブルシューティング

### 「全ユーザーが viewer になる」

- **原因**: `VITE_AAD_ADMIN_GROUP_ID` が未設定
- **対処**: `.env.production` と Cloudflare Worker binding を確認

### 「全ユーザーが admin になる」

- **原因**: `VITE_DEMO_MODE=1` が本番に漏れている
- **対処**: `.env.production` から `VITE_DEMO_MODE` を削除、再デプロイ

### 「ログイン画面が出ない」

- **原因**: `VITE_SKIP_LOGIN=1` が本番に漏れている
- **対処**: `.env.production` から `VITE_SKIP_LOGIN` を削除、再デプロイ

### 「権限が反映されない」

- **原因**: Azure AD グループ変更後、セッションキャッシュが残っている
- **対処**: ユーザーに再ログイン（ブラウザの MSAL キャッシュクリア）を依頼

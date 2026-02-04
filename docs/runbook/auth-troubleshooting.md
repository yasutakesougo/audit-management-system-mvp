# Auth Troubleshooting Runbook (MSAL Redirect / COOP-safe)

対象: audit-management-system-mvp  
更新: 2026-02-01 (Phase 3.6 A/B/C sealed)

## 0. まず結論（3ステップ）
1) **強制再ログイン** を押す  
2) ダメなら **キャッシュクリアして再ログイン** を押す  
3) それでもダメなら **診断情報をコピー** → Teams/Issue に貼る（診断ID付き）

---

## 1. 画面に出る情報の読み方
- **理由コード (ReasonCode)**: ブロック理由の分類
- **診断ID (CorrelationId)**: 問い合わせ時の追跡用ID
- **詳細 (Detail)**: 状態のJSON（inProgress, tokenReady, listGate など）

### 共有テンプレ（Teams/Issue）
以下をそのまま貼る:

- 発生時刻:
- 画面URL:
- 理由コード:
- 診断ID:
- 実施した操作: (強制再ログイン / キャッシュクリア / どちらも)
- コピーボタンの内容:

---

## 2. ReasonCode 一覧と対処

### MSAL_IN_PROGRESS
- 意味: サインイン処理中（リダイレクト復帰やトークン処理中）
- 対処: まず待つ（数秒〜）。長い場合は強制再ログイン。

### AUTH_LOADING
- 意味: 認証情報を確認中
- 対処: リロード1回 → 強制再ログイン。

### NOT_AUTHENTICATED
- 意味: 未ログイン
- 対処: 強制再ログイン。

### TOKEN_ACQUIRE_PENDING
- 意味: トークン/権限確認中（取得待ち）
- 対処: 数秒待つ → 改善しなければ強制再ログイン → 最終的にキャッシュクリア。

### LIST_CHECK_PENDING
- 意味: SharePointリスト存在確認中
- 対処: 少し待つ。長引くなら診断コピーして共有（ネットワーク/権限確認）。

### LIST_NOT_FOUND
- 意味: 必要なリストが見つからない or アクセス不可
- 対処: 診断コピーして共有（管理者がリスト/権限/URL/ENVを確認）。

### FEATURE_DISABLED
- 意味: 機能フラグでOFF
- 対処: 管理者に依頼（フラグ/環境を確認）。

### UNKNOWN
- 意味: 想定外
- 対処: 診断コピーして共有（診断ID必須）。

---

## 3. 復旧ボタンの挙動（3.6-C）

### 強制再ログイン
- 通常のログインをやり直す（最も安全で軽い）

### キャッシュクリアして再ログイン
- MSALの localStorage/sessionStorage を削除
- ログアウト → リダイレクトでログインし直す
- 「ループ」「古い状態が残る」系に効く

### 診断情報をコピー
- ReasonCode / CorrelationId / URL / UA / Timestamp / Detail を整形してコピー
- 問い合わせの最短ルート

---

## 4. 管理者向けチェック（必要時）
- Azure AD App の Redirect URI が正しいか
- Cloudflare Worker / wrangler の name が一致しているか
- SharePoint Site URL / List の存在と権限
- ブラウザ拡張/追跡防止が強すぎないか

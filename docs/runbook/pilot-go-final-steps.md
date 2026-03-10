# 限定運用 Go — 最終投入手順

> **所要時間**: 約 5 分（env 投入 + 再起動 + 3 ロール確認）
> **前提**: Entra ID の管理者グループ / 受付グループの Object ID を手元に用意済み

---

## 1. env 投入（1 分）

`.env.production` を開き、プレースホルダーを置換:

```diff
-VITE_AAD_ADMIN_GROUP_ID=__FILL_BEFORE_DEPLOY__
-VITE_AAD_RECEPTION_GROUP_ID=__FILL_BEFORE_DEPLOY__
+VITE_AAD_ADMIN_GROUP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
+VITE_AAD_RECEPTION_GROUP_ID=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
```

確認:

```
VITE_FEATURE_TODAY_OPS=1   ← 入っていること
VITE_WRITE_ENABLED=1       ← 入っていること
VITE_SKIP_LOGIN=            ← 0 または未設定
```

## 2. 再起動（30 秒）

```bash
# ローカル確認の場合
npm run dev
# → ブラウザで表示確認

# 本番デプロイの場合
npm run build
# → デプロイ先にアップロード
```

## 3. ロール実効確認（3 分）

3 アカウントで順に確認。**1 項目でも NG なら env を再確認**。

### admin アカウント

| 操作 | 期待 | ✅ |
|------|------|-----|
| `/` を開く | → `/dashboard` にリダイレクト | ☐ |
| `/users` を開く | ユーザー一覧が見える | ☐ |

### reception アカウント

| 操作 | 期待 | ✅ |
|------|------|-----|
| `/` を開く | → `/today` にリダイレクト | ☐ |
| `/users` を開く | 403「アクセス権がありません」 | ☐ |

### viewer（グループ未所属）

| 操作 | 期待 | ✅ |
|------|------|-----|
| `/` を開く | → `/today` にリダイレクト | ☐ |
| `/users` を開く | 403「アクセス権がありません」 | ☐ |

## 4. 判定（10 秒）

```
全項目 ✅ → 限定運用 Go
1 つでも NG → env 値を再確認、Entra ID グループのメンバーシップを確認
```

---

## NG 時のクイック診断

| 症状 | 最初に見る場所 |
|------|--------------|
| 全員が viewer になる | `VITE_AAD_ADMIN_GROUP_ID` の値が Entra ID の Object ID と一致しているか |
| admin なのに `/today` に飛ぶ | `useUserAuthz` のロール解決を確認（DevTools Console で `[useUserAuthz]` ログ） |
| `/today` が表示されない | `VITE_FEATURE_TODAY_OPS=1` が反映されているか（再ビルドが必要） |
| ログインできない | `VITE_MSAL_CLIENT_ID` / `VITE_MSAL_TENANT_ID` が本番値か確認 |

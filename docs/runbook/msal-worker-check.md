# MSAL + Worker 安定化確認（2026-01-24）

## 1) Wrangler dry-run
- cmd:
  - `npx wrangler deploy --dry-run` ✅
  - `npx wrangler whoami` ✅
- **想定値**:
  - name: `isogo-system`
  - account_id: f11b58e8971f72a7f9b1108fc1ac33f4
- **実測値**:
  - name: `isogo-system` ✅
  - account_id: `f11b58e8971f72a7f9b1108fc1ac33f4` ✅
  - account: Momosantanuki@gmail.com's Account ✅
  - Worker bindings: ASSETS のみ
  - gzip size: 0.36 KiB
- 備考: dry-run で name 一致確認完了。別 Worker への誤デプロイリスクなし。

## 2) 本番 MSAL（シークレット）
- URL: （本番URL）
- 初回ログイン: OK / NG
  - NG時: （現象1行: /auth/callback で止まる / 無限リダイレクト / etc）
  - 追加観測（任意）: DevTools Network で最初に落ちたAPI（URL + status）
- リロード: OK / NG
  - NG時: （401/403 / 画面の状態）
- 別タブ復帰(ssoSilent): OK / NG
  - NG時: （再ログイン要求 / エラー）
- 備考:

## 3) CI
- Run URL:
- schedule smoke: Green（Retry無し）/ Yellow（Retry有）/ Red（FAIL）
  - Yellow/Red時: どの selector / wait が落ちたか（job log から）
- 備考:

---

## 📋 実行手順（コピペ用）

### ① Wrangler dry-run
```bash
# 1. dev 環境（デフォルト）
wrangler deploy --dry-run

# 2. production 環境（ある場合）
wrangler deploy --dry-run --env production
```

**チェックポイント**:
- [ ] name が `isogo-system` と一致
- [ ] account_id が想定どおり
- [ ] route / workers_dev が想定どおり

### ② 本番 MSAL 動作確認
1. **シークレットウィンドウ**で本番URLを開く
2. チェック項目:
   - [ ] 初回ログイン：成功（ループなし）
   - [ ] リロード：セッション維持（401/403 なし）
   - [ ] 別タブ復帰：ssoSilent が通る（再ログイン要求なし）

### ③ CI 状況確認
```bash
# GitHub Actions の最新 Run を確認
gh run list --workflow=CI --limit 3

# 特定の Run の詳細確認
gh run view <run-id> --log
```

**チェックポイント**:
- [ ] schedule smoke が Retry なしで Green

---

## 🎯 結果記入後のアクション

**全部 OK の場合**:
→ 2️⃣ Wrangler コメント追加のPR へ進む

**NG がある場合**:
→ NG 項目の詳細を記録し、切り分け開始

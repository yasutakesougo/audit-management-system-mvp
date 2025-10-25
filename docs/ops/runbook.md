# Operations Runbook

## 目的
現場での「つながらない/保存できない」を最短で復旧するための一次切り分け手順。

## 1) クイック判定表

| 症状 | 代表エラー/状況 | まずやること | 次手 |
|---|---|---|---|
| サインインできない | 401, popup blocked | ヘッダー「サインイン」→ポップアップ許可 | MSAL cache クリア / cookie 全消去 |
| 取得が落ちる | 401/403 | 管理者同意 / スコープ誤り確認（env-config.md） | 再サインイン→トークン再取得 |
| 遅い or 部分失敗 | 429/503/504 | 再試行ログ確認（`VITE_SP_RETRY_*`） | バックオフ上げ / バッチサイズ下げ |
| 重複扱いが増えた | 409 (entry_hash) | 正常（成功扱い） | 連投操作の抑制・後でバッチ集約 |
| URL 404 | `_api/web` not found | `VITE_SP_SITE_*` のパス・大文字小文字 | 既存サイト確認 / schema 再適用 |

## 2) 設定確認の順番（30秒版）
1. 右上のアカウント → サインイン状態
2. `Ctrl+Shift+I` → Console に `ensureConfig` の警告がないか
3. `.env` から `VITE_SP_RESOURCE` / `VITE_SP_SITE_RELATIVE` が実値化されているか（プレースホルダ禁止）
4. `auth-flow.md` のロールでアクセスが遮断されていないか

## 3) 監査・同期系の指標（UI）
- `data-testid="audit-metrics"`  
  `data-total / data-success / data-duplicates / data-failed` を読み取る  
- 失敗のみ再送ボタンで **Failed > 0** のみ再送

## 4) SharePoint スロットリング対策
- 既定リトライ：指数バックオフ + jitter（429/503/504）
- 運用ノブ：
  - `VITE_SP_RETRY_MAX`（<=5）
  - `VITE_SP_RETRY_BASE_MS`（例: 400→800）
  - バッチ：`VITE_AUDIT_BATCH_SIZE`（小さく）

## 5) 重大度と連絡
- Sev-1: 全員がサインイン不可 / 主要CRUD不可 → 管理者とMSサービス正常性
- Sev-2: 一部画面で保存不可 / 連続 429 → バックオフ調整・操作間隔の指示
- Sev-3: 個別端末の表示不良 → キャッシュ/Service Worker クリア、別ブラウザで切替

## 6) 既知の回避策
- PWA残骸でTLS/キャッシュ崩れ → SW Unregister + HSTS delete（手順は README 末尾）
- ローカル運用モード時：オフライン→復帰での一括同期を待つ

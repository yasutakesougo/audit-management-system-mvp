# TodayOps Feature Flag Runbook

> **対象:** `VITE_FEATURE_TODAY_OPS` フラグの段階展開・ロールバック手順
>
> **目標:** インシデント発生時に 5分以内 で安全にロールバック可能

## 1. Feature Flag の概要

| 項目 | 値 |
|------|-----|
| 環境変数名 | `VITE_FEATURE_TODAY_OPS` |
| デフォルト値 | 明示指定なし → `true`（有効） |
| 明示指定時 | `true` = 有効 / `false` = 無効 |
| 影響範囲 | `/today` ページの運用ダッシュボード表示 |

### フラグの動作ロジック

```typescript
// featureFlags.ts
const explicitTodayOps = hasExplicitBoolEnv('VITE_FEATURE_TODAY_OPS', envOverride);
const todayOps = explicitTodayOps
  ? readBool('VITE_FEATURE_TODAY_OPS', false, envOverride)
  : true; // 未指定なら true
```

## 2. 切替場所

### 2.1 ローカル開発

`.env.local` に追記:

```env
# TodayOps を無効にする場合
VITE_FEATURE_TODAY_OPS=false

# TodayOps を有効にする場合（デフォルト動作）
VITE_FEATURE_TODAY_OPS=true
```

変更後: `npm run dev` を再起動（Vite は .env の変更を自動リロードしない）

### 2.2 本番 (Cloudflare Pages)

**Cloudflare Dashboard:**

1. Cloudflare Dashboard → Pages → audit-management-system-mvp
2. Settings → Environment variables
3. `VITE_FEATURE_TODAY_OPS` を追加/編集
4. **Save and Deploy** をクリック

**ロールバック:**

1. 上記手順で `VITE_FEATURE_TODAY_OPS=false` に変更
2. **Save and Deploy** → 新しいビルドが開始
3. ビルド完了まで約2-3分

### 2.3 Cloudflare Wrangler (CLI)

```bash
# ロールバック（無効化）
wrangler pages deployment rollback --project-name audit-management-system-mvp

# 環境変数を変更して再デプロイ
VITE_FEATURE_TODAY_OPS=false wrangler pages deploy ./dist
```

## 3. 切替後の確認手順（Smoke テスト）

### 3.1 有効化時の確認

| # | 確認内容 | 期待結果 | URL |
|---|---------|---------|-----|
| 1 | `/today` にアクセス | 運用ダッシュボードが表示される | `/today` |
| 2 | ヒーローバナー表示 | 未記録件数が表示される | `/today` |
| 3 | QuickRecord Drawer | 「未記録の一括照会」が動作する | `/today?mode=unfilled` |
| 4 | ナビゲーション | サイドバーに「今日の業務」リンクが存在 | any page |

### 3.2 無効化時の確認

| # | 確認内容 | 期待結果 | URL |
|---|---------|---------|-----|
| 1 | `/today` にアクセス | 402 or 基本ビューにフォールバック | `/today` |
| 2 | ナビゲーション | サイドバーから「今日の業務」カテゴリの特定項目が非表示 | any page |
| 3 | 他のページ正常 | `/daily`, `/schedules` 等が影響を受けない | `/daily` |

### 3.3 自動テスト

```bash
# Feature flags テスト
npx vitest run tests/unit/config/featureFlags.spec.ts

# ナビゲーションテスト
npx vitest run tests/unit/app/config/navigationConfig.spec.ts

# AppShell テスト
npx vitest run tests/rtl/AppShell.nav.test.tsx
```

## 4. 緊急ロールバック手順（5分以内）

### Step 1: フラグ無効化（~1分）

```bash
# Cloudflare Dashboard で VITE_FEATURE_TODAY_OPS=false に変更
# または: 前のデプロイメントにロールバック
```

### Step 2: ビルド完了を待つ（~2-3分）

- Cloudflare Dashboard → Deployments タブで進捗確認
- 前のデプロイメントへのロールバックならば即座に反映

### Step 3: Smoke テスト（~1分）

1. `/today` → 運用ダッシュボードが非表示であることを確認
2. `/daily` → 通常の日次記録ページが正常に動作することを確認
3. コンソールエラーがないことを確認

## 5. 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/config/featureFlags.ts` | フラグ解決ロジック |
| `src/lib/env.ts` | `isTodayOpsFeatureEnabled()` |
| `src/app/config/navigationConfig.ts` | ナビ表示制御 |
| `src/features/today/` | TodayOps 全コンポーネント |

## 6. 注意事項

- フラグはビルド時に解決されるため、変更後はリビルドが必要
- ユーザーのブラウザキャッシュにより、旧バージョンが残る可能性あり
  - 対策: Cloudflare のキャッシュパージ、または Cache-Control ヘッダーの確認
- localStorage に `ams_quick_auto_next` が残るが、フラグ無効時はUIが表示されないため影響なし

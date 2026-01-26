# PR: /checklist ページ管理者専用アクセス制御（AdminGate & fail-closed)

## 📋 概要

`/checklist` ページを管理者専用ページに格上げし、**3層防御システム**で保護します。
このページは将来の `/audit` 統合に向けた重要な "back office" ツールのため、完全削除ではなく、適切に隠蔽 & 保護する方針です。

## 🎯 実装内容

### 1️⃣ **ナビゲーション隠蔽** (`src/app/AppShell.tsx`)
- 管理者以外に「自己点検」メニュー項目を表示しない
- 条件付き展開: `...(isAdmin && authzReady ? [{...}] : [])`

### 2️⃣ **ルートガード** (`src/app/router.tsx`)
- `/checklist` ルートを `<AdminGate>` コンポーネントでラップ
- 非管理者が直接 URL でアクセス → 403 + 詳細エラーメッセージ表示

### 3️⃣ **Fail-closed ロジック** (`src/auth/useUserAuthz.ts`)
- **PROD**: 環境変数 `VITE_SCHEDULE_ADMINS_GROUP_ID` 未設定 → `isAdmin=false` (**安全**)
- **DEMO**: 開発便利性のため全員管理者扱い
- 詳細なエラー分類: `reason` フィールドで「config エラー」vs「権限なし」を区別

### 4️⃣ **コンポーネント実装** (`src/components/AdminGate.tsx`)
- 3状態を管理:
  - `ready=false` → ローディング画面
  - `!isAdmin` → 403 画面（エラー内容は reason に応じて変更）
  - `isAdmin` → 子要素を表示
- 設定エラー時: `VITE_SCHEDULE_ADMINS_GROUP_ID` 環境変数名を表示（運用対応が秒速）

### 5️⃣ **E2E テスト** (`tests/e2e/checklist-admin-access.smoke.spec.ts`)
- Vite 環境変数は起動時に固定されるため、PROD/DEMO は **別プロセスで実行**
- 実行方法:
  ```bash
  # PROD-like (fail-closed 確認)
  VITE_DEMO_MODE=0 VITE_SCHEDULE_ADMINS_GROUP_ID= npx playwright test 'checklist-admin-access' --project=smoke
  
  # DEMO (convenience mode 確認)
  VITE_DEMO_MODE=1 npx playwright test 'checklist-admin-access' --project=smoke
  ```
- 結果: **両シナリオ 3/3 テスト合格** ✅

### 6️⃣ **ドキュメント** (`docs/operations-runbook.md`)
- 本番デプロイ前チェックリスト追加
- E2E テスト実行手順 + 環境分離の重要性明記
- CI/CD マトリックス設定例

## 🔒 セキュリティ設計

| シナリオ | VITE_DEMO_MODE | VITE_SCHEDULE_ADMINS_GROUP_ID | 結果 |
|---------|---|---|---|
| **本番通常** | 0 | `<group-uuid>` | ✅ 管理者のみアクセス |
| **本番デプロイ前テスト** | 0 | (未設定) | ✅ 全員ブロック (fail-closed) |
| **開発** | 1 | (任意) | ✅ 全員管理者 (便利) |

**リスク評価**: 既存画面には影響なし。権限判定は deny 側に倒して安全。

## 🧪 テスト実行結果

```
✅ TypeScript compilation: Success
✅ PROD E2E (fail-closed): 3/3 passed
✅ DEMO E2E (convenience): 3/3 passed
✅ Playwright config env 上書き可能: OK
```

## 📚 関連ファイル

- `src/components/AdminGate.tsx` — 403 ゲート + エラーメッセージ
- `src/auth/useUserAuthz.ts` — Entra AD 権限判定 + fail-closed
- `src/app/router.tsx` — /checklist ルートガード
- `src/app/AppShell.tsx` — ナビ条件付き表示
- `tests/e2e/checklist-admin-access.smoke.spec.ts` — E2E テスト
- `docs/operations-runbook.md` — 運用手順

## 🚀 デプロイチェックリスト

- [ ] `VITE_SCHEDULE_ADMINS_GROUP_ID` を本番環境に設定
- [ ] E2E テストを両シナリオで実行確認
- [ ] 本番環境でナビに「自己点検」が表示されないか確認
- [ ] 意図したユーザーが `/checklist` にアクセス可能か確認

## 💡 今後の拡張

このシステムは将来の以下の実装に対応できます:
- `/audit` 画面と `/checklist` の統合
- より細粒度の権限管理（例: 監査者のみ、など）
- 設定ミスの自動検知・アラート


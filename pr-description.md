# ナビ Drawer 刷新（検索・グルーピング）と E2E 管理者バイパス

## 概要
- ヘッダーボタンを Drawer ナビに置き換え、検索・グルーピング・黒ノート強調を追加
- モバイルでの遷移時に Drawer を自動クローズし検索クエリをリセット、0件時に「該当なし」案内を表示
- Playwright/E2E で管理者グループを即時付与するモック経路を追加し、ナビ権限を安定化

## 主な変更
- Drawer＋検索フィールド＋グループ見出し＋黒ノート強調の UI 実装（AppShell.tsx）
- モバイル Drawer の onNavigate でクローズ＋検索クリア、検索 0 件時のフォールバック表示（AppShell.tsx）
- E2E モードで admin グループ ID を即返却（useUserAuthz.ts）
- Playwright ブートストラップで管理者グループ ID を env 注入（bootstrapApp.ts）

## テスト
- npm run typecheck
- npm run lint
- npx playwright test tests/e2e/nav-and-status.smoke.spec.ts --workers=2

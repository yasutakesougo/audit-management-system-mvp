# コンポーネント逆引き（どの画面で再利用しているか）

| コンポーネント/モジュール | 主な用途/画面 | 備考 |
|---|---|---|
| AppShell.tsx | すべての画面 | サイド/トップナビ、レイアウト枠 |
| ProtectedRoute.tsx | すべてのルート | 未認証ブロック |
| RoleRoute.tsx | 権限制御ルート | `Staff/Admin/Viewer` |
| DashboardPageTabs.tsx | `/dashboard/*` | タブハブ |
| DashboardPage.tsx | `/dashboard/summary` など | 黒ノートメイン |
| MeetingGuidePage.tsx | `/dashboard/meeting` | 議事進行・決定事項集約 |
| WeeklySummaryChart.tsx | `/dashboard/summary` | 週次グラフ、`progress.ts` 依存 |
| progress.ts | ロジック共通 | 週次集計の純粋関数 |
| TimeFlowSupportRecordPage.tsx | `/records/daily` | 日次（黒ノート）入力 |
| SupportPlanGuidePage.tsx | `/guide/support-plan` | 個別支援計画ガイド |
| store.ts | 全画面 | 利用者/記録ストア |
| ui/* | 全画面 | 共通UIパーツ |
| types/* | 全画面 | 型定義 |
| lib/useSP | 取得/更新 | SP呼び出し、再試行・429対応 |

# UI 用語棚卸しチェックリスト

最終更新: 2026-04-09

## 1. 統一語ルール（固定）
- `全利用者の日次記録` → `日々の記録`
- `IBD専用計画文書` → `支援計画シート`
- `IBD専用実施画面` → `支援手順の実施`
- `IBD専用振り返り` → `見直し・PDCA`

## 1.1 表示語統一ルール（重要）
- UI表示で `ISP` と表記しない
  - 常に `個別支援計画` を使用する
- 例外（置換対象外）
  - コード識別子（型名・関数名・ファイル名）
  - コメント内の技術文脈

確認観点:
- ナビゲーション
- ページタイトル
- ボタン・CTA
- 空状態 / エラー / リダイレクト
- PDF / 帳票

## 2. 重点NG語（UIから排除）
- `ケース記録`
- `日次支援記録`
- `SPS`（UI表示語として）
- `再アセスメント`（UI表示語として）
- `実行`（CTA文言として）
- `記録入力`

## 3. 置換済み（第1バッチ）
- [x] ホームタイル文言を `日々の記録` に統一
- [x] Hub / Footer の `ケース記録` 系文言を `日々の記録` に統一
- [x] `/daily/menu` のカード見出し・CTAを `一覧形式の日々の記録` / `支援手順の実施` に統一
- [x] `/daily/*` の主要ヘッダー・一覧フォーム文言を `日々の記録` に統一
- [x] Today ライト導線（`todayCoreFlow` / `TodayLitePage`）を `日々の記録` に統一
- [x] サスペンド時ローディング文言（`lazyPages.tsx`）を新語へ統一

## 4. 残タスク（第2バッチ）

### A. ダッシュボード/例外導線（利用者に見える）
- [x] `src/features/exceptions/domain/exceptionLogic.ts`
- [x] `src/features/exceptions/domain/buildDailyRecordExceptions.ts`
- [x] `src/features/dashboard/activitySummary.ts`
- [x] `src/features/dashboard/briefing/constants.ts`
- [x] `src/features/dashboard/sections/impl/DailySection.tsx`
- [x] `src/features/dashboard/sections/impl/AdminOnlySection.tsx`
- [x] `src/features/cross-module/dailyUserSnapshot.ts`
- [x] `src/features/cross-module/mockData.ts`

### B. IBD画面の表示語（`SPS` のUI残り）
- [x] `src/pages/IBDHubPage.tsx`
- [x] `src/pages/IBDDemoSections.tsx`
- [x] `src/features/ibd/core/components/ProactiveAlertBanner.tsx`
- [x] `src/features/ibd/core/reports/AuditEvidenceReportPDF.tsx`

### C. KPI/説明文の `記録入力` 残り
- [x] `src/features/monitoring/components/MonitoringDailyDashboard.tsx`
- [x] `src/features/monitoring/domain/operationKpis.ts`
- [x] `src/pages/UsersSupportProcedurePage.tsx`

### D. 空状態/エラー/リダイレクト案内（最終統一）
- [x] `src/pages/DailyPage.tsx`
- [x] `src/pages/ScheduleUnavailablePage.tsx`
- [x] `src/features/users/UserDetailSections/SectionDetailContent.tsx`
- [x] `src/pages/support-planning-sheet/SupportPlanningSheetView.tsx`
- [x] `src/pages/SupportRecordPage.tsx`
- [x] `src/pages/TimeBasedSupportRecordPage.tsx`
- [x] `src/pages/daily-record/DailyRecordView.tsx`
- [x] `src/features/daily/components/lists/DailyRecordList.tsx`
- [x] `src/features/daily/lists/DailyRecordList.tsx`
- [x] `src/features/daily/components/lists/useDailyRecordViewModel.ts`
- [x] `src/features/daily/lists/useDailyRecordViewModel.ts`
- [x] `src/pages/daily-record/hooks/useDailyRecordOrchestrator.ts`

## 5. 検出コマンド（棚卸し用）
```bash
rg -n "ケース記録|日次支援記録|SPS|再アセスメント|記録入力" \
  src/app src/pages src/features \
  --glob "*.tsx" --glob "*.ts" \
  -g '!**/*.spec.ts' -g '!**/*.spec.tsx' -g '!**/__tests__/**'
```

## 6. 完了条件
- [x] 上記残タスクA/B/CのUI文言がゼロ
- [x] CTAボタン文言に `実行` が残らない（状態名・監査項目名・debug UI は除外）
- [x] パンくず・ヘッダー・空状態・リダイレクト案内で旧語ゼロ
- [x] 変更後に型チェック + 既存テストがグリーン

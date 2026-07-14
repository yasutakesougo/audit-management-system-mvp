# System Inventory Handoff - 2026-07-14

- 基準コミット: `776335643564b599683fecb3169097e3eb2d7825`
- 基準ブランチ: `origin/main`
- 調査worktree: `C:\tmp\audit-management-system-mvp-investigation`
- 調査方針: 製品コードは変更しない。発見事項は証拠、影響、推奨PR境界だけを記録する。

## 構造サマリー

このアプリは `src/app/router.tsx` が薄い合成層になっており、以下のRoute群を `childRoutes` に展開している。

| Route群 | 主な入口 | 主なFeature / Page | 権限境界 |
| --- | --- | --- | --- |
| dashboard | `/dashboard`, `/today`, `/ops` | dashboard, today, ops-dashboard | `RequireAudience`, `/today` は `ProtectedRoute flag="todayOps"` |
| daily | `/daily/*`, `/dailysupport` | daily, attendance, service-provision | `RequireAudience requiredRole="viewer"` |
| record | `/records/*`, `/billing`, `/meeting-minutes/*` | records, billing, handoff, meeting-minutes | 月次/日誌/実績は `reception`、請求は画面上 `viewer` |
| schedules | `/schedule*`, `/schedules/*`, `/schedule-ops` | schedules, transport | `ProtectedRoute flag="schedules"` + `RequireAudience viewer` |
| admin | `/admin/*`, `/users`, `/staff` | admin, users, staff | `RequireAudience admin/reception`、一部 `ProtectedRoute` |
| analysis / planning | `/analysis/*`, `/assessment`, `/support-plan-guide`, `/isp-editor*` | analysis, planning-sheet, support-plan-guide | viewer/admin混在 |
| kiosk | `/kiosk/*` | kiosk, kiosk toilet/procedure | `ProtectedRoute` |
| nurse | `/nurse/*` | nurse | `RequireAudience viewer` |
| hubs | `/planning`, `/operations`, `/master`, `/platform`, `/severe` など | `HubLanding` | `RequireAudience` は hub定義の `requiredRole` |

`src/features` は48個のトップレベル機能を持つ。調査対象の主要ドメインは `attendance`, `daily`, `records`, `reports`, `billing`, `users`, `schedules`, `kiosk`, `kokuhoren-*`, `service-provision`。

## 主要フロー

| 利用者操作 | Route | Feature / Panel | Hook / UseCase | Repository / Port | Adapter / 永続化 |
| --- | --- | --- | --- | --- | --- |
| 出欠確認・欠席登録 | `/daily/attendance` | `attendance/AttendancePanel` | `useAttendanceActions`, 欠席詳細Dialog | `AttendanceRepository` | `DataProviderAttendanceRepository` / in-memory |
| 出欠からサービス提供実績同期 | 操作入口は支援実績側 | `service-provision` | `useSyncAttendance` | `AttendanceRepository`, `ServiceProvisionRepository` | AttendanceDaily -> ServiceProvision upsert |
| 日次支援記録 | `/daily/table`, `/daily/support` | `daily` | table/procedure系hook | `DailyRecordRepository`, `ExecutionRecordRepository` | SharePoint / localStorage系storeが混在 |
| 月次支援実績 | `/records/monthly` | `records/monthly`, `MonthlyRecordPage` | `aggregateMonthlyKpi`, `executeKioskMonthlyAggregation` | kiosk/daily evidence repository | 月次集計ロジック、SharePoint summary mapping |
| 月次CSV出力 | ユーザーMenu等 | `reports/monthly/MonthlySummaryCsv.ts` | `exportMonthlySummary` | 入力rowsをCSV化 | browser Blob download |
| 月次PDF系 | `/records/monthly` のPDF操作 | `reports/achievement`, monthly PDF E2E | `useAchievementPDF` | daily/user repositories | react-pdf / browser操作 |
| 請求 | `/billing` | `billing/ui/BillingPage` | `useBillingSummary` | `BillingOrderRepository` | `/sites/2` List3, LocalStorage fallback |
| 国保連プレビュー | 機能導線から | `kokuhoren-preview` | `useKokuhorenMonthlyPreview` | `ServiceProvisionRepository` | 月次実績読み取り + validation |
| スケジュール確認・作成 | `/schedules/week`, `/schedules/create` | `schedules` | `useSchedules`, orchestrators | `ScheduleRepository` | SharePoint / demo / local E2E補助 |
| キオスク記録 | `/kiosk/users/:userId/procedures/:slotKey`, `/kiosk/toilet` | `kiosk` | `useToiletRecords` 等 | toilet/procedure repositories | SharePoint toilet repo / localStorage fallback |

## 境界観察

- Routeは概ねFeatureまたはPageをlazy importし、永続化Adapterを直接持たない。ただし、`ProtectedRoute` はスケジュールのSharePointリスト存在確認を行うため、画面到達可否と環境診断が同居している。
- Hubは `src/app/hubs/hubDefinitions.ts` がSSOTに近い。`HUB_DEFINITIONS` は権限、優先度、入口カードを持ち、route本体とは別管理。
- `src/app/routes/appRoutePaths.ts` は診断・Nav契約用の明示リストだが、nested routeやhub動的routeとの表現差がある。Route棚卸しではこのファイルだけを真実にしない。
- 請求は月次支援実績とは別系統。`docs/audit/phase4-monthly-billing-flow-boundary.md` も `MonthlyRecord_Summary` から `BillingOrders/List3` への変換契約は現行仕様にないと明記している。
- 欠席は Attendance と ServiceProvision では明示的に扱われる。一方で Daily新規作成抑止は設計文書上の方針として確認できるが、横断テストはまだ十分に固定されていない。

## 検証ログ

| コマンド | 結果 | 備考 |
| --- | --- | --- |
| `npm ci --ignore-scripts` | PASS | prod+dev合計42件のaudit警告。prodは別途12件。 |
| `npm run typecheck` | PASS | `tsc -p tsconfig.build.json --noEmit` |
| `npm run gen:system-map` | PASS with warning | `system-map.md` を生成。SP/MSAL env未設定は非致命警告。生成差分は調査後に戻した。 |
| `npm run arch:check` | PASS | 新規違反なし。既知違反918件はignore。 |
| 月次/請求/国保連代表Vitest | PASS | 6 files / 54 tests passed |
| `npm audit --omit=dev --json` | FAIL相当 | prod 12件。主に `firebase -> undici` と `exceljs -> uuid`。 |


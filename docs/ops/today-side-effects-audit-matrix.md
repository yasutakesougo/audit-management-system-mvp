# /today 副作用監査マトリクス（R/W・整合・失敗UX・監視）

- 作成日: 2026-03-26
- 対象: `/today` 経路（`src/pages/TodayOpsPage.tsx`）から到達する hook/repository/telemetry
- 目的: 運用監査・障害切り分け・権限境界の共通台帳（SSOT）

## 凡例

- 整合モデル: `refetch` / `optimistic+rollback` / `non-blocking` / `fire-and-forget`
- 失敗時UX: `toast` / `alert` / `warnのみ` / `silent`
- リスク: `低` / `中` / `高`

## 1. SP/API 副作用マトリクス

| リスト/API名 | `/today` での用途 | R/W | 更新方式 | 失敗時UX | 競合制御 | 監査証跡 | fallback | 監視対象 | リスク | 主要根拠 |
|---|---|---|---|---|---|---|---|---|---|---|
| `Users_Master` | Today要約、Exception集約、CallLog/Handoffの利用者選択 | R | `read-only`（`useUsersQuery` の共有query keyで購読） | `silent`（画面側で明示エラー表示なし） | なし | なし | demo/in-memory へ切替可 | 特になし | 中 | `src/features/users/hooks/useUsersQuery.ts:9,33,40`<br>`src/features/today/domain/useTodaySummary.ts:75`<br>`src/features/callLogs/components/CallLogQuickDrawer.tsx:53`<br>`src/features/handoff/HandoffQuickNoteCard.tsx:53`<br>`src/features/exceptions/hooks/useExceptionDataSources.ts:53` |
| `Schedules` | 当日レーン、送迎割当、高負荷タイル、利用者状態登録 | R/W | `refetch`（登録後）+ 局所 state 更新 | `warning toast` + conflict detail dialog（文言SSOT） | `etag` + `412` 分類 | なし | list欠落/書込不可で read-only | `authDiagnostics`、一部 hydration feature span | 高 | `src/features/today/hooks/useTodayScheduleLanes.ts:49`<br>`src/features/schedules/hooks/useUserStatusActions.ts:100,207,226`<br>`src/features/schedules/hooks/useSchedules.ts:264,269,297`<br>`src/features/schedules/infra/SharePointScheduleRepository.ts:413,452`<br>`src/features/today/feedback/operationFeedback.ts:1` |
| `TableDailyRecords` | QuickRecord 保存、承認、Exception未入力再同期 | R/W | `upsert` + `refetch`（保存成功後） | `toast`（保存）+ `alert`（承認） | `IF-MATCH`（競合の専用UX分類は未実装） | 日次提出イベント（分析用途） | demo/in-memory、`findItemByDate` 失敗時は `null` 扱い | hydration feature span（daily load/list/save） | 高 | `src/features/daily/infra/SharePointDailyRecordRepository.ts:22,148,170,290,323,352,386`<br>`src/features/daily/hooks/useTableDailyRecordForm.ts:294,317,330`<br>`src/pages/TodayOpsPage.tsx:484`<br>`src/features/today/widgets/ApprovalDialog.tsx:61` |
| `Transport_Log` | 送迎ステータス表示/更新 | R/W | `optimistic+rollback` | rollback時 `warning toast`（文言SSOT） | 複合キー upsert（明示排他なし） | transport telemetry（`transport:*`） | 404/400 で empty/no-op | Firestore telemetry（利用可能時） | 高 | `src/features/today/transport/useTransportStatus.ts:390,392,431`<br>`src/features/today/transport/transportRepo.ts:76,148,152,174,209,213`<br>`src/sharepoint/fields/transportFields.ts:20`<br>`src/features/today/feedback/operationFeedback.ts:1` |
| `AttendanceDaily`（送迎同期） | 到着時の送迎確定値反映 | R/W（補助） | `non-blocking` | 本体成功維持 + 同期失敗 `warning toast`（文言SSOT） | 明示排他なし | `transport:sync-failed` telemetry | 対象レコードなし/リストなしは skip | Firestore telemetry（利用可能時） | 高 | `src/features/today/transport/useTransportStatus.ts:405,412,415`<br>`src/features/today/transport/transportRepo.ts:248,280,296,301`<br>`src/sharepoint/fields/attendanceFields.ts:91`<br>`src/features/today/feedback/operationFeedback.ts:1` |
| `AttendanceDaily`（欠席系同期） | 利用者状態登録後の欠席/事前欠席同期 | W（補助） | `non-blocking`（Schedule 成功後の best-effort） | `warnのみ`（ダイアログ成功を維持） | `ifMatch` 更新（既存時） | なし | demo/in-memory、同期失敗は握りつぶし | 特になし | 中 | `src/features/schedules/hooks/useUserStatusActions.ts:158,166`<br>`src/features/attendance/infra/attendanceDailyRepository.ts:191,213,214` |
| `Handoff` | 申し送り一覧、新規追加、状態変更 | R/W | 状態変更は `optimistic+rollback`、作成は成功後挿入 | 作成=`alert`、状態変更失敗は実質 `silent`（panel未表示） | 同一IDの in-flight 排他 + API `If-Match: *` | 監査ログへ fire-and-forget 記録 | local/sharepoint 切替 | debug audit log（業務監視としては弱い） | 高 | `src/features/handoff/useHandoffTimeline.ts:71,157,188,220`<br>`src/features/handoff/components/HandoffPanel.tsx:40`<br>`src/features/handoff/HandoffQuickNoteCard.tsx:146`<br>`src/features/handoff/handoffApi.ts:255`<br>`src/features/handoff/handoffConfig.ts:14,18` |
| `Handoff_AuditLog` | Handoff 操作の監査追記 | W | `fire-and-forget` | `silent`（本体操作は継続） | なし | 監査ログ本体 | storage=`local` 時は localStorage 記録 | debug log | 中 | `src/features/handoff/useHandoffTimeline.ts:111,188`<br>`src/features/handoff/handoffAuditApi.ts:57,70,80,132` |
| `CallLogs` | 連絡ログ集計表示、QuickDrawer登録 | R/W | `refetch`（mutation成功時 invalidate） | 失敗時 `alert`、成功 `toast` | なし | なし | InMemory repo へ切替可 | 特になし | 中 | `src/features/callLogs/hooks/useCallLogs.ts:84,89,99`<br>`src/features/callLogs/components/CallLogQuickDrawer.tsx:92,96,148`<br>`src/features/callLogs/data/callLogFieldMap.ts:8`<br>`src/features/callLogs/data/callLogRepositoryFactory.ts:26,27` |
| `ISP_Master` | Exceptionの `hasPlan` 判定 | R | `read-only` | `warnのみ`（ISP失敗時は false attention 防止の安全側） | なし | なし | 失敗時 `hasPlan=true` 扱い | 特になし | 中 | `src/sharepoint/fields/ispThreeLayerFields.ts:16`<br>`src/features/exceptions/hooks/useExceptionDataSources.ts:129,136,192` |
| `SupportPlanningSheet_Master` | WorkflowPhases（支援計画カード） | R | `read-only`（`Promise.allSettled`） | `silent`（失敗ユーザーは未作成扱い） | なし | なし | reject を無視して継続 | 特になし | 中 | `src/sharepoint/fields/ispThreeLayerFields.ts:132`<br>`src/features/today/hooks/useWorkflowPhases.ts:197,199` |
| `Firestore telemetry` | landing/CTA/suggestion/transport イベント送信 | W | `fire-and-forget` | `warnのみ` / `silent`（UI非ブロッキング） | なし | telemetry のみ | Firestore未設定・E2E時は送信スキップ | これ自体が観測基盤 | 中 | `src/features/today/telemetry/recordLanding.ts:23,24`<br>`src/features/today/telemetry/recordCtaClick.ts:119,120`<br>`src/features/action-engine/telemetry/recordSuggestionTelemetry.ts:15`<br>`src/infra/firestore/client.ts:56` |
| `hydration route registry` | ルート別 hydration budget 監視 | R（監視設定） | `/today` を route key 登録して計測対象化済み | `silent`（計測のみ） | なし | なし | なし | route hydration span で継続監視 | 中 | `src/hydration/routes.ts:10,70`<br>`src/hydration/RouteHydrationListener.tsx:160,238`<br>`src/main.tsx:143` |

## 2. URL / Local 副作用マトリクス

| 対象 | `/today` での用途 | R/W | 更新方式 | 失敗時UX | 競合制御 | 監査証跡 | fallback | 監視対象 | リスク | 主要根拠 |
|---|---|---|---|---|---|---|---|---|---|---|
| URL `mode/userId/autoNext` + `ams_quick_auto_next` | QuickRecord 起動文脈と連続入力設定 | R/W | URL同期 + localStorage 永続化 | `silent` | なし | なし | localStorage不可時は既定値 `true` | なし | 中 | `src/features/today/records/useQuickRecord.ts:4,28,44,61-63,69-75` |
| URL `highlight/direction` | ExceptionCenter からの送迎 deep link | R/W（読取後に削除） | 初回読取→URL削除→5秒後自動解除 | `silent` | なし | なし | パラメータなし時は無効化 | なし | 低 | `src/features/today/transport/useTransportHighlight.ts:41,52,54,57` |
| `daily-table-record:*`（unsent/draft/lastActivities） | QuickRecord 埋め込みフォームの復元/補助 | R/W | localStorage + URL `unsent` 同期 | 下書き保存失敗は `toast`、他は `warn`/`silent` | なし | なし | 読込失敗時は初期値復帰 | なし | 中 | `src/features/daily/hooks/useTableDailyRecordRouting.ts:8,91,103`<br>`src/features/daily/hooks/useTableDailyRecordPersistence.ts:13`<br>`src/features/daily/hooks/useLastActivities.ts:8` |
| `executionRecord.v1` + `procedureStore.v1` | 支援手順記録の完了率算出（Today司令塔） | R/W | localStorage 永続 Zustand | parse失敗時は破棄して再初期化 | なし | なし | `procedureStore` は `BASE_STEPS` へフォールバック | なし | 高 | `src/features/daily/domain/executionRecordTypes.ts:84`<br>`src/features/daily/stores/procedureStore.ts:32,121`<br>`src/features/today/hooks/useSupportRecordCompletion.ts:12,97` |
| `isokatsu.exception-preferences.v1` | Exception の dismiss/snooze 維持 | R/W | localStorage 永続 Zustand | `silent` | なし | なし | version不一致時はクリア | なし | 低 | `src/features/exceptions/hooks/useExceptionPreferences.ts:20,41,57` |
| `today.nextAction.v1`（legacy） | NextAction進捗の旧ローカル状態 | R/W | localStorage | `silent` | なし | なし | 依存縮小中（deprecated） | なし | 低 | `src/features/today/hooks/useNextActionProgress.ts:22` |
| `ams_today_autonext_*` | auto-next 利用回数カウンタ | R/W | localStorage カウンタ更新 | `silent` | なし | なし | Storage不可時は no-op | なし | 低 | `src/features/today/records/autoNextCounters.ts:15-20` |

## 3. 即優先（運用向け）

1. 完了: `/today` を hydration route key に登録して、ルート単位の初期表示監視を有効化。
2. 完了: `useUsers` 呼び出し経路を `/today` 配下で `useUsersQuery` に統一し、初期重複取得を抑止。
3. 完了: 失敗UXを 3 分類（`412 conflict` / `optimistic rollback` / `non-blocking sync failure`）で統一し、`operationFeedback` をSSOT化。

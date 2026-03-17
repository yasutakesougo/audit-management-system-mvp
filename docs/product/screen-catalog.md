# 福祉オペレーションOS — Screen Catalog v1

> **ドキュメント種別:** 画面一覧書（Screen Catalog）  
> **ステータス:** Draft  
> **初版:** 2026-03-17  
> **最終更新:** 2026-03-17  
> **準拠:** [要件定義書](welfare-operations-os-requirements-v1.md) / [設計原則](principles.md) / [UI規約](ui-conventions.md) / [アーキテクチャ](support-operations-os-architecture.md)

---

## 目次

- [概要](#概要)
- [画面体系図](#画面体系図)
- [A. Execution Layer（現場）](#a-execution-layer現場)
  - [A1. TodayPage](#a1-todaypage)
  - [A2. DailyRecordPage](#a2-dailyrecordpage)
  - [A3. UserDetailPage](#a3-userdetailpage)
  - [A4. HandoffTimelinePage](#a4-handofftimelinepage)
  - [A5. AbcRecordPage](#a5-abcrecordpage)
- [B. Synthesis Layer（支援設計）](#b-synthesis-layer支援設計)
  - [B1. SupportPlanGuidePage](#b1-supportplanguidepage)
  - [B2. PlanningSheetPage](#b2-planningsheetpage)
  - [B3. MonitoringDashboardPage](#b3-monitoringdashboardpage)
  - [B4. AnalysisWorkspacePage](#b4-analysisworkspacepage)
  - [B5. AssessmentDashboardPage](#b5-assessmentdashboardpage)
- [C. Control Layer（管理）](#c-control-layer管理)
  - [C1. OperationsDashboardPage](#c1-operationsdashboardpage)
  - [C2. ExceptionCenterPage](#c2-exceptioncenterpage)
  - [C3. SafetyDashboardPage](#c3-safetydashboardpage)
  - [C4. AuditLogPage](#c4-auditlogpage)
  - [C5. AdminHubPage](#c5-adminhubpage)
- [付録: コンポーネント依存マトリクス](#付録-コンポーネント依存マトリクス)
- [付録: 画面間ナビゲーションマップ](#付録-画面間ナビゲーションマップ)
- [変更履歴](#変更履歴)

---

## 概要

本文書は、福祉オペレーションOSを構成する **全15画面** の設計仕様書である。

各画面について以下を定義する。

| 定義項目 | 内容 |
|---------|------|
| 目的 | この画面が何を解決するか |
| レイアウト | コンポーネントの配置構造 |
| コンポーネント構成 | 使用するウィジェット・パーツ |
| データソース | 接続するリポジトリ・ドメインロジック |
| 実装ステータス | ✅ 完成 / 🔄 拡張 / 📋 新規 |

---

## 画面体系図

```
福祉オペレーションOS — 15 Screens
│
├─ A. Execution Layer（現場職員が毎日使う）
│  ├─ A1. TodayPage .............. /today ................. ✅ 実装済
│  ├─ A2. DailyRecordPage ........ /daily/support ......... ✅ 実装済 → 🔄拡張
│  ├─ A3. UserDetailPage ......... /users/:userId ......... ⚠️ 基本あり → 🔄再設計
│  ├─ A4. HandoffTimelinePage .... /handoff-timeline ...... ✅ 実装済
│  └─ A5. AbcRecordPage .......... /abc-record ............ ✅ 実装済
│
├─ B. Synthesis Layer（支援設計者が使う）
│  ├─ B1. SupportPlanGuidePage ... /support-plan-guide .... ✅ 実装済
│  ├─ B2. PlanningSheetPage ...... /support-planning-sheet  ✅ 実装済 → 🔄拡張
│  ├─ B3. MonitoringDashboardPage  (タブ内) ............... ✅ 実装済 → 🔄拡張
│  ├─ B4. AnalysisWorkspacePage .. /analysis .............. ✅ 実装済
│  └─ B5. AssessmentDashboardPage  /assessment ............ ✅ 実装済
│
└─ C. Control Layer（管理者が使う）
   ├─ C1. OperationsDashboardPage  /dashboard ............. ✅ 実装済 → 🔄拡張
   ├─ C2. ExceptionCenterPage .... 新規 .................. 📋 新規
   ├─ C3. SafetyDashboardPage .... (タブ内) ............... ✅ 実装済
   ├─ C4. AuditLogPage ........... 新規 .................. 📋 新規
   └─ C5. AdminHubPage ........... /admin ................. ✅ 実装済
```

---

# A. Execution Layer（現場）

> **支配原則:** [原則 1（現場導線主体）](principles.md#原則-1--主役は-ai-ではなく現場導線である)、[原則 2（入力最小化）](principles.md#原則-2--記録負担を増やしてはならない)

---

## A1. TodayPage

| 項目 | 内容 |
|------|------|
| **ルート** | `/today` |
| **目的** | ログイン直後に「今やるべきこと」を順序づけて提示し、未処理ゼロ化を達成する |
| **対象ユーザー** | 全職員（役割別表示切替） |
| **対応原則** | 原則 1, 7 |
| **実装ステータス** | ✅ 実装済 |
| **ページコンポーネント** | `src/features/today/layouts/TodayBentoLayout.tsx` |
| **責務定義** | [screen-responsibility-map.md](../architecture/screen-responsibility-map.md) |
| **ADR** | `ADR-002-today-execution-layer-guardrails.md` |

### レイアウト構造

```
TodayPage
┌──────────────────────────────────────────────┐
│  TodayPhaseIndicator (運営フェーズ表示)         │
├──────────────────────────────────────────────┤
│  NextActionCard [4col, accent]                │  ← PRIMARY
│  「今すぐやること」即答                         │
├──────────────────────────────────────────────┤
│  TodayTasksCard [4col]                        │  ← Optional
│  エンジン駆動の焦点タスク                       │
├──────────────────┬───────────────────────────┤
│  ProgressStatusBar│  AttendanceSummaryCard    │
│  [3col]           │  [1col]                   │
├──────────────────┴───────────────────────────┤
│  BriefingActionList [4col, subtle]            │
│  対応が必要な申し送り（consumer表示のみ）       │
├──────────────────────────────────────────────┤
│  TodayServiceStructureCard [4col]             │  ← Optional
│  業務体制表示                                   │
├──────────────────────────────────────────────┤
│  PlanningWorkflowCard [4col]                  │  ← Optional
│  支援計画管理（期限・進捗）                     │
├──────────────────────────────────────────────┤
│  UserCompactList [4col]                       │
│  利用者一覧 + QuickRecord CTA                  │
├──────────────────────────────────────────────┤
│  TransportStatusCard [4col]                   │
│  送迎ステータス                                │
└──────────────────────────────────────────────┘
```

### コンポーネント構成

| コンポーネント | パス | 役割 | 種別 |
|--------------|------|------|------|
| `TodayPhaseIndicator` | `features/today/widgets/` | 運営フェーズ表示 | ✅ 既存 |
| `NextActionCard` | `features/today/widgets/` | 次アクション誘導 | ✅ 既存 |
| `TodayTasksCard` | `features/today/widgets/` | タスク一覧 | ✅ 既存 |
| `ProgressStatusBar` | `features/today/widgets/` | 進捗チップバー | ✅ 既存 |
| `AttendanceSummaryCard` | `features/today/widgets/` | 出席状況 | ✅ 既存 |
| `BriefingActionList` | `features/today/widgets/` | 申し送り簡易表示 | ✅ 既存 |
| `UserCompactList` | `features/today/widgets/` | 利用者リスト+CTA | ✅ 既存 |
| `PlanningWorkflowCard` | `features/today/widgets/` | 計画管理カード | ✅ 既存 |
| `TransportStatusCard` | `features/today/transport/` | 送迎管理 | ✅ 既存 |
| `QuickRecordDrawer` | `features/today/records/` | クイック記録入力 | ✅ 既存 |
| **`ActionQueueCard`** | — | 未入力キュー | **📋 新規** |

### データソース

| データ | ソース | 既存 |
|--------|--------|------|
| 次アクション | `useNextAction.ts` → `buildSceneNextAction.ts` | ✅ |
| 進捗 | `useNextActionProgress.ts`, `useSupportRecordCompletion.ts` | ✅ |
| 出席 | `AttendanceRepository` | ✅ |
| 申し送り | `HandoffRepository` → `alertRules.ts` | ✅ |
| 場面推定 | `deriveCurrentScene.ts`, `inferTodayScene.ts` | ✅ |
| タスク | `useTodayTasks.ts` | ✅ |
| 計画管理 | `useWorkflowPhases.ts` | ✅ |

### 🔄 次世代拡張項目

| 拡張 | 内容 | 要件定義 §参照 |
|------|------|--------------|
| `ActionQueueCard` | 未入力記録・未確認申し送り・未完了タスクのキュー | §4.2 |
| 役割別表示切替 | 管理者→例外KPI優先、現場→タスク優先 | §5.1 |
| `SyncStatusIndicator` | SharePoint同期状態表示 | §6.1 |

---

## A2. DailyRecordPage

| 項目 | 内容 |
|------|------|
| **ルート** | `/daily/support`, `/daily/table`, `/dailysupport` |
| **目的** | 現場記録を**速く・迷わず・漏れなく**入力する |
| **対象ユーザー** | 現場職員 |
| **対応原則** | 原則 2, 7 |
| **実装ステータス** | ✅ 実装済 → 🔄 構造化拡張 |
| **ページコンポーネント** | `src/pages/DailyRecordPage.tsx`, `TableDailyRecordForm.tsx` |

### レイアウト構造

```
DailyRecordPage
┌────────────────────────────────┬────────────────────┐
│  上部: 利用者サマリ              │                    │
│  名前 / 注意事項 / 本日出欠      │                    │
├────────────────────────────────┤  右: ContextPanel   │
│  中央: RecordEditor             │  (PC版のみ)        │
│  ┌──────────────────────────┐  │  ┌────────────────┐│
│  │ 日付 / 時間帯             │  │  │ 当日既存記録   ││
│  │ 活動カテゴリ              │  │  │ 前回記録       ││
│  │ 本人の様子（テキスト）     │  │  │ 注意事項       ││
│  │ 特記事項                  │  │  │ バイタル       ││
│  │ 構造化タグ                │  │  │ 申し送り       ││
│  │ テンプレート/マクロ候補    │  │  │ 関連インシデント││
│  │ 添付                     │  │  └────────────────┘│
│  └──────────────────────────┘  │                    │
├────────────────────────────────┴────────────────────┤
│  下部: SaveBar                                       │
│  [💾 自動保存済 18:05]  [→ 次の未入力へ]              │
└──────────────────────────────────────────────────────┘
```

### コンポーネント構成

| コンポーネント | パス | 種別 |
|--------------|------|------|
| `TableDailyRecordForm` | `features/daily/forms/` | ✅ 既存 |
| `DailyRecordFilterPanel` | `pages/` | ✅ 既存 |
| `DailyRecordStatsPanel` | `pages/` | ✅ 既存 |
| `DailyRecordBulkActions` | `pages/` | ✅ 既存 |
| 支援ウィザード | `features/daily/components/wizard/` | 🔄 進行中 |
| **`ContextPanel`** | — | **📋 新規** |
| **`RecordEditor`** | — | **📋 新規**（統合入力） |
| **`SaveBar`** | — | **📋 新規**（保存状態+次遷移） |

### データソース

| データ | ソース | 既存 |
|--------|--------|------|
| 日中記録 | `DailyRecordRepository` | ✅ |
| 利用者情報 | `UserRepository` | ✅ |
| 行動タグ | `behaviorTag.ts`, `behaviorTagInsights.ts` | ✅ |
| 手順 | `features/daily/components/procedure/` | ✅ |

### 🔄 次世代拡張項目

| 拡張 | 内容 | Phase |
|------|------|-------|
| `ContextPanel` | 記録入力中に参考情報を右パネル表示 | Phase 2 |
| 構造化タグ入力 | `tags[]` フィールドの構造化入力UI | Phase 1 |
| マクロ展開 | `//` でテンプレート展開 | Phase 2 |
| オートセーブ | localStorage → SharePoint 段階保存 | Phase 1 |
| 次の未入力遷移 | `resolveNextUser.ts` 拡張 | Phase 1 |

---

## A3. UserDetailPage

| 項目 | 内容 |
|------|------|
| **ルート** | `/users/:userId` |
| **目的** | 利用者の全情報への**ハブ画面**。基本情報＋関連画面ショートカット |
| **対象ユーザー** | 全職員 |
| **対応原則** | 原則 1, 6 |
| **実装ステータス** | ⚠️ 基本あり → 🔄 **再設計必要** |
| **ページコンポーネント** | `src/pages/UserDetailPage.tsx`（既存は編集フォーム中心） |

### レイアウト構造

```
UserDetailPage
┌──────────────────────────────────────────────┐
│  UserHeader                                    │
│  名前 / 年齢 / 障害区分 / 契約種別              │
├──────────────────────────────────────────────┤
│  ⚠️ CriticalNoticeBar                         │
│  アレルギー / 禁忌 / 特別対応（常時最上部表示）  │
├──────────────┬──────────────┬────────────────┤
│ QuickAction  │ QuickAction  │ QuickAction    │
│ 📝 記録する  │ 📋 計画を見る │ 📊 分析を見る  │
├──────────────┴──────────────┴────────────────┤
│  InfoCard: 契約/通所情報                       │
├──────────────────────────────────────────────┤
│  InfoCard: 最新記録要約（直近3日）              │
├──────────────────────────────────────────────┤
│  InfoCard: リスク情報（スコア+インシデント履歴） │
├──────────────────────────────────────────────┤
│  InfoCard: 関連ドキュメント                     │
│  支援計画リスト / モニタリング履歴               │
└──────────────────────────────────────────────┘
```

### コンポーネント構成

| コンポーネント | 種別 | 備考 |
|--------------|------|------|
| `UserHeader` | 🔄 再設計 | 既存の編集UIからハブ表示へ |
| **`CriticalNoticeBar`** | **📋 新規** | 注意事項の常時表示 |
| **`QuickActionGroup`** | **📋 新規** | 記録/計画/分析への3ボタン |
| `InfoCard` (汎用) | 📋 新規 | カード型情報表示 |
| `RecentRecordSummary` | 📋 新規 | 直近記録のダイジェスト |

### データソース

| データ | ソース | 既存 |
|--------|--------|------|
| 利用者基本情報 | `UserRepository` | ✅ |
| 出欠 | `AttendanceRepository` | ✅ |
| 注意事項 | `HandoffRepository` + `AssessmentRepository` | ✅ |
| リスクスコア | `riskScoring.ts` | ✅ |
| 支援計画一覧 | `PlanningSheetRepository` | ✅ |

---

## A4. HandoffTimelinePage

| 項目 | 内容 |
|------|------|
| **ルート** | `/handoff-timeline` |
| **目的** | 申し送りを**書いて・追跡して・会議でクローズ**する |
| **対象ユーザー** | 全職員 |
| **対応原則** | 原則 1, 6 |
| **実装ステータス** | ✅ 実装済 |
| **ページコンポーネント** | `src/pages/HandoffTimelinePage.tsx` |
| **責務定義** | [screen-responsibility-map.md](../architecture/screen-responsibility-map.md) |

### コンポーネント構成

| コンポーネント | パス | 種別 |
|--------------|------|------|
| `HandoffLiveFeed` | `features/handoff/components/` | ✅ |
| `CompactNewHandoffInput` | `features/handoff/components/` | ✅ |
| `HandoffCommentThread` | `features/handoff/components/` | ✅ |
| `HandoffStatusTransition` | `features/handoff/components/` | ✅ |
| `HandoffWeekView` | `features/handoff/components/` | ✅ |
| `HandoffMonthView` | `features/handoff/components/` | ✅ |
| `HandoffAuditLogView` | `features/handoff/components/` | ✅ |
| `HandoffCategorySummaryCard` | `features/handoff/` | ✅ |

### データソース

| データ | ソース | 既存 |
|--------|--------|------|
| 申し送りCRUD | `HandoffRepository` | ✅ |
| ステータス遷移 | `handoffStateMachine.ts` | ✅ |
| 監査ログ | `handoffAuditTypes.ts` | ✅ |
| 分析 | `analysis/` ディレクトリ全体 | ✅ |

---

## A5. AbcRecordPage

| 項目 | 内容 |
|------|------|
| **ルート** | `/abc-record` |
| **目的** | 行動の機能分析（Antecedent-Behavior-Consequence）を構造化記録する |
| **対象ユーザー** | 現場職員、支援設計者 |
| **対応原則** | 原則 2, 6 |
| **実装ステータス** | ✅ 実装済 |
| **ページコンポーネント** | `src/pages/AbcRecordPage.tsx` |

### データソース

| データ | ソース | 既存 |
|--------|--------|------|
| ABC記録 | `localAbcRecordRepository.ts` | ✅ |
| パターン分析 | `evidencePatternAnalysis.ts` | ✅ |
| 逆方向トレース | `reverseTrace.ts` | ✅ |

---

# B. Synthesis Layer（支援設計）

> **支配原則:** [原則 3（候補提示）](principles.md#原則-3--提案は命令ではなく候補として提示する)、[原則 4（根拠付与）](principles.md#原則-4--提案には必ず根拠を添える)、[原則 5（人間決定）](principles.md#原則-5--最終決定は必ず人が行う)

---

## B1. SupportPlanGuidePage

| 項目 | 内容 |
|------|------|
| **ルート** | `/support-plan-guide` |
| **目的** | ISP (L1) の管理・制度遵守状態の確認・計画シートへの導線 |
| **対象ユーザー** | 支援設計者、管理者 |
| **対応原則** | 原則 5, 9 |
| **実装ステータス** | ✅ 実装済 |

### コンポーネント構成

| コンポーネント | パス | 種別 |
|--------------|------|------|
| `RegulatorySummaryBand` | `features/support-plan-guide/components/` | ✅ |
| `PlanningSheetStatsGrid` | `features/support-plan-guide/components/` | ✅ |
| `PlanningSheetVersionPanel` | `features/support-plan-guide/components/` | ✅ |
| `RegulatorySection` | `features/support-plan-guide/components/` | ✅ |

### データソース

| データ | ソース | 既存 |
|--------|--------|------|
| ISPバンドル | `useSupportPlanBundle.ts` | ✅ |
| 制度遵守 | `useRegulatorySummary.ts` → `auditChecks.ts` | ✅ |
| ドラフト管理 | `SupportPlanDraftRepository` | ✅ |

---

## B2. PlanningSheetPage

| 項目 | 内容 |
|------|------|
| **ルート** | `/support-planning-sheet/:planningSheetId` |
| **目的** | 支援計画シート (L2) の編集。記録を根拠として計画を設計・更新する |
| **対象ユーザー** | 支援設計者 |
| **対応原則** | 原則 3, 4, 5 |
| **実装ステータス** | ✅ 実装済 → 🔄 コンテキストパネル拡張 |
| **ページコンポーネント** | `src/pages/SupportPlanningSheetPage.tsx` |

### レイアウト構造

```
PlanningSheetPage
┌──────────┬──────────────────────────────┬──────────────────┐
│ 左:       │  中央: 計画本文編集           │ 右: Context      │
│ セクション │                              │ Panel            │
│ ナビ      │  EditableOverviewSection      │                  │
│           │  EditableAssessmentSection    │  過去記録サマリ   │
│ □ 概要    │  EditablePlanningDesignSection│  ヒヤリハット     │
│ ☑ 計画設計│  EditableIntakeSection        │  前回計画        │
│ □ 制度事項│  EditableRegulatorySection    │  アセスメント     │
│           │                              │  バイタル/傾向    │
│           │  [ProvenanceBadge]            │  アンケート特性   │
│           │  [EvidencePatternSummaryCard] │  モニタリング履歴 │
│           │  [PhaseNextStepBanner]        │                  │
├──────────┴──────────────────────────────┴──────────────────┤
│  下部: ImportDialogs / ProposalPanel                        │
│  [ImportAssessmentDialog] [ImportMonitoringDialog]          │
│  [ImportTemplateDialog] [EvidenceLinkSelector]              │
└────────────────────────────────────────────────────────────┘
```

### コンポーネント構成

| コンポーネント | パス | 種別 |
|--------------|------|------|
| `EditableOverviewSection` | `features/planning-sheet/components/` | ✅ |
| `EditableAssessmentSection` | `features/planning-sheet/components/` | ✅ |
| `EditablePlanningDesignSection` | `features/planning-sheet/components/` | ✅ |
| `EditableRegulatorySection` | `features/planning-sheet/components/` | ✅ |
| `ProvenanceBadge` | `features/planning-sheet/components/` | ✅ |
| `EvidencePatternSummaryCard` | `features/planning-sheet/components/` | ✅ |
| `PhaseNextStepBanner` | `features/planning-sheet/components/` | ✅ |
| `ImportAssessmentDialog` | `features/planning-sheet/components/` | ✅ Bridge 1 |
| `ImportMonitoringDialog` | `features/planning-sheet/components/` | ✅ Bridge 3 |
| `ImportHistoryTimeline` | `features/planning-sheet/components/` | ✅ |
| `EvidenceLinkSelector` | `features/planning-sheet/components/` | ✅ |
| **`ContextPanel`** | — | **📋 新規** |
| **`DiffViewer`** | — | **📋 新規** |
| **`SuggestionPanel`** | — | **📋 新規** |

### データソース

| データ | ソース | 既存 |
|--------|--------|------|
| 計画シート | `usePlanningSheetForm.ts` → `PlanningSheetRepository` | ✅ |
| Bridge 1 | `assessmentBridge.ts` | ✅ |
| Bridge 2 | `planningToRecordBridge.ts` | ✅ |
| Bridge 3 | `monitoringToPlanningBridge.ts` | ✅ |
| Provenance | `importAuditStore.ts` | ✅ |
| Evidence | `EvidenceLinkRepository` | ✅ |
| 特性 | `tokuseiBridgeBuilders.ts` | ✅ |

---

## B3. MonitoringDashboardPage

| 項目 | 内容 |
|------|------|
| **ルート** | タブ内（SupportPlanGuide / PlanningSheet から到達） |
| **目的** | 支援計画の進捗と見直し要否を確認する |
| **対象ユーザー** | 支援設計者 |
| **対応原則** | 原則 6 |
| **実装ステータス** | ✅ 実装済 → 🔄 差分表示拡張 |

### コンポーネント構成

| コンポーネント | パス | 種別 |
|--------------|------|------|
| `GoalProgressCard` | `features/monitoring/components/` | ✅ |
| `IspRecommendationCard` | `features/monitoring/components/` | ✅ |
| `IspPlanDraftPreview` | `features/monitoring/components/` | ✅ |
| `MonitoringDailyDashboard` | `features/monitoring/components/` | ✅ |
| `IspDecisionHistorySection` | `features/monitoring/components/` | ✅ |
| `DraftHistoryPanel` | `features/monitoring/components/` | ✅ |

### データソース

| データ | ソース | 既存 |
|--------|--------|------|
| 目標進捗 | `goalProgressUtils.ts`, `evaluateGoalProgress.ts` | ✅ |
| ISP推奨 | `ispRecommendationUtils.ts` | ✅ |
| ドラフト | `ispPlanDraftUtils.ts` | ✅ |
| 日次分析 | `monitoringDailyAnalytics.ts` | ✅ |
| 判断履歴 | `IspDecisionRepository` | ✅ |
| スケジュール | `monitoringSchedule.ts` | ✅ |

---

## B4. AnalysisWorkspacePage

| 項目 | 内容 |
|------|------|
| **ルート** | `/analysis` |
| **目的** | 分析ツール群の統合ワークスペース（氷山分析、PDCA、介入分析） |
| **対象ユーザー** | 支援設計者、管理者 |
| **実装ステータス** | ✅ 実装済 |

### サブ画面

| タブ/ルート | コンポーネント | 種別 |
|-----------|--------------|------|
| `/analysis/dashboard` | `AnalysisDashboardPage` | ✅ |
| `/analysis/iceberg-pdca` | `IcebergPdcaPage` | ✅ |
| `/analysis/iceberg` | `IcebergAnalysisPage` | ✅ |
| `/analysis/intervention` | `InterventionDashboardPage` | ✅ |

---

## B5. AssessmentDashboardPage

| 項目 | 内容 |
|------|------|
| **ルート** | `/assessment` |
| **目的** | ICF分類に基づくアセスメントの管理・入力 |
| **対象ユーザー** | 支援設計者 |
| **実装ステータス** | ✅ 実装済 |

---

# C. Control Layer（管理）

> **支配原則:** 例外駆動管理（要件定義書 §2.3）

---

## C1. OperationsDashboardPage

| 項目 | 内容 |
|------|------|
| **ルート** | `/dashboard` |
| **目的** | 施設運営の俯瞰。集計・傾向の**読み取り専用**表示 |
| **対象ユーザー** | 管理者、サービス管理責任者 |
| **対応原則** | 新規: 例外駆動管理 |
| **実装ステータス** | ✅ 実装済 → 🔄 例外KPI拡張 |
| **責務定義** | [screen-responsibility-map.md](../architecture/screen-responsibility-map.md) |

### 🔄 次世代拡張項目

| 拡張 | 内容 | Phase |
|------|------|-------|
| **HeroMetricCard** (3〜5件) | 未作成計画/未入力率/インシデント/モニタ遅延/稼働率 | Phase 3 |
| 例外ハイライト | 閾値超過項目の強調表示 | Phase 3 |
| ドリルダウン導線 | KPI → 詳細 → 是正アクション | Phase 3 |

---

## C2. ExceptionCenterPage

| 項目 | 内容 |
|------|------|
| **ルート** | 新規（`/admin/exceptions` 想定） |
| **目的** | 未記入・期限超過・インシデント集中・負荷偏在を**例外一覧**で管理 |
| **対象ユーザー** | 管理者 |
| **対応原則** | 新規: 例外駆動管理 |
| **実装ステータス** | **📋 新規** |

### レイアウト構造

```
ExceptionCenterPage
┌──────────────────────────────────────────────┐
│  HeroMetricCard × 5 (未入力/遅延/インシデント) │
├──────────────────────────────────────────────┤
│  ExceptionTable                               │
│  ┌────────┬──────┬──────┬──────┬───────────┐ │
│  │ 種別    │ 対象 │ 緊急度│ 状態 │ アクション │ │
│  ├────────┼──────┼──────┼──────┼───────────┤ │
│  │ 未入力  │ 田中 │ 🔴   │ 未対応│ [対応]   │ │
│  │ 期限超過│ 鈴木 │ 🟡   │ 対応中│ [確認]   │ │
│  └────────┴──────┴──────┴──────┴───────────┘ │
├──────────────────────────────────────────────┤
│  DrilldownDrawer (右からスライド)              │
│  対象の詳細情報 + 是正アクション記録            │
└──────────────────────────────────────────────┘
```

### コンポーネント構成（全て新規）

| コンポーネント | 役割 |
|--------------|------|
| **`HeroMetricCard`** | KPI表示（閾値超過で色変化） |
| **`ExceptionTable`** | 例外一覧テーブル（ソート・フィルタ） |
| **`DrilldownDrawer`** | 右ドロワーで詳細表示 |
| **`CorrectionActionForm`** | 是正アクション記録フォーム |

---

## C3. SafetyDashboardPage

| 項目 | 内容 |
|------|------|
| **ルート** | タブ内 |
| **目的** | 安全管理（インシデント、身体拘束、委員会、研修）の統合ダッシュボード |
| **対象ユーザー** | 管理者 |
| **実装ステータス** | ✅ 実装済 |

### コンポーネント構成

| コンポーネント | パス | 種別 |
|--------------|------|------|
| `ComplianceDashboard` | `features/safety/components/` | ✅ |
| `SafetyOperationsSummaryCard` | `features/safety/components/` | ✅ |
| `IncidentHistoryList` | `features/safety/components/` | ✅ |
| `RestraintHistoryList` | `features/safety/components/` | ✅ |
| `TrainingRecordDialog` | `features/safety/components/` | ✅ |

---

## C4. AuditLogPage

| 項目 | 内容 |
|------|------|
| **ルート** | 新規（`/admin/audit-log` 想定） |
| **目的** | 監査ログ・同期エラー・操作履歴の一覧表示 |
| **対象ユーザー** | 管理者 |
| **実装ステータス** | **📋 新規**（基盤は `audit.ts` に存在） |

### コンポーネント構成

| コンポーネント | 種別 |
|--------------|------|
| **`AuditLogTable`** | 📋 新規 |
| **`SyncErrorList`** | 📋 新規 |
| `HandoffAuditLogView` | ✅ 既存（参考実装） |

---

## C5. AdminHubPage

| 項目 | 内容 |
|------|------|
| **ルート** | `/admin` |
| **目的** | 管理ツール群への統合ハブ |
| **対象ユーザー** | 管理者 |
| **実装ステータス** | ✅ 実装済 |

### サブ画面

| ルート | 画面 | 種別 |
|--------|------|------|
| `/admin/templates` | テンプレート管理 | ✅ |
| `/admin/step-templates` | ステップテンプレート | ✅ |
| `/admin/regulatory-dashboard` | 制度遵守ダッシュボード | ✅ |
| `/admin/data-integrity` | データ整合性チェック | ✅ |
| `/admin/navigation-diagnostics` | ナビ診断 | ✅ |
| `/admin/mode-switch` | モード切替 | ✅ |
| `/admin/csv-import` | CSVインポート | ✅ |
| `/settings/operation-flow` | 1日の流れ設定 | ✅ |

---

# 付録: コンポーネント依存マトリクス

共通コンポーネント（[要件定義書 §6.1](welfare-operations-os-requirements-v1.md#61-共通コンポーネント一覧)）がどの画面で使用されるか。

| コンポーネント | A1 | A2 | A3 | A4 | A5 | B1 | B2 | B3 | B4 | B5 | C1 | C2 | C3 | C4 | C5 |
|--------------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `HeroMetricCard` | | | | | | | | | | | ◎ | ◎ | | | |
| `ActionQueueCard` | ◎ | | | | | | | | | | | | | | |
| `AlertBanner` | ◎ | | ○ | | | | | | | | ○ | ◎ | ◎ | | |
| `ContextPanel` | | ◎ | | | | | ◎ | | | | | | | | |
| `RecordEditor` | | ◎ | | | ○ | | | | | | | | | | |
| `SuggestionPanel` | | ○ | | | | | ◎ | ◎ | | | | | | | |
| `DiffViewer` | | | | | | | ◎ | ◎ | | | | | | | |
| `EmptyStateAction` | ◎ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | |
| `SyncStatusIndicator` | ◎ | ◎ | | | | | ◎ | | | | | | | | |
| `ExceptionTable` | | | | | | | | | | | ○ | ◎ | | | |
| `DrilldownDrawer` | | | | | | | | | | | ○ | ◎ | ○ | | |
| `ProposalCard` | ○ | | | | | | ◎ | ◎ | ○ | | | | | | |
| `ProvenanceBadge` | | | | | | | ◎ | | | | | | | | |

◎ = 主要使用画面 / ○ = 補助的使用

---

# 付録: 画面間ナビゲーションマップ

```
                         ┌─────────────┐
                         │  ログイン     │
                         └──────┬──────┘
                                │
                    ┌───────────┼──────────────┐
                    ▼           ▼              ▼
              ┌──────────┐ ┌──────────┐ ┌──────────────┐
              │A1 Today  │ │B1 ISP    │ │C1 Dashboard  │
              │(現場)    │ │(設計者)  │ │(管理者)      │
              └──┬───────┘ └──┬───────┘ └──┬───────────┘
                 │            │            │
    ┌────────────┼────┐       │       ┌────┼────────────┐
    ▼            ▼    ▼       ▼       ▼    ▼            ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│A2 Daily│ │A4 申送 │ │B2 計画   │ │C2 例外   │ │C3 安全   │
│Record  │ │Timeline│ │Sheet     │ │Center    │ │Dashboard │
└───┬────┘ └────────┘ └──┬───────┘ └──┬───────┘ └──────────┘
    │                     │            │
    └──────────┬──────────┘            │
               ▼                       ▼
         ┌──────────┐           ┌──────────┐
         │A3 User   │           │C4 Audit  │
         │Detail    │           │Log       │
         └──────────┘           └──────────┘

主要ナビゲーション:
  Today → DailyRecord   : 未入力CTA
  Today → UserDetail     : 利用者クリック
  UserDetail → PlanningSheet : 「計画を見る」
  UserDetail → DailyRecord   : 「記録する」
  PlanningSheet → Monitoring : Bridge 3
  Dashboard → ExceptionCenter : 異常値クリック
  ExceptionCenter → UserDetail : ドリルダウン
```

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 著者 |
|------|-----------|---------|------|
| 2026-03-17 | 1.0 | 初版作成 — 15画面の完全定義 | プロダクトチーム |

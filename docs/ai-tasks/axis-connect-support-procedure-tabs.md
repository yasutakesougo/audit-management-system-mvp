# AXIS-Connect「支援手順兼記録メニュー」実装計画

Mirai-Canvas（Module A）が展開する支援計画を、現場が迷わず運用できるタブ型 UI（Module B 中核）へ落とし込むための実装ガイドライン。推奨アクションに沿って、再利用資産の棚卸し・タブ構造案・データ連携/状態管理の方針を整理する。

## 1. 再利用できる既存資産

- **支援計画ドラフト管理 (`src/pages/SupportPlanGuidePage.tsx`)**
  - `Tabs`＋`TabPanel`／`Paper`ベースのセクション切り替え構造、ローカルストレージ同期、Markdown プレビューは、Mirai-Canvas ⇄ Daily 連携での「計画概要タブ」「レビュータブ」などに流用可能。
  - フィールド設定 (`SECTIONS`, `FieldConfig`) は Mirai-Canvas 側のフォームメタデータとして再利用し、支援手順タブのヘッダーに計画サマリを表示する際の情報源になり得る。
- **日次記録 UI 群**
  - `src/pages/TimeFlowSupportRecordPage.tsx`：支援タイムライン、ステージ別（予防/早期対応/危機/事後）分類、タブ＋アコーディオン構造が新タブ UI の基礎。`resolveSupportFlowForUser` 等のデータ整形ロジックをそのまま流用可能。
  - `src/features/daily/DailyRecordForm.tsx` / `src/pages/DailyRecordPage.tsx`：ダイアログフォーム、状態タグ、フィルタリング UI。Quick Recorder ウィジェットの参考。
  - `src/features/support/MonitoringInfo.tsx`：モニタリング指標カード（グラフ/統計）の表現要素を「分析タブ」に転用。
- **計画デプロイメント (`src/features/planDeployment/supportFlow.ts`)**
  - Mirai-Canvas が吐き出した `SupportPlanDeployment.activities` を `stage` 付きで提供。タブ UI ではこの配列を time-slot ごとのカードにマッピングするだけで基本情報が揃う。

## 2. タブ構造（ワイヤーフレーム案）

```
┌───────────────────────────────────────────────┐
│利用者コンテキストバー｜支援計画サマリ｜通知領域                │
├─────┬─────────┬──────────┬────────┤
│① 計画ハイライト│② 日次入力│③ 分析インサイト│④ インシデント│⑤ 設定│
└─────┴─────────┴──────────┴────────┘
          ↓                     ↓                ↓
   Mirai-Canvas概要     Quick Recorder & Flow    ABC連携
```

| タブ | 主な利用者 | 目的と主要コンポーネント | データフロー |
| --- | --- | --- | --- |
| ① **計画ハイライト** | リーダー、専門職 | `PlanSummaryCard`（新規／`SupportPlanGuidePage` の Markdown プレビューを簡易表示）、`StageLegend`（既存アイコン流用） | `SupportPlanDeployment`, Mirai-Canvas ハイライト (`longTermGoal` 等) |
| ② **日次入力** | 現場支援員 | `SupportTimelineTabs`（時間帯×ステージ）、`ActivityCard`（既存 `TimeFlowSupportRecordPage` から抽出）、`QuickRecorder`（チェック/スライダー/タグ） | `SupportPlanDeployment.activities` → `supportRecordsStore`（新） |
| ③ **分析インサイト** | リーダー、専門職 | `MonitoringInfo` 再利用、`BehaviorTracker`（Module D で予定のグラフを先行簡易版として搭載）、`ProcedureFidelityGauge` | `supportRecordsStore` 集計結果、`MonitoringInfo` 互換データ |
| ④ **インシデントログ** | 現場支援員 | `IncidentAnalysisForm`（Module C モーダルをタブ内にトリガー配置）、`IncidentTimeline`（ABC 記録のサマリカード） | ABC 記録 API（既存/予定）＋ `IncidentDraftStore` |
| ⑤ **設定 / テンプレート** | リーダー | `TemplateLibraryPanel`（支援ブロックの CRUD。`SupportActivityTemplateList` 参照）、`DeploymentHistory` | Mirai-Canvas からの最新デプロイ情報、ローカルカスタムテンプレート |

### ナビゲーション指針

- `Tabs` は MUI scrollable を利用、`aria-controls` を活用しアクセシビリティ維持。モバイル幅ではアイコン＋略称、デスクトップではフルラベル。
- ペルソナごとにデフォルトタブを調整できるよう、URL クエリ（例: `?tab=analysis`）＋ `usePersistedFilters` を流用して状態保持。
- `SupportTimelineTabs` 内で Mirai-Canvas 由来の「予防/早期/危機/事後」ステージを色分け。各 stage には既存 `stageLabelMap` を利用。

## 3. 状態管理と API インターフェイス方針

### クライアント状態（Zustand ベース想定）

| Store | 役割 | 主な state/アクション | 既存資産 |
| --- | --- | --- | --- |
| `useSupportPlanStore`（新規） | Mirai-Canvas 展開済み計画の読込とキャッシュ | `planId`, `deployment`, `loading`, `fetchDeployment(planId)` | `supportFlow.ts` の fallback と同型を初期値に |
| `useSupportRecordsStore`（新規） | 日次入力のローカル保存、サーバ同期キュー | `recordsByDate`, `upsertRecord`, `markSynced`, `pendingSync` | `DailyRecordForm` の初期値ロジックをベースに整形 |
| `useIncidentDraftStore`（既存拡張） | ABC 記録モーダルとの橋渡し | `openDraft`, `resolveFromActivity(activityKey)` | Module C 実装時の Stepper 状態管理を再利用 |

### API/L2 層

- **計画取得**: `GET /support-plans/:userId/deployment`（仮）。現状は `supportFlow.ts` の mock をラップし、将来は SharePoint/Graph 連携へスイッチ。
- **日次記録保存**: 既存 `PersonDaily` 型をベースに `POST /support-records`。Quick Recorder のスキーマ（チェック、スライダー値、自由記述）を `userActivities`/`staffActivities` フィールドへマッピング。
- **分析データ**: 初期はクライアント集計。バックエンド準備後は `GET /support-records/:userId/summary?range=...` を想定。
- **インシデント**: Module C の ABC API を `supportRecordsStore` と結合。タブから `openIncidentModal(activityContext)` を呼ぶだけで済むよう context payload を定義。

### エラーハンドリング / 同期戦略

- 保存失敗時は Snackbar（既存 `useToast`）で通知し `pendingSync` に保持。`navigator.onLine` 監視＋再送。
- ローカル保存キーは `support-plan-guide.v2` と同様に `userId` 別でネームスペース化（例: `support-procedure.<userId>`）。

## 4. 実装ステップ（優先度順）

1. **コンポーネント抽出**: `TimeFlowSupportRecordPage.tsx` から `SupportTimelineTabs` / `ActivityCard` / `StageLegend` をモジュール化し、Storybook/Playground で単体確認。
2. **新ページ骨組み**: `SupportProcedurePage.tsx`（仮）を作成し、上記タブ構造＋ `useSupportPlanStore` 連携を実装。ダミーデータは `supportFlow.ts` を使用。
3. **Quick Recorder 統合**: 日次入力タブに `DailyRecordForm` の要素（チェックボックス、メモ）を統合、Zustand に書き込む。
4. **分析タブ MVP**: `MonitoringInfo` を再配置し、`useSupportRecordsStore` の集計値で表示できるよう Map/Reduce を整備。
5. **インシデント連携**: Module C モーダルをタブから呼び出すトリガーと、記録との紐付け（`activityKey`）を追加。
6. **設定タブ**: `SupportActivityTemplateList` をラップし、Mirai-Canvas デプロイメントと差分を比較できる UI を作成。
7. **ルーティング/権限**: `ProtectedRoute` と連携し、ロールに応じたタブ表示制御・デフォルトタブ設定を実装。
8. **テスト整備**: RTL でタブ切替・保存キュー動作・権限制御をカバー。E2E で「計画→日次入力→分析」フローを追加。

---

この計画に沿って実装することで、Mirai-Canvas が生成する支援計画ブロックをタブ UI に直結させ、現場の「Guided Journey」を実現しつつ Module B/C/D 間のデータ連携を段階的に完成させる。

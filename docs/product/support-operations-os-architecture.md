# Support Operations OS — System Architecture

> **ドキュメント種別:** システムアーキテクチャ  
> **ステータス:** 承認済  
> **初版:** 2026-03-16  
> **最終更新:** 2026-03-16  
> **準拠:** [設計原則 10 箇条](principles.md) / [UI 設計規約](ui-conventions.md) / [ロードマップ](roadmap.md)

---

## 目次

- [1. Overview](#1-overview)
- [2. Concept Model](#2-concept-model)
- [3. Layered Architecture](#3-layered-architecture)
- [4. Observation Layer](#4-observation-layer)
- [5. Normalization Layer](#5-normalization-layer)
- [6. Insight Engine](#6-insight-engine)
- [7. Proposal Engine](#7-proposal-engine)
- [8. Operational UI](#8-operational-ui)
- [9. Execution Layer](#9-execution-layer)
- [10. Knowledge Layer](#10-knowledge-layer)
- [11. ISP 三層モデルとブリッジ](#11-isp-三層モデルとブリッジ)
- [12. Human-in-the-Loop Design](#12-human-in-the-loop-design)
- [13. Provenance System](#13-provenance-system)
- [14. Infrastructure & Ports](#14-infrastructure--ports)
- [15. Data Flow — Complete PDCA Pipeline](#15-data-flow--complete-pdca-pipeline)
- [16. Relationship with Product Principles](#16-relationship-with-product-principles)
- [17. Code Structure Map](#17-code-structure-map)
- [18. Technology Stack](#18-technology-stack)
- [19. Future Extensions](#19-future-extensions)
- [変更履歴](#変更履歴)

---

## 1. Overview

> **Support Operations OS is a decision-support platform for disability welfare operations.**  
> It transforms daily records into actionable insights and organizational knowledge  
> through a structured PDCA workflow.

このシステムは「記録アプリ」ではない。  
**人がより良く支援判断を行うための基盤（判断補助 OS）** である。

```
入力（Observation）
  → 整理（Normalization）
    → 分析（Insight）
      → 提案（Proposal）
        → 人が判断（Human Decision）
          → 反映（Execution）
            → 蓄積（Knowledge）
              → 次の改善へ（Loop）
```

評価基準は「機能数」ではなく、以下の 3 つで測る。

| # | 評価基準 |
|---|---------|
| 1 | 現場で自然に使われるか |
| 2 | 判断の質を上げるか |
| 3 | 組織の知識として残るか |

---

## 2. Concept Model

Support Operations OS の中核は、**7 層のパイプライン** で構成される。

```
┌─────────────────────────────────────────────────────────────────┐
│                    Support Operations OS                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ① Observation Layer     ← 現場の記録を集める           │   │
│  │     Daily / ABC / Handoff / Monitoring / Assessment      │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     ▼                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ② Normalization Layer   ← データを整理・構造化する      │   │
│  │     時系列整理 / userId統合 / イベント抽出 / 分類         │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     ▼                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ③ Insight Engine        ← パターン・傾向を発見する      │   │
│  │     行動パターン / 場面変化 / 目標進捗 / 期間比較         │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     ▼                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ④ Proposal Engine       ← 見直し候補を生成する          │   │
│  │     PlanningProposalBundle / ProposalPreview              │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     ▼                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ⑤ Operational UI        ← 現場が毎日使う画面           │   │
│  │     Today / Handoff / Daily / Planning / Monitoring       │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     ▼                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ⑥ Execution Layer       ← 判断を反映する               │   │
│  │     採用 / 却下 / 計画更新 / 手順更新                     │   │
│  └──────────────────┬───────────────────────────────────────┘   │
│                     ▼                                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ⑦ Knowledge Layer       ← 判断を組織知として蓄積する    │   │
│  │     ProposalAdoptionRecord / AuditTrail / Provenance      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Layered Architecture

7 層を縦軸に、PDCA サイクルを横軸に配置した全体像。

```
             Plan         Do           Check         Act
           ┌──────────┬──────────┬──────────┬──────────┐
Observe    │Assessment│ Daily    │ Monitor  │ Handoff  │
           │ABC Record│ Procedure│ Record   │ Notes    │
           ├──────────┴──────────┴──────────┴──────────┤
Normalize  │ 時系列整理 / userId統合 / イベント抽出     │
           ├──────────────────────────────────────────────┤
Insight    │ パターン検出 / 傾向分析 / 場面変化検出       │
           ├──────────────────────────────────────────────┤
Propose    │ PlanningProposalBundle[] (3ソース統合)       │
           ├──────────────────────────────────────────────┤
UI         │ Today │ Handoff │ Daily │ Planning │ Monitor│
           ├──────────────────────────────────────────────┤
Execute    │ 採用 / 却下 + 差分適用 + 履歴保存            │
           ├──────────────────────────────────────────────┤
Knowledge  │ AdoptionRecord + AuditTrail + Provenance     │
           └──────────────────────────────────────────────┘
```

---

## 4. Observation Layer

現場から入力されるすべてのデータの入口。

> **原則 2 準拠:** 入力負担を増やさない。選択式優先、自動補完多用。

### データソース一覧

| ソース | 説明 | 入力方式 | 頻度 |
|--------|------|---------|------|
| **Daily Record** | 日中支援の実施記録 | テーブル入力 / クイック記録 | 毎日 |
| **ABC Record** | 行動の機能分析（Antecedent-Behavior-Consequence） | 構造化フォーム | 随時 |
| **Handoff Notes** | 申し送り・引き継ぎ事項 | コメント型入力 | 毎シフト |
| **Assessment (ICF)** | ICF 分類に基づくアセスメント | 選択式 | 入所時 / 見直し時 |
| **特性アンケート** | 利用者特性の調査結果 | 選択式 | 入所時 / 見直し時 |
| **Monitoring Record** | モニタリング評価結果 | 選択 + 記述 | 90 日サイクル |
| **出欠記録** | 利用者の出席・欠席 | ワンタップ | 毎日 |
| **バイタル / 投薬** | 看護記録 | フォーム入力 | 毎日 |
| **危機対応記録** | ヒヤリハット・事故 | ダイアログ入力 | 随時 |

### 該当コード

| モジュール | パス | 説明 |
|-----------|------|------|
| Daily Record | [src/features/daily/](../../src/features/daily/) | 日中記録・手順 |
| Handoff Notes | [src/features/handoff/](../../src/features/handoff/) | 申し送り |
| 出欠管理 | [src/features/attendance/](../../src/features/attendance/) | 出欠記録 |
| Assessment | [src/features/assessment/](../../src/features/assessment/) | ICF アセスメント |
| バイタル・投薬 | [src/features/nurse/](../../src/features/nurse/) | 看護記録 |
| ABC Record | [src/domain/abc/](../../src/domain/abc/) | ABC 型定義 |
| 行動記録 | [src/domain/behavior/](../../src/domain/behavior/) | 行動スキーマ |
| ISP / Monitoring | [src/domain/isp/](../../src/domain/isp/) | ISP 型定義 |
| Safety | [src/domain/safety/](../../src/domain/safety/) | 危機対応・身体拘束 |

---

## 5. Normalization Layer

生の記録データを、分析可能な構造に変換する中間層。

### 処理内容

| 処理 | 説明 | 主要ファイル |
|------|------|------------|
| **時系列整理** | 記録を日付 / 時間帯で並べ替え | `computeTimePatterns.ts` |
| **userId 統合** | 複数ソースの利用者を統一 | `groupHandoffsByUser.ts` |
| **イベント抽出** | キーワード・タグの抽出 | `extractKeywords.ts` |
| **カテゴリ分類** | 行動・場面の分類 | `behaviorTag.ts`, `behaviorTagInsights.ts` |
| **傾向計算** | ユーザー別トレンド算出 | `computeUserTrends.ts` |
| **場面推定** | 時間帯からの現在場面推定 | `deriveCurrentScene.ts`, `inferTodayScene.ts` |
| **スケジュール統合** | 活動予定と実績の紐づけ | `mapSchedulesToTodayLanes.ts` |

### 該当コード

**Handoff Analysis:**
- [computeTimePatterns.ts](../../src/features/handoff/analysis/computeTimePatterns.ts) — 時系列整理
- [computeUserTrends.ts](../../src/features/handoff/analysis/computeUserTrends.ts) — ユーザー別トレンド
- [extractKeywords.ts](../../src/features/handoff/analysis/extractKeywords.ts) — キーワード抽出
- [detectRepeatingPatterns.ts](../../src/features/handoff/analysis/detectRepeatingPatterns.ts) — 繰り返し検出

**Behavior Domain:**
- [behaviorTag.ts](../../src/features/daily/domain/behaviorTag.ts) — 行動タグ分類
- [behaviorTagInsights.ts](../../src/features/daily/domain/behaviorTagInsights.ts) — タグ分析
- [behaviorTagCrossInsights.ts](../../src/features/daily/domain/behaviorTagCrossInsights.ts) — クロス分析
- [behaviorPatternSuggestions.ts](../../src/features/daily/domain/behaviorPatternSuggestions.ts) — パターン提案

**Today Scene:**
- [deriveCurrentScene.ts](../../src/features/today/domain/deriveCurrentScene.ts) — 場面推定
- [inferTodayScene.ts](../../src/features/today/domain/inferTodayScene.ts) — 今日の場面推論
- [mapSchedulesToTodayLanes.ts](../../src/features/today/domain/mapSchedulesToTodayLanes.ts) — スケジュール統合

---

## 6. Insight Engine

正規化されたデータからパターン・傾向・変化を検出する分析エンジン。

> **原則 4 準拠:** すべての Insight には対象期間・参照記録数・比較基準を持たせる。

### 分析機能一覧

| 分析 | 入力 | 出力 | 主要ファイル |
|------|------|------|------------|
| **行動パターン検出** | ABC Record[] | 頻出場面・頻出行動 | `evidencePatternAnalysis.ts` |
| **場面変化検出** | ABC Record[] (2 期間) | 変化アラート | `compareAbcPatternPeriods.ts` |
| **目標進捗評価** | Monitoring + Goal | 達成度スコア | `evaluateGoalProgress.ts` |
| **申し送り傾向分析** | Handoff[] | リスクスコア | `riskScoring.ts` |
| **繰り返しパターン** | Handoff[] | 反復発見 | `detectRepeatingPatterns.ts` |
| **支援戦略採用度** | Evidence Link[] | 戦略別リンク数 | `countStrategyAdoptions.ts` |
| **頻出エビデンス** | Evidence Link[] | Top 参照 ABC/PDCA | `getTopReferencedEvidence.ts` |
| **逆方向トレース** | Evidence Link[] | 設計→根拠の追跡 | `reverseTrace.ts` |
| **モニタリング分析** | Daily Record[] | 日次サマリー統計 | `monitoringDailyAnalytics.ts` |
| **制度遵守チェック** | ISP + Staff + User | Finding[] | `auditChecks.ts` |
| **ISP ドラフト推論** | Monitoring + Goal | 下書きフィールド | `ispPlanDraftUtils.ts` |

### 設計原則

- すべて **純粋関数（Pure Function）** として実装する
- 副作用ゼロ、テスト容易
- 入力: ドメインオブジェクト → 出力: 分析結果オブジェクト

### 該当コード

**ISP Evidence:**
- [evidencePatternAnalysis.ts](../../src/domain/isp/evidencePatternAnalysis.ts) — パターン集約
- [countStrategyAdoptions.ts](../../src/domain/isp/countStrategyAdoptions.ts) — 戦略採用度
- [getTopReferencedEvidence.ts](../../src/domain/isp/getTopReferencedEvidence.ts) — 頻出エビデンス
- [reverseTrace.ts](../../src/domain/isp/reverseTrace.ts) — 逆方向トレース

**Handoff Analysis:**
- [compareAbcPatternPeriods.ts](../../src/features/handoff/analysis/compareAbcPatternPeriods.ts) — 場面変化検出
- [evaluateGoalProgress.ts](../../src/features/handoff/analysis/evaluateGoalProgress.ts) — 目標進捗評価
- [riskScoring.ts](../../src/features/handoff/analysis/riskScoring.ts) — リスクスコアリング
- [reviewRecommendation.ts](../../src/features/handoff/analysis/reviewRecommendation.ts) — 見直し推奨
- [alertRules.ts](../../src/features/handoff/analysis/alertRules.ts) — アラートルール

**Monitoring Domain:**
- [monitoringDailyAnalytics.ts](../../src/features/monitoring/domain/monitoringDailyAnalytics.ts) — 日次分析
- [goalProgressUtils.ts](../../src/features/monitoring/domain/goalProgressUtils.ts) — 目標進捗計算
- [ispRecommendationUtils.ts](../../src/features/monitoring/domain/ispRecommendationUtils.ts) — ISP 推奨
- [ispPlanDraftUtils.ts](../../src/features/monitoring/domain/ispPlanDraftUtils.ts) — ドラフト生成

**Regulatory:**
- [auditChecks.ts](../../src/domain/regulatory/auditChecks.ts) — 制度遵守チェック
- [findingEvidenceSummary.ts](../../src/domain/regulatory/findingEvidenceSummary.ts) — 根拠解決
- [aggregateIcebergEvidence.ts](../../src/domain/regulatory/aggregateIcebergEvidence.ts) — エビデンス集約

---

## 7. Proposal Engine

Insight Engine の出力を、統一された提案形式に変換するエンジン。

> **原則 3 準拠:** 提案は「候補」として提示する。命令ではない。  
> **ADR-010 準拠:** `PlanningProposalBundle` + アダプターパターン

### アーキテクチャ

```
Insight Engine の出力
  │
  ├─ reviewRecommendation.ts   → ReviewProposal
  ├─ compareAbcPatternPeriods   → AbcPatternComparison
  └─ evaluateGoalProgress      → RevisionDraft
        │
        ↓  adapter（型変換のみ）
        │
  PlanningProposalBundle[]
        │
        ↓  buildProposalPreview()
        │
  ProposalPreviewResult
        │
        ↓  Operational UI（ProposalCard）
        │
  人が 採用 / 却下 / 保留 を判断
        │
        ↓  buildAdoptionRecords()
        │
  ProposalAdoptionRecord[]（→ Knowledge Layer）
```

### 3 ソース統合

| # | ソース | 生成器 | アダプター |
|---|--------|--------|-----------|
| 1 | 申し送り分析 | `buildReviewProposal()` | handoff adapter |
| 2 | ABC パターン比較 | `compareAbcPatternPeriods()` | abc adapter |
| 3 | モニタリング評価 | `evaluateGoalProgress()` | monitoring adapter |

### 共通提案型

```typescript
interface PlanningProposalBundle {
  source: 'handoff' | 'abc' | 'monitoring';
  sourceLabel: string;
  userCode: string;
  urgency?: 'urgent' | 'recommended' | 'suggested';
  summary: string;
  fieldProposals: PlanningFieldProposal[];
  provenance: {
    sourceType: ProposalSource;
    sourceIds: string[];
    generatedAt: string;       // ISO 8601
  };
}
```

### 該当コード

- [proposalBundle.ts](../../src/features/handoff/analysis/proposalBundle.ts) — `PlanningProposalBundle` 型 + adapter
- [buildReviewProposal.ts](../../src/features/handoff/analysis/buildReviewProposal.ts) — 申し送り → 提案
- [reviewRecommendation.ts](../../src/features/handoff/analysis/reviewRecommendation.ts) — 見直し推奨生成

---

## 8. Operational UI

現場職員が毎日操作する業務画面。

> **原則 1 準拠:** 主役は AI ではなく現場導線。表はシンプル、裏は強い。  
> **UI 設計規約:** [ui-conventions.md](ui-conventions.md) の Situation UI 原則に従う。

### 画面一覧

| 画面 | パス | 役割 | PDCA |
|------|------|------|------|
| **Today** | `/today` | 今日の場面・次アクション・注意点 | Do |
| **Handoff** | `/handoff` | 申し送り入力・タイムライン | Do |
| **Daily** | `/daily/support` | 日中記録・テーブル入力 | Do |
| **ABC Record** | `/abc-record` | 行動の機能分析記録 | Do |
| **Planning Sheet** | `/planning-sheet/:id` | 支援計画の編集 (L2) | Plan |
| **Support Plan Guide** | `/support-plan-guide` | ISP 管理 (L1) | Plan |
| **Monitoring** | (タブ内) | モニタリング評価・推奨 | Check |
| **Dashboard** | `/dashboard` | 横断表示・サマリー | Check |
| **Regulatory** | (タブ内) | 制度遵守チェック | Check |
| **Schedule** | `/schedules/week` | 週間スケジュール | Do |
| **Attendance** | `/daily/attendance` | 出欠管理 | Do |
| **Safety** | (タブ内) | 安全管理ダッシュボード | Act |

### 情報レイヤー

```
Layer 0: 業務コンテキスト（場面・時間帯・本日の予定）
Layer 1: 実行導線（記録入力・チェック・操作ボタン）
Layer 2: 状況通知（PhaseNextStepBanner、MonitoringCountdown）   ← 常時表示
Layer 3: 提案・分析（ProposalCard、EvidencePatternSummary）     ← 操作で展開
Layer 4: 根拠・履歴（ProvenanceBadge、ImportHistoryTimeline）   ← 詳細展開時
```

### 該当コード

**Today:**
- [TodayBentoLayout.tsx](../../src/features/today/layouts/TodayBentoLayout.tsx) — ベントーレイアウト
- [deriveCurrentScene.ts](../../src/features/today/domain/deriveCurrentScene.ts) — 場面推定
- [useNextAction.ts](../../src/features/today/hooks/useNextAction.ts) — 次アクション

**Handoff:**
- [HandoffLiveFeed.tsx](../../src/features/handoff/components/HandoffLiveFeed.tsx) — ライブフィード
- [TodayHandoffTimelineList.tsx](../../src/features/handoff/TodayHandoffTimelineList.tsx) — タイムライン

**Daily:**
- [wizard/](../../src/features/daily/components/wizard/) — 支援ウィザード
- [procedure/](../../src/features/daily/components/procedure/) — 手順表示
- [TableDailyRecordForm.tsx](../../src/features/daily/forms/TableDailyRecordForm.tsx) — テーブル入力

**Planning Sheet:**
- [ProvenanceBadge.tsx](../../src/features/planning-sheet/components/ProvenanceBadge.tsx) — 出典バッジ
- [EvidencePatternSummaryCard.tsx](../../src/features/planning-sheet/components/EvidencePatternSummaryCard.tsx) — エビデンスサマリー
- [ImportAssessmentDialog.tsx](../../src/features/planning-sheet/components/ImportAssessmentDialog.tsx) — Bridge 1 UI

**Support Plan Guide (ISP):**
- [useSupportPlanBundle.ts](../../src/features/support-plan-guide/hooks/useSupportPlanBundle.ts) — ISP バンドル
- [useRegulatorySummary.ts](../../src/features/support-plan-guide/hooks/useRegulatorySummary.ts) — 制度遵守サマリー

**Monitoring:**
- [GoalProgressCard.tsx](../../src/features/monitoring/components/GoalProgressCard.tsx) — 目標進捗
- [IspRecommendationCard.tsx](../../src/features/monitoring/components/IspRecommendationCard.tsx) — ISP 推奨

**Safety:**
- [ComplianceDashboard.tsx](../../src/features/safety/components/ComplianceDashboard.tsx) — 安全ダッシュボード
- [useSafetyOperationsSummary.ts](../../src/features/safety/hooks/useSafetyOperationsSummary.ts) — 安全サマリー

> 📖 コンポーネント詳細: [UI Component Gallery](../ui/component-gallery.md)

---

## 9. Execution Layer

人が提案を確認し、採用・却下・保留を判断した結果を反映する層。

> **原則 5 準拠:** 最終決定は必ず人が行う。  
> **UI 設計規約:** [Accept / Dismiss UI](ui-conventions.md#4-accept--dismiss-ui) に従う。

### 反映パターン

| パターン | トリガー | 反映先 | 操作 |
|---------|---------|--------|------|
| **Bridge 1** | Assessment 取込 | Planning Sheet (L2) | `assessmentBridge()` |
| **Bridge 2** | Planning → Procedure | Procedure Record (L3) | `planningToRecordBridge()` |
| **Bridge 3** | Monitoring → Planning | Planning Sheet (L2) | `monitoringToPlanningBridge()` |
| **提案採用** | ProposalCard で「採用」 | Planning Sheet (L2) | `ProposalApplyDialog` |
| **ドラフト適用** | ISP 下書きプレビュー | ISP (L1) | `IspPlanDraftPreview` |
| **手動編集** | 直接フォーム入力 | 各レイヤー | フォームコンポーネント |

### 採用フロー

```
ProposalCard 表示
  → [✅ 採用] クリック
    → ProposalApplyDialog 表示（差分プレビュー）
      → ☑ 採用フィールド選択
        → [適用して保存] クリック
          → Planning Sheet 更新
          → ProposalAdoptionRecord 保存
          → ImportHistoryTimeline に追記
```

### 該当コード

**Bridge:**
- [assessmentBridge.ts](../../src/features/planning-sheet/assessmentBridge.ts) — Bridge 1
- [planningToRecordBridge.ts](../../src/features/planning-sheet/planningToRecordBridge.ts) — Bridge 2
- [monitoringToPlanningBridge.ts](../../src/features/planning-sheet/monitoringToPlanningBridge.ts) — Bridge 3
- [tokuseiBridgeBuilders.ts](../../src/features/planning-sheet/tokuseiBridgeBuilders.ts) — 特性取込
- [ImportMonitoringDialog.tsx](../../src/features/planning-sheet/components/ImportMonitoringDialog.tsx) — Bridge 3 UI

**Judgment:**
- [IspRecommendationCard.tsx](../../src/features/monitoring/components/IspRecommendationCard.tsx) — 推奨カード
- [useIspRecommendationDecisions.ts](../../src/features/monitoring/hooks/useIspRecommendationDecisions.ts) — 採用判断管理

---

## 10. Knowledge Layer

すべての判断・反映・却下を組織の判断資産として蓄積する層。

> **原則 8 準拠:** 履歴は単なるログではなく、組織の判断資産として扱う。

### 蓄積される情報

| 情報 | 説明 | 用途 |
|------|------|------|
| **ProposalAdoptionRecord** | 提案の採用/却下履歴 + 理由 | 組織知化、パターン分析 |
| **ImportAuditRecord** | ブリッジ取込の監査ログ | 変更追跡、監査対応 |
| **ProvenanceEntry** | フィールドの出典情報 | 根拠追跡 |
| **PlanningSheetVersion** | 支援計画の版管理 | スナップショット、比較 |
| **IspDecisionRecord** | ISP 推奨の判断履歴 | 判断パターンの蓄積 |
| **AuditLog** | 操作の監査ログ | セキュリティ、コンプライアンス |

### 組織知化のフロー

```
判断の記録
  → パターンの蓄積
    → 以下に活用
       ├── 新人教育（過去の判断事例を学習材料に）
       ├── 引き継ぎ（担当交代時の情報ロス最小化）
       ├── 監査説明（根拠付き判断履歴の提示）
       └── 法人展開（他事業所への運用横展開）
```

### 該当コード

**Audit:**
- [importAuditStore.ts](../../src/features/planning-sheet/stores/importAuditStore.ts) — 取込監査記録
- [audit.ts](../../src/lib/audit.ts) — 監査ログ基盤

**Decision History:**
- [IspDecisionRepository.ts](../../src/features/monitoring/data/IspDecisionRepository.ts) — 判断履歴ポート
- [InMemoryIspDecisionRepository.ts](../../src/features/monitoring/data/InMemoryIspDecisionRepository.ts) — テスト用
- [SharePointIspDecisionRepository.ts](../../src/features/monitoring/data/SharePointIspDecisionRepository.ts) — 本番用

**Version / Meeting:**
- [planningSheetVersion.ts](../../src/domain/isp/planningSheetVersion.ts) — 版管理
- [monitoringMeeting.ts](../../src/domain/isp/monitoringMeeting.ts) — モニタリング会議記録

> 📖 データモデル詳細: [Knowledge Model](../data/knowledge-model.md)

---

## 11. ISP 三層モデルとブリッジ

Support Operations OS の中核データモデル。

### 三層構造

```
┌──────────────────────────────────────────────────────────────┐
│                      ISP 三層モデル                           │
│                                                              │
│  ┌────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │    L1      │    │       L2         │    │     L3       │  │
│  │   ISP      │───▶│ 支援計画シート    │───▶│ 手順書兼記録  │  │
│  │  (Why)     │    │   (How)          │    │ (Do+Record)  │  │
│  │            │    │                  │    │              │  │
│  │ 生活全体の │    │  行動設計        │    │  手順化      │  │
│  │ 方向性     │    │  支援方針        │    │  実施記録    │  │
│  │            │    │  環境調整        │    │              │  │
│  └────────────┘    └──────────────────┘    └──────────────┘  │
│                                                              │
│       Bridge 1            Bridge 2            Bridge 3       │
│   Assessment→L2          L2→L3          Monitor→L2          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### ブリッジ詳細

| ブリッジ | 方向 | 変換内容 | 自動/手動 |
|---------|------|---------|----------|
| **Bridge 1** | Assessment → L2 | ICF分類・特性 → 支援計画フィールド | 候補提示 + 人が確認 |
| **Bridge 2** | L2 → L3 | 支援方針・具体的対応 → 手順ステップ | 候補提示 + 人が確認 |
| **Bridge 3** | Monitor → L2 | モニタリング評価 → 支援計画更新 | 自動追記 + 候補提示 |

### 層間参照ルール

| 方向 | 許可 | 理由 |
|------|------|------|
| L1 → L2 | ✅ 参照表示 | ISP 画面でシート一覧を表示 |
| L2 → L3 | ✅ Bridge 2 | 手順化は設計の具体化 |
| L3 → L2 | ❌ 編集不可 | 支援設計の変更はシート画面で |
| Monitor → L2 | ✅ Bridge 3 | PDCA の C→A（候補提示のみ） |
| Dashboard → 全層 | ✅ 読取専用 | 横断チェック |

---

## 12. Human-in-the-Loop Design

このシステムの最も重要な設計制約。

> **原則 5:** このシステムは判断補助 OS であり、自律決定 OS ではない。

### 判断フロー

```
┌───────────────────────────────────────────────────────┐
│                                                       │
│   System                          Human               │
│   ┌──────────┐                                        │
│   │ 記録収集  │                                        │
│   └────┬─────┘                                        │
│        ▼                                              │
│   ┌──────────┐                                        │
│   │ 分析実行  │                                        │
│   └────┬─────┘                                        │
│        ▼                                              │
│   ┌──────────┐         ┌──────────────────┐           │
│   │ 候補提示  │────────▶│ 確認・検討       │           │
│   └──────────┘         └────────┬─────────┘           │
│                                 ▼                     │
│                        ┌──────────────────┐           │
│                        │ 採用 / 却下 判断  │           │
│                        └────────┬─────────┘           │
│                                 ▼                     │
│   ┌──────────┐         ┌──────────────────┐           │
│   │ 反映実行  │◀────────│ 反映指示         │           │
│   └────┬─────┘         └──────────────────┘           │
│        ▼                                              │
│   ┌──────────┐                                        │
│   │ 履歴保存  │                                        │
│   └──────────┘                                        │
│                                                       │
└───────────────────────────────────────────────────────┘
```

### AI が行うこと / 行わないこと

| AI が行う | AI が行わない |
|----------|-------------|
| データの収集・整理 | 支援方針の決定 |
| パターンの検出 | 計画の自動変更 |
| 候補の提示 | 利用者への直接通知 |
| 根拠の表示 | 「正解」の提示 |
| 差分のプレビュー | 自動適用 |
| 履歴の保存 | 却下理由の推測 |

---

## 13. Provenance System

すべてのデータ変更に出典を追跡する仕組み。

> **原則 4 準拠:** 提案 + 根拠 + 参照元 の 3 点セット。

### Provenance の構造

```
取込操作
  │
  ├─ ProvenanceEntry               ← フィールド単位の出典
  │    field: "observationFacts"
  │    source: "assessment_icf"
  │    reason: "ICF b710 関節可動域"
  │    value: "左膝関節拘縮あり"
  │
  ├─ ImportAuditRecord             ← 操作単位の監査ログ
  │    mode: "assessment-only" | "with-tokusei" | "behavior-monitoring"
  │    affectedFields: [...]
  │    planningSheetId
  │
  ├─ ProvenanceBadge               ← UI 表示
  │    🔵 assessment     [ICF]
  │    🟢 tokusei        [特性]
  │    🟠 monitoring     [モニタ]
  │    🟣 handoff        [申送]
  │    🔴 abc            [ABC]
  │
  └─ ImportHistoryTimeline         ← 取込履歴一覧
       モード色分け表示 + 時系列
```

### トレーサビリティの方向

```
           順方向トレース                   逆方向トレース
    ┌──────────────────────┐      ┌──────────────────────┐
    │ Assessment           │      │ Planning Sheet (L2)  │
    │   → Planning Sheet   │      │   → どの Assessment  │
    │     → Procedure      │      │     から来たか？     │
    │       → Monitoring   │      │   → どの ABC Record  │
    │                      │      │     を参照したか？   │
    └──────────────────────┘      └──────────────────────┘
```

---

## 14. Infrastructure & Ports

Ports & Adapters パターンによる永続化の分離。

### アーキテクチャ

```
Domain (Pure Function)  ←→  Port (Interface)  ←→  Adapter (Infrastructure)
                                                        │
                                              ┌─────────┼──────────┐
                                              │         │          │
                                          LocalStorage  SharePoint  InMemory
                                           (開発/デモ)   (本番)     (テスト)
```

### ポート × アダプター 一覧

| Port (Interface) | LocalStorage | SharePoint | InMemory |
|------------------|-------------|-----------|----------|
| ISP Repository | — | `SharePointIspRepository` | — |
| PlanningSheet Repository | `localPlanningSheetVersionRepo` | `SharePointPlanningSheetRepo` | — |
| ProcedureRecord Repository | — | `SharePointProcedureRecordRepo` | — |
| Compliance Repository | `localComplianceRepository` | — | — |
| Restraint Repository | `localRestraintRepository` | — | — |
| Incident Repository | `localIncidentRepository` | — | — |
| MonitoringMeeting Repository | `localMonitoringMeetingRepo` | — | — |
| EvidenceLink Repository | `localEvidenceLinkRepository` | — | — |
| ABC Record Repository | `localAbcRecordRepository` | — | — |
| IspDecision Repository | `InMemoryIspDecisionRepo` | `SharePointIspDecisionRepo` | ✅ |
| SupportPlanDraft Repository | `InMemorySPDraftRepo` | `SharePointSPDraftRepo` | ✅ |
| StaffQualification Repository | `localStaffQualificationRepo` | — | — |

### リポジトリファクトリ

```
src/lib/createRepositoryFactory.ts  ← 環境に応じた DI
src/features/support-plan-guide/repositoryFactory.ts
src/features/monitoring/data/createIspDecisionRepository.ts
```

### 該当コード

```
src/infra/
  ├── localStorage/               ← 開発/デモ用
  │   ├── localComplianceRepository.ts
  │   ├── localRestraintRepository.ts
  │   ├── localIncidentRepository.ts
  │   ├── localMonitoringMeetingRepository.ts
  │   ├── localPlanningSheetVersionRepository.ts
  │   ├── localEvidenceLinkRepository.ts
  │   ├── localAbcRecordRepository.ts
  │   └── localStaffQualificationRepository.ts
  │
  ├── firestore/                  ← 認証基盤
  │   ├── auth.ts
  │   └── client.ts
  │
  └── sharepoint/                 ← 本番データ
      └── repos/

src/data/isp/sharepoint/          ← ISP 三層 SharePoint Adapter
  ├── SharePointIspRepository.ts
  ├── SharePointPlanningSheetRepository.ts
  ├── SharePointProcedureRecordRepository.ts
  └── mapper.ts
```

---

## 15. Data Flow — Complete PDCA Pipeline

日次記録から ISP 計画書更新までを 1 本のパイプラインとして設計。

```
┌─────────────────────────────────────────────────────────────────────┐
│                       PDCA サイクル完全図                            │
│                                                                     │
│  ┌─────────────┐                                                    │
│  │   PLAN      │  L1: ISP（生活全体の方向性）                       │
│  │   (計画)    │    → Bridge 1: Assessment → L2                     │
│  │             │  L2: 支援計画シート（行動設計）                     │
│  │             │    → Bridge 2: L2 → L3                             │
│  │             │  L3: 手順書兼記録（手順化）                         │
│  └──────┬──────┘                                                    │
│         ▼                                                           │
│  ┌─────────────┐                                                    │
│  │   DO        │  Daily 画面: 手順に沿った支援実施                  │
│  │   (実施)    │  ABC 記録: 行動の機能分析                          │
│  │             │  Handoff: 申し送り                                  │
│  │             │  出欠管理: 出席・欠席記録                           │
│  └──────┬──────┘                                                    │
│         ▼                                                           │
│  ┌─────────────┐                                                    │
│  │   CHECK     │  Normalization: データ整理・構造化                  │
│  │   (評価)    │  Insight Engine: パターン検出・傾向分析             │
│  │             │  Monitoring: 支援評価（有効/一部/無効）             │
│  │             │  90 日サイクルスケジュール                           │
│  └──────┬──────┘                                                    │
│         ▼                                                           │
│  ┌─────────────┐                                                    │
│  │   ACT       │  Proposal Engine: 見直し候補の生成                  │
│  │   (改善)    │  Human Decision: 採用 / 却下 / 保留                 │
│  │             │  Bridge 3: Monitor → L2 更新                       │
│  │             │  Knowledge Layer: 判断履歴の蓄積                    │
│  │             │                                                    │
│  │             │  → 次の PLAN へ                                    │
│  └─────────────┘                                                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 16. Relationship with Product Principles

各アーキテクチャ層と設計原則の対応。

| 原則 | アーキテクチャ層 | 実装 |
|------|----------------|------|
| 1. 現場導線主体 | **Operational UI** | Today / Handoff / Daily が主役 |
| 2. 入力最小化 | **Observation Layer** | 選択式優先、自動補完、再利用 |
| 3. 候補提示 | **Proposal Engine** | `PlanningProposalBundle` + ProposalCard |
| 4. 根拠付与 | **Provenance System** | 提案 + 根拠 + 参照元 の 3 点セット |
| 5. 人間決定 | **Execution Layer** | 採用/却下 UI + Human-in-the-Loop |
| 6. 改善接続 | **全層のパイプライン** | Observation→Insight→Proposal→Execution |
| 7. 日次優先 | **Operational UI** | Today 画面が最優先、月次は Phase 2 以降 |
| 8. 組織知化 | **Knowledge Layer** | AdoptionRecord + AuditTrail |
| 9. 一貫性 | **Proposal Engine** | 統一型 + 統一 UI + 統一用語 |
| 10. OS 定義 | **全体設計** | 7 層パイプライン自体が判断補助 OS |

---

## 17. Code Structure Map

```
src/
├── domain/                         # ドメイン層（Pure Function のみ）
│   ├── isp/                        #   ISP 三層モデル中核
│   │   ├── schema.ts               #     Zod スキーマ + 型定義
│   │   ├── types.ts                #     状態遷移・版管理
│   │   ├── port.ts                 #     Repository Port ×3
│   │   ├── evidencePatternAnalysis.ts #  パターン分析
│   │   ├── reverseTrace.ts         #     逆方向トレース
│   │   └── bridge/                 #     Daily 連携
│   │
│   ├── regulatory/                 #   制度遵守チェックエンジン
│   ├── safety/                     #   安全管理ドメイン
│   ├── abc/                        #   ABC 記録
│   ├── behavior/                   #   行動記録
│   ├── bridge/                     #   クロスドメインブリッジ
│   └── daily/                      #   日次記録
│
├── features/                       # Feature 層（UI + UseCase）
│   ├── today/                      #   ⑤ Operational UI: Today
│   ├── handoff/                    #   ⑤ Operational UI: Handoff
│   │   └── analysis/              #   ③④ Insight + Proposal Engine
│   ├── daily/                      #   ⑤ Operational UI: Daily
│   ├── planning-sheet/             #   ⑤⑥ UI + Execution: Planning
│   ├── support-plan-guide/         #   ⑤ Operational UI: ISP
│   ├── monitoring/                 #   ⑤⑥ UI + Execution: Monitoring
│   ├── analysis/                   #   ③ Insight Engine UI
│   ├── safety/                     #   ⑤ Operational UI: Safety
│   ├── schedules/                  #   ⑤ Schedule 管理
│   ├── attendance/                 #   ① Observation: 出欠
│   ├── ibd/                        #   ③ Iceberg PDCA 分析
│   ├── regulatory/                 #   ⑤ Regulatory Dashboard
│   ├── dashboard/                  #   ⑤ Dashboard
│   └── ...                         #   (40+ features)
│
├── infra/                          # Infrastructure 層
│   ├── localStorage/               #   開発/デモ用永続化
│   ├── firestore/                  #   認証基盤
│   └── sharepoint/                 #   本番データ
│
├── data/                           # データアクセス層
│   └── isp/sharepoint/             #   ISP 三層 SharePoint Adapter
│
├── lib/                            # 共通基盤
│   ├── env.ts                      #   環境設定
│   ├── spClient.ts                 #   SharePoint クライアント
│   ├── audit.ts                    #   監査ログ
│   ├── createRepositoryFactory.ts  #   DI ファクトリ
│   ├── dateFormat.ts               #   日付フォーマット
│   └── nav/                        #   ナビゲーション
│
└── app/                            # アプリケーションシェル
    ├── Shell, Routing, Theming
    └── ErrorBoundary
```

---

## 18. Technology Stack

```
┌─────────────────────────────────────────────────────┐
│  Frontend                                           │
│    React 18 + TypeScript + Vite                     │
│    MUI (Material UI)                                │
│    React Query + Zustand                            │
│    Zod (スキーマ検証)                                │
├─────────────────────────────────────────────────────┤
│  Backend                                            │
│    SharePoint Online REST API (Microsoft 365)       │
│    Cloudflare Workers (Token Exchange)              │
├─────────────────────────────────────────────────────┤
│  Authentication                                     │
│    MSAL (Azure AD / Entra ID)                       │
│    Firebase Auth (Custom Token / Anonymous)          │
├─────────────────────────────────────────────────────┤
│  Testing                                            │
│    Vitest + Testing Library (Unit)                  │
│    Playwright (E2E)                                 │
├─────────────────────────────────────────────────────┤
│  CI/CD                                              │
│    GitHub Actions                                   │
│    Quality Gate (Coverage ≥ 44%)                    │
│    Lighthouse CI                                    │
├─────────────────────────────────────────────────────┤
│  Documentation                                      │
│    ADR + Product Principles + Architecture Docs     │
│    ESLint + Prettier + husky                        │
└─────────────────────────────────────────────────────┘
```

---

## 19. Future Extensions

| 方向 | 内容 | 対応フェーズ |
|------|------|------------|
| **AI 提案ランキング** | 採用パターン学習による提案品質の向上 | Phase 4 |
| **クロス事業所分析** | 法人内の複数事業所を横断した傾向比較 | Phase 5 |
| **知識レコメンド** | 過去の判断事例に基づく判断支援 | Phase 4 |
| **リスク予測** | 行動パターンからの早期警告 | Phase 5 |
| **新ソース追加** | ヒヤリハット・会議記録 → adapter 追加のみ | Phase 3 |
| **競合検知** | 複数提案の矛盾を検出し優先度付け | Phase 3 |
| **API / Webhook** | 外部システムとの連携基盤 | Phase 5 |
| **マルチテナント** | 事業所ごとのデータ分離と共有設定 | Phase 5 |
| **OSS 展開** | ドキュメント整備 + ライセンス設定 | Phase 5 |

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 著者 |
|------|-----------|---------|------|
| 2026-03-16 | 1.0 | 初版作成 | プロダクトチーム |

# UI Component Gallery

> **ドキュメント種別:** UI コンポーネントカタログ  
> **ステータス:** Draft  
> **初版:** 2026-03-16  
> **最終更新:** 2026-03-16  
> **準拠:** [UI 設計規約](../product/ui-conventions.md)

---

## 概要

Support Operations OS の共通コンポーネントカタログ。  
新規画面を作る際は、既存コンポーネントを **再利用** することで [原則 9（一貫性）](../product/principles.md#原則-9--機能追加より一貫性を優先する) を維持する。

---

## 目次

- [Proposal 系](#proposal-系)
- [Evidence 系](#evidence-系)
- [Bridge 系](#bridge-系)
- [Situation 系](#situation-系)
- [Monitoring 系](#monitoring-系)
- [Safety 系](#safety-系)
- [共通 UI パターン](#共通-ui-パターン)

---

## Proposal 系

提案の生成・表示・採用に関するコンポーネント群。

### ReviewProposalCard

> 申し送り分析に基づく見直し提案カード

```
┌──────────────────────────────────────┐
│  🏷️ 見直し候補              🟡 推奨  │
│  午後帯の離席増加                     │
│                                      │
│  根拠: 14日 / 23件 / 前月比+35%      │
│  提案: 休憩導線の見直し              │
│                                      │
│  [✅ 採用]  [❌ 却下]  [🕐 後で]     │
└──────────────────────────────────────┘
```

| 属性 | 値 |
|------|-----|
| ファイル | [ReviewProposalCard.tsx](../../src/features/handoff/analysis/components/ReviewProposalCard.tsx) |
| ドメイン | [buildReviewProposal.ts](../../src/features/handoff/analysis/buildReviewProposal.ts) |
| 統合型 | [proposalBundle.ts](../../src/features/handoff/analysis/proposalBundle.ts) |
| 対応原則 | 原則 3（候補提示）、原則 4（根拠付与） |

---

### ReviewRecommendationBanner

> 見直し推奨バナー（画面上部に表示）

| 属性 | 値 |
|------|-----|
| ファイル | [ReviewRecommendationBanner.tsx](../../src/features/handoff/analysis/components/ReviewRecommendationBanner.tsx) |
| ドメイン | [reviewRecommendation.ts](../../src/features/handoff/analysis/reviewRecommendation.ts) |
| 表示場所 | Handoff 画面 上部 |
| 対応原則 | 原則 1（表はシンプル）— 折りたたみ可のバナー型 |

---

### SceneChangeAlertCard

> ABC パターンの場面変化を検出したアラートカード

| 属性 | 値 |
|------|-----|
| ファイル | [SceneChangeAlertCard.tsx](../../src/features/handoff/analysis/components/SceneChangeAlertCard.tsx) |
| ドメイン | [compareAbcPatternPeriods.ts](../../src/features/handoff/analysis/compareAbcPatternPeriods.ts) |
| 対応原則 | 原則 3（注意候補）、原則 4（期間比較根拠） |

---

### ProposalApplyDialog

> 提案採用時の確認ダイアログ（差分プレビュー付き）

```
┌──────────────────────────────────────────┐
│  提案の採用確認                           │
│                                          │
│  ☑ 支援方針 → 「休憩導線見直し」追記      │
│  ☑ 環境調整 → 「刺激量の調整」追記        │
│  ☐ 目標評価 → 変更なし                   │
│                                          │
│  [キャンセル]              [適用して保存]  │
└──────────────────────────────────────────┘
```

| 属性 | 値 |
|------|-----|
| ファイル | [ProposalApplyDialog.tsx](../../src/features/handoff/analysis/components/ProposalApplyDialog.tsx) |
| 型定義 | `ProposalAdoptionRecord` in [proposalBundle.ts](../../src/features/handoff/analysis/proposalBundle.ts) |
| 対応原則 | 原則 5（人が判断）、原則 8（履歴保存） |

---

### IspRecommendationCard

> モニタリングに基づく ISP 推奨カード

| 属性 | 値 |
|------|-----|
| ファイル | [IspRecommendationCard.tsx](../../src/features/monitoring/components/IspRecommendationCard.tsx) |
| ドメイン | [ispRecommendationUtils.ts](../../src/features/monitoring/domain/ispRecommendationUtils.ts) |
| 判断管理 | [useIspRecommendationDecisions.ts](../../src/features/monitoring/hooks/useIspRecommendationDecisions.ts) |
| 対応原則 | 原則 3（候補提示）、原則 5（人が判断） |

---

### IspPlanDraftPreview

> ISP 計画書のドラフトプレビュー

| 属性 | 値 |
|------|-----|
| ファイル | [IspPlanDraftPreview.tsx](../../src/features/monitoring/components/IspPlanDraftPreview.tsx) |
| ドメイン | [ispPlanDraftUtils.ts](../../src/features/monitoring/domain/ispPlanDraftUtils.ts) |
| 対応原則 | 原則 6（記録→改善接続） |

---

## Evidence 系

根拠・出典の表示と追跡に関するコンポーネント群。

### ProvenanceBadge

> フィールドの出典を色分けバッジで表示

```
🔵 [ICF]     ← Assessment
🟢 [特性]    ← 特性アンケート
🟠 [モニタ]  ← Monitoring
```

| 属性 | 値 |
|------|-----|
| ファイル | [ProvenanceBadge.tsx](../../src/features/planning-sheet/components/ProvenanceBadge.tsx) |
| 対応原則 | 原則 4（根拠付与） |
| 色規約 | [ui-conventions.md § Provenance Badge](../product/ui-conventions.md#provenance-badge-規約) |

---

### ImportHistoryTimeline

> 取込操作の履歴をタイムラインで表示

| 属性 | 値 |
|------|-----|
| ファイル | [ImportHistoryTimeline.tsx](../../src/features/planning-sheet/components/ImportHistoryTimeline.tsx) |
| ストア | [importAuditStore.ts](../../src/features/planning-sheet/stores/importAuditStore.ts) |
| 対応原則 | 原則 4（参照元）、原則 8（履歴保存） |

---

### EvidencePatternSummaryCard

> エビデンスパターンの集約サマリーを表示

| 属性 | 値 |
|------|-----|
| ファイル | [EvidencePatternSummaryCard.tsx](../../src/features/planning-sheet/components/EvidencePatternSummaryCard.tsx) |
| ドメイン | [evidencePatternAnalysis.ts](../../src/domain/isp/evidencePatternAnalysis.ts) |
| 対応原則 | 原則 4（根拠付与）、原則 6（改善接続） |

---

### EvidenceLinkSelector

> ABC / PDCA レコードとの参照リンクを選択する UI

| 属性 | 値 |
|------|-----|
| ファイル | [EvidenceLinkSelector.tsx](../../src/features/planning-sheet/components/EvidenceLinkSelector.tsx) |
| ドメイン | [evidenceLink.ts](../../src/domain/isp/evidenceLink.ts) |
| 永続化 | [localEvidenceLinkRepository.ts](../../src/infra/localStorage/localEvidenceLinkRepository.ts) |
| 対応原則 | 原則 4（出典追跡） |

---

### AbcEvidencePanel

> ABC レコードのエビデンス集約パネル（頻出場面・行動・採用度）

| 属性 | 値 |
|------|-----|
| ファイル | [AbcEvidencePanel.tsx](../../src/features/ibd/analysis/pdca/components/AbcEvidencePanel.tsx) |
| ドメイン | [evidencePatternAnalysis.ts](../../src/domain/isp/evidencePatternAnalysis.ts)、[reverseTrace.ts](../../src/domain/isp/reverseTrace.ts) |
| 対応原則 | 原則 4（根拠付与）、原則 6（改善接続） |

---

### IspDecisionHistorySection

> ISP 判断の採用/却下履歴を一覧表示

| 属性 | 値 |
|------|-----|
| ファイル | [IspDecisionHistorySection.tsx](../../src/features/monitoring/components/IspDecisionHistorySection.tsx) |
| リポジトリ | [IspDecisionRepository.ts](../../src/features/monitoring/data/IspDecisionRepository.ts) |
| 対応原則 | 原則 8（組織知化）、原則 5（判断履歴） |

---

## Bridge 系

ISP 三層間のデータ取込ダイアログ群。

### ImportAssessmentDialog

> Bridge 1: Assessment → L2 支援計画シートへの取込

| 属性 | 値 |
|------|-----|
| ファイル | [ImportAssessmentDialog.tsx](../../src/features/planning-sheet/components/ImportAssessmentDialog.tsx) |
| ドメイン | [assessmentBridge.ts](../../src/features/planning-sheet/assessmentBridge.ts) |
| モード | `assessment-only` / `with-tokusei` |
| 対応原則 | 原則 5（確認して採用）、原則 4（Provenance 付き） |

---

### ImportMonitoringDialog

> Bridge 3: Monitoring → L2 支援計画シートへの取込

| 属性 | 値 |
|------|-----|
| ファイル | [ImportMonitoringDialog.tsx](../../src/features/planning-sheet/components/ImportMonitoringDialog.tsx) |
| ドメイン | [monitoringToPlanningBridge.ts](../../src/features/planning-sheet/monitoringToPlanningBridge.ts) |
| 対応原則 | 原則 5（自動追記 + 候補提示） |

---

### ImportPlanningDialog

> Bridge 2: L2 支援計画 → L3 手順書への取込

| 属性 | 値 |
|------|-----|
| ファイル | [ImportPlanningDialog.tsx](../../src/features/daily/components/procedure/ImportPlanningDialog.tsx) |
| ドメイン | [planningToRecordBridge.ts](../../src/features/planning-sheet/planningToRecordBridge.ts) |
| 対応原則 | 原則 5（重複排除 + Provenance 付き） |

---

### ImportPreviewDialog

> 取込前のプレビュー表示ダイアログ

| 属性 | 値 |
|------|-----|
| ファイル | [ImportPreviewDialog.tsx](../../src/features/planning-sheet/components/ImportPreviewDialog.tsx) |
| ドメイン | [buildImportPreview.ts](../../src/features/planning-sheet/buildImportPreview.ts) |

---

## Situation 系

現場の業務導線を構成するコンポーネント群。

### PhaseNextStepBanner

> 現在のワークフローフェーズに応じた次アクション誘導バナー

| 属性 | 値 |
|------|-----|
| ファイル | [PhaseNextStepBanner.tsx](../../src/features/planning-sheet/components/PhaseNextStepBanner.tsx) |
| ドメイン | [workflowPhase.ts](../../src/domain/bridge/workflowPhase.ts)、[nextStepBanner.ts](../../src/domain/bridge/nextStepBanner.ts) |
| 対応原則 | 原則 1（現場導線主体）、原則 7（日次価値） |

---

### MonitoringCountdown

> モニタリング期限までのカウントダウン表示

```
🔵 残り 45 日 [■■■■■░░░░░] 50%
🟠 残り 12 日 [■■■■■■■■░░] 87%
🔴 期限超過 3 日
```

| 属性 | 値 |
|------|-----|
| ファイル | [MonitoringCountdown.tsx](../../src/features/daily/components/MonitoringCountdown.tsx) |
| ドメイン | [monitoringSchedule.ts](../../src/features/planning-sheet/monitoringSchedule.ts) |
| 対応原則 | 原則 6（改善接続）— 90 日サイクルへの誘導 |

---

### TodayBentoLayout

> Today 画面のベントー型グリッドレイアウト

| 属性 | 値 |
|------|-----|
| ファイル | [TodayBentoLayout.tsx](../../src/features/today/layouts/TodayBentoLayout.tsx) |
| ドメイン | [todayScene.ts](../../src/features/today/domain/todayScene.ts)、[deriveCurrentScene.ts](../../src/features/today/domain/deriveCurrentScene.ts) |
| 対応原則 | 原則 1（主役は現場導線） |

---

### DailyPhaseHintBanner

> Daily 画面のフェーズ別ヒントバナー

| 属性 | 値 |
|------|-----|
| ファイル | [DailyPhaseHintBanner.tsx](../../src/features/daily/components/DailyPhaseHintBanner.tsx) |
| 対応原則 | 原則 1（表はシンプル） |

---

## Monitoring 系

### GoalProgressCard

> 目標進捗の可視化カード

| 属性 | 値 |
|------|-----|
| ファイル | [GoalProgressCard.tsx](../../src/features/monitoring/components/GoalProgressCard.tsx) |
| ドメイン | [goalProgressUtils.ts](../../src/features/monitoring/domain/goalProgressUtils.ts) |
| 対応原則 | 原則 6（改善接続） |

---

### MonitoringDailyDashboard

> 日次記録に基づくモニタリングダッシュボード

| 属性 | 値 |
|------|-----|
| ファイル | [MonitoringDailyDashboard.tsx](../../src/features/monitoring/components/MonitoringDailyDashboard.tsx) |
| ドメイン | [monitoringDailyAnalytics.ts](../../src/features/monitoring/domain/monitoringDailyAnalytics.ts) |
| 対応原則 | 原則 6（記録→改善接続） |

---

### IspDecisionSummaryCard

> ISP 判断のサマリーカード

| 属性 | 値 |
|------|-----|
| ファイル | [IspDecisionSummaryCard.tsx](../../src/features/monitoring/components/IspDecisionSummaryCard.tsx) |
| 対応原則 | 原則 8（組織知化） |

---

## Safety 系

### ComplianceDashboard

> 安全管理の統合ダッシュボード

| 属性 | 値 |
|------|-----|
| ファイル | [ComplianceDashboard.tsx](../../src/features/safety/components/ComplianceDashboard.tsx) |
| 対応原則 | 原則 9（一貫性） |

---

### SafetyOperationsSummaryCard

> 安全運用のサマリーカード（適正化委員会・指針・研修・身体拘束）

| 属性 | 値 |
|------|-----|
| ファイル | [SafetyOperationsSummaryCard.tsx](../../src/features/safety/components/SafetyOperationsSummaryCard.tsx) |
| フック | [useSafetyOperationsSummary.ts](../../src/features/safety/hooks/useSafetyOperationsSummary.ts) |
| 対応原則 | 原則 9（一貫性）、原則 5（制度遵守） |

---

### HighRiskIncidentDialog

> 危機対応記録ダイアログ (P0-1)

| 属性 | 値 |
|------|-----|
| ファイル | [HighRiskIncidentDialog.tsx](../../src/features/ibd/procedures/templates/HighRiskIncidentDialog.tsx) |
| 永続化 | [localIncidentRepository.ts](../../src/infra/localStorage/localIncidentRepository.ts) |

---

## 共通 UI パターン

### パターン: Proposal の表示方法

| 画面カテゴリ | 表示方法 | コンポーネント |
|-------------|---------|---------------|
| Today / Handoff | バナー型（折りたたみ可） | `ReviewRecommendationBanner` |
| Planning | サイドパネル or ダイアログ | `ReviewProposalCard` + `ProposalApplyDialog` |
| Monitoring | カード型 | `IspRecommendationCard` |
| ABC 分析 | アラートカード | `SceneChangeAlertCard` |

### パターン: Bridge 取込の共通フロー

```
1. ユーザーが「取込」ボタンをクリック
2. ImportXxxDialog が候補を表示
3. ユーザーがチェックボックスで選択
4. プレビューで差分を確認
5. 「適用」→ Provenance 付きで反映
6. ImportHistoryTimeline に記録
```

### パターン: 根拠表示の共通構造

```
Layer 2 (常時表示):   ProvenanceBadge (🔵🟢🟠)
Layer 4 (展開時):     出典レコードリンク + ImportHistoryTimeline
```

---

## 新規コンポーネント追加時のチェックリスト

- [ ] 既存コンポーネントで代替できないか確認した
- [ ] [UI 設計規約](../product/ui-conventions.md) の用語・色・アイコンに従っている
- [ ] 本カタログに追記した
- [ ] どの [設計原則](../product/principles.md) に対応するか明記した
- [ ] ドメインロジックは `domain/` に Pure Function として切り出した

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 著者 |
|------|-----------|---------|------|
| 2026-03-16 | 1.0 | 初版作成 | プロダクトチーム |

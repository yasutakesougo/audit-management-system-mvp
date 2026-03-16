# Ops Dashboard — Observability Layer 設計書

## 目的

`/ops` は、Support Operations OS の **運用状態を判断するための画面** です。

具体的には以下の問いに答えます。

| 問い | 対応カード |
|------|----------|
| 提案は信頼されているか？ | Proposal Adoption |
| 改善が最後まで回っているか？ | PDCA Cycle Health |
| 改善のスピードは健全か？ | Cycle Speed |
| 成功が知識として蓄積されたか？ | Knowledge Growth |
| 今すぐ手当てが必要な案件は？ | Cycle Alerts |

## 非目的

- 個票（利用者一人の詳細）の編集はここでやらない → `/today`, `/monitoring`
- 分析レポートの生成はここでやらない → `/analysis`
- 記録入力はここでやらない → `/daily`

## データ成熟度

| レベル | 状態 | 説明 |
|--------|------|------|
| **demo** | ✅ 現在 | 内蔵サンプルデータで表示 |
| **adapter** | 🔧 Phase 1 | 既存 localStorage の SuggestionAction から変換 |
| **real** | 📅 Phase 2+ | SharePoint / Firestore の正式データソース |

## アーキテクチャ

```
L1 記録・入力  → Daily / Monitoring / ISP / Handoff
L2 分析       → analytics / proposal generation / unified evidence
L3 改善       → PDCA / proposal adoption / planning feedback
L4 観測       → /ops で運用状態を定量監視 ← ここ
```

### コード構造

```
src/domain/metrics/                ← Pure Function（テスト済み）
  ├── proposalMetrics.ts           ← 提案採用率・速度・理由
  ├── pdcaCycleMetrics.ts          ← PDCA完走率・遅延・停滞
  ├── knowledgeMetrics.ts          ← 判断記録蓄積・Evidence密度
  ├── metricsThresholds.ts         ← 全しきい値の一元管理
  └── adapters/
      └── proposalDecisionAdapter.ts ← SuggestionAction → ProposalDecisionRecord

src/features/ops-dashboard/        ← UI Layer
  ├── components/
  │   ├── OpsMetricCard.tsx        ← 汎用KPIカード
  │   ├── ProposalAdoptionCard.tsx
  │   ├── PdcaCycleHealthCard.tsx
  │   ├── CycleSpeedCard.tsx
  │   ├── KnowledgeGrowthCard.tsx
  │   └── CycleAlertsCard.tsx
  └── OpsMetricsDashboard.tsx      ← 5カード統合 + デモモード

src/pages/OpsMetricsPage.tsx       ← /ops ページ
```

### しきい値管理

全てのしきい値は `metricsThresholds.ts` に集約されています。
運用中に調整する場合、このファイルのみ変更すれば全カードに反映されます。

| カテゴリ | 定数 | 値 | 意味 |
|---------|------|---|------|
| 提案採用率 | `GOOD_THRESHOLD` | 50% | 🟢 信頼されている |
| 提案採用率 | `WARNING_THRESHOLD` | 30% | 🟡 調整必要 |
| サイクル速度 | `GOOD_MAX_DAYS` | 60日 | 🟢 健全 |
| サイクル速度 | `WARNING_MAX_DAYS` | 90日 | 🟡 やや遅い |
| 停滞検出 | `STALLED_THRESHOLD_DAYS` | 14日 | 提案後の放置検出 |
| 成功パターン | `GOOD_PROVEN_PATTERNS` | 3件 | 🟢 知識化が進んでいる |
| 成功パターン | `PROVEN_ACCEPTANCE_RATE` | 60% | 定義: 採用率下限 |
| 成功パターン | `PROVEN_MIN_OCCURRENCES` | 3回 | 定義: 最低出現数 |

## 本番データ接続ロードマップ

### Phase 1: Proposal Records の実データ化

```
localStorage (acceptedSuggestions)
  → SuggestionAction[]
  → adaptSuggestionActions()       ← ✅ 実装済み
  → ProposalDecisionRecord[]
  → computeProposalMetrics()
```

### Phase 2: PDCA Cycle Records の実データ化

```
monitoringSchedule + ISP更新履歴 + proposal adoption
  → PdcaCycleRecord[]
  → computePdcaCycleMetrics()
```

### Phase 3: Knowledge Records の実データ化

```
evidenceLinkRepository + 判断履歴 + 支援計画一覧
  → DecisionRecord[] + EvidenceLinkRecord[] + planningSheetIds
  → computeKnowledgeMetrics()
```

### Phase 4: 統合

```
useOpsMetrics() hook
  ├ useProposalDecisions()
  ├ usePdcaCycles()
  └ useKnowledgeRecords()
  → OpsMetricsDashboard demo=false
```

## 週次レビューでの使い方

推奨する確認順序:

1. **Alerts** — 今すぐ対応が必要な案件はあるか
2. **PDCA Completion** — サイクルは回っているか
3. **Cycle Speed** — 改善速度は維持されているか
4. **Adoption** — 提案は信頼されているか
5. **Knowledge Growth** — 成功パターンは蓄積されているか

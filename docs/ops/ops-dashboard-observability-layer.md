# Ops Dashboard — Observability Layer 設計書

> 2026-03-16 策定 / 同日 v2.0 更新（5カード全実データ化完了）

## 1. 目的

`/ops` は、Support Operations OS の **運用状態を判断するための画面** です。

具体的には以下の問いに答えます。

| 問い | 対応カード |
|------|----------|
| 提案は信頼されているか？ | Proposal Adoption |
| 改善が最後まで回っているか？ | PDCA Cycle Health |
| 改善のスピードは健全か？ | Cycle Speed |
| 成功が知識として蓄積されたか？ | Knowledge Growth |
| 今すぐ手当てが必要な案件は？ | Cycle Alerts |

## 2. 非目的

- 個票（利用者一人の詳細）の編集はここでやらない → `/today`, `/monitoring`
- 分析レポートの生成はここでやらない → `/analysis`
- 記録入力はここでやらない → `/daily`

## 3. 運用開始判定

`/ops` は **段階的に実データ化** される設計です。

| 条件 | 表示 |
|------|------|
| SuggestionAction が 1 件以上ある | Proposal カード: 実データ |
| 利用者の serviceStartDate が登録済み | PDCA 3 カード: 実データ |
| Evidence Link が 1 件以上ある | Knowledge カード: 実データ |
| 上記のいずれもない | 全カード: デモモード |

**操作不要**: 運用した結果がそのまま `/ops` に反映されます。

## 4. データ成熟度（現在の状態）

| レイヤ | 状態 | 説明 |
|--------|------|------|
| **Proposal** | ✅ 本番稼働 | SuggestionAction → adapter → metrics |
| **PDCA** | ✅ 本番稼働 | User[] → connector → builder → metrics |
| **Knowledge** | ✅ 本番稼働 | EvidenceLinkRepo + SuggestionAction → adapter → metrics |

## 5. アーキテクチャ

```
L1 記録・入力  → Daily / Monitoring / ISP / Handoff
L2 分析       → analytics / proposal generation / unified evidence
L3 改善       → PDCA / proposal adoption / planning feedback
L4 観測       → /ops で運用状態を定量監視 ← ここ
```

### 実データフロー（完成形）

```
localStorage
  │
  ├── daily-record-* → SuggestionAction[]
  │     ├── adaptSuggestionActions()         → Proposal Metrics
  │     ├── buildPdcaCycleRecords()          → PDCA Metrics (proposalAcceptedAt)
  │     └── adaptSuggestionActionsToDecisionRecords() → Knowledge Metrics
  │
  ├── evidence-links → localEvidenceLinkRepository
  │     └── adaptEvidenceLinks()             → Knowledge Metrics
  │
  └── useUsers() → User[]
        └── buildUserPdcaInputs()            → PDCA Metrics
```

### コード構造

```
src/domain/metrics/                     ← Pure Function（99テスト）
  ├── proposalMetrics.ts                ← 提案採用率・速度・理由
  ├── pdcaCycleMetrics.ts               ← PDCA完走率・遅延・停滞
  ├── knowledgeMetrics.ts               ← 判断記録蓄積・Evidence密度
  ├── metricsThresholds.ts              ← 全しきい値の一元管理
  └── adapters/
      ├── proposalDecisionAdapter.ts    ← SuggestionAction → ProposalDecisionRecord
      ├── pdcaCycleBuilder.ts           ← 支援データ → PdcaCycleRecord
      ├── userPdcaInputConnector.ts     ← User[] → UserPdcaInput[]
      └── knowledgeDataAdapter.ts       ← EvidenceLinkMap + SuggestionAction → Knowledge入力

src/features/ops-dashboard/
  ├── components/                        ← 6 コンポーネント
  │   ├── OpsMetricCard.tsx             ← 汎用KPIカード
  │   ├── ProposalAdoptionCard.tsx
  │   ├── PdcaCycleHealthCard.tsx
  │   ├── CycleSpeedCard.tsx
  │   ├── KnowledgeGrowthCard.tsx
  │   └── CycleAlertsCard.tsx
  ├── hooks/useOpsMetrics.ts            ← 統合hook（Phase 1-3 全接続済み）
  └── OpsMetricsDashboard.tsx           ← 5カード統合

src/pages/OpsMetricsPage.tsx            ← /ops ページ
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

## 6. 週次レビュー運用ルール

### 確認順序（推奨）

| 順 | カード | 確認観点 | 所要時間 |
|----|--------|---------|---------|
| 1 | **Cycle Alerts** | 今すぐ対応が必要な案件はあるか | 1分 |
| 2 | **PDCA Cycle Health** | サイクルは回っているか | 2分 |
| 3 | **Cycle Speed** | 改善速度は維持されているか | 1分 |
| 4 | **Proposal Adoption** | 提案は信頼されているか | 2分 |
| 5 | **Knowledge Growth** | 成功パターンは蓄積されているか | 2分 |

合計: **約 8 分**

### 各カードの解釈ガイド

#### Cycle Alerts

| 状態 | 意味 | 対応 |
|------|------|------|
| アラートなし | 全サイクル正常 | 次へ進む |
| overdue あり | 期限超過のサイクルがある | 該当利用者の PDCA を確認 |
| stalled あり | 提案採用後に動きがない | モニタリング実施を促す |

#### PDCA Cycle Health

| 完走率 | 解釈 |
|--------|------|
| 80% 以上 | 🟢 組織として改善が回っている |
| 50-80% | 🟡 一部サイクルが止まっている。原因を調査 |
| 50% 未満 | 🔴 改善循環が機能していない。運用体制の見直し |

#### Cycle Speed

| 中央値 | 解釈 |
|--------|------|
| 60 日以内 | 🟢 健全なペース |
| 60-90 日 | 🟡 やや遅い。ボトルネックを確認 |
| 90 日超 | 🔴 改善に時間がかかりすぎ |

#### Proposal Adoption

| 採用率 | 解釈 |
|--------|------|
| 50% 以上 | 🟢 提案が信頼されている |
| 30-50% | 🟡 提案の質 or 提示タイミングに課題 |
| 30% 未満 | 🔴 提案ロジックの見直しが必要 |

#### Knowledge Growth

| 成功パターン数 | 解釈 |
|--------------|------|
| 3 件以上 | 🟢 知識化が進んでいる |
| 1-2 件 | 🟡 蓄積中。Evidence Link の積み上げを継続 |
| 0 件 | 🔴 十分なデータ量に達していない |

### 判断の優先度

```
Alert が出ている → まず対応
PDCA が止まっている → サイクルを回す
速度が遅い → ボトルネックを特定
採用率が低い → 提案ロジック改善
パターンが少ない → データ蓄積の段階
```

## 7. 除外ルールと注意点

- `serviceStartDate` 未設定の利用者は PDCA 計測対象外
- 除外人数は `excludedUserCount` として画面に表示される
- 除外を overdue に含めると率が不当に悪化するため、明示的に分離
- 詳細は `pdca-cycle-record-definition.md` §7 参照

## 8. 将来の拡張

### SharePoint / Firestore 接続時

adapter 層のみ差し替えれば対応可能。metrics / UI は変更不要。

```
現在: localStorage → adapter → metrics
将来: SharePoint  → adapter → metrics  ← adapter のみ差替
```

### Repository Interface 化（検討中）

```typescript
interface ProposalMetricsSource {
  getRecords(period: MetricsPeriod): ProposalDecisionRecord[];
}
interface PdcaCycleSource {
  getRecords(today: string): PdcaCycleRecord[];
}
interface KnowledgeSource {
  getDecisions(): DecisionRecord[];
  getEvidenceLinks(): EvidenceLinkRecord[];
  getPlanningSheetIds(): string[];
}
```

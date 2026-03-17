# Support Operations OS — Metrics Framework

> **ドキュメント種別:** 運用 KPI 設計  
> **ステータス:** Draft  
> **初版:** 2026-03-16  
> **最終更新:** 2026-03-16  
> **準拠:** [設計原則 10 箇条](../product/principles.md) / [Knowledge Model](../data/knowledge-model.md)

---

## 概要

> **計測できないものは改善できない。**

本フレームワークは、Support Operations OS の運用効果を
**5 つの指標カテゴリ** で定量化する。

```
┌────────────────────────────────────────────────────────┐
│              Metrics Framework                         │
│                                                        │
│  ① Adoption  ← システムは使われているか？              │
│  ② Proposal  ← 提案は価値を生んでいるか？              │
│  ③ PDCA      ← サイクルは回っているか？                │
│  ④ Knowledge ← 組織知は蓄積されているか？              │
│  ⑤ Quality   ← 支援の質は向上しているか？              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 目次

- [1. Adoption Metrics — 定着指標](#1-adoption-metrics--定着指標)
- [2. Proposal Metrics — 提案価値指標](#2-proposal-metrics--提案価値指標)
- [3. PDCA Metrics — サイクル指標](#3-pdca-metrics--サイクル指標)
- [4. Knowledge Metrics — 組織知化指標](#4-knowledge-metrics--組織知化指標)
- [5. Quality Metrics — 支援品質指標](#5-quality-metrics--支援品質指標)
- [6. Ops Dashboard 設計](#6-ops-dashboard-設計)
- [7. 実装マップ](#7-実装マップ)
- [8. Data Sources](#8-data-sources)

---

## 1. Adoption Metrics — 定着指標

> **問い:** 現場で自然に使われているか？（原則 1, 7）

### KPI

| # | 指標 | 定義 | 算出式 | 目標 |
|---|------|------|--------|------|
| A1 | **DAU（日次利用者数）** | Today 画面を開いた一意ユーザー数/日 | `COUNT(DISTINCT userId WHERE page='/today')` | 常勤職員の 80%+ |
| A2 | **記録入力率** | Daily 記録が入力された利用者の割合/日 | `出席利用者のうち記録あり / 出席利用者数` | ≥ 90% |
| A3 | **申し送り入力率** | Handoff が作成されたシフトの割合 | `申し送りあり シフト / 全シフト` | ≥ 70% |
| A4 | **CTA クリック率** | Today 画面の CTA が使われた割合 | `タップ数 / 表示数` | ≥ 40% |
| A5 | **導線完走率** | Today → Daily → 記録保存の完走率 | `保存完了 / Today CTA タップ` | ≥ 60% |

### 計測方法

| 指標 | データソース | 既存基盤 |
|------|------------|---------|
| A1 | Firestore telemetry | ✅ [recordCtaClick.ts](../../src/features/today/telemetry/recordCtaClick.ts) |
| A2 | Daily Record count | ✅ SharePoint adapter |
| A3 | Handoff count per shift | ✅ SharePoint adapter |
| A4 | CTA telemetry | ✅ `CTA_EVENTS` 定数 |
| A5 | CTA → 記録保存のペア | 🟡 保存イベントの追加が必要 |

### Pure Function

```typescript
// src/domain/metrics/adoptionMetrics.ts

interface DailyAdoptionSnapshot {
  date: string;                      // ISO 8601 (YYYY-MM-DD)
  totalStaff: number;                // 常勤職員数
  todayPageVisitors: number;         // Today を開いたユーザー数
  dailyRecordedUsers: number;        // 記録が入力された利用者数
  attendedUsers: number;             // 出席した利用者数
  handoffCount: number;              // 申し送り件数
  totalShifts: number;               // シフト数
  ctaClicks: number;                 // CTA クリック数
  ctaImpressions: number;            // CTA 表示数
}

interface AdoptionMetricsResult {
  dau: number;
  dauRate: number;                   // DAU / totalStaff (%)
  recordInputRate: number;           // dailyRecorded / attended (%)
  handoffRate: number;               // handoffCount / totalShifts (%)
  ctaClickRate: number;              // clicks / impressions (%)
  trend: 'improving' | 'stable' | 'declining';
}

function computeAdoptionMetrics(
  snapshots: DailyAdoptionSnapshot[],
  windowDays: number = 7,
): AdoptionMetricsResult;
```

---

## 2. Proposal Metrics — 提案価値指標

> **問い:** 提案は人に受け入れられ、価値を生んでいるか？（原則 3, 4, 5）

### KPI

| # | 指標 | 定義 | 算出式 | 目標 |
|---|------|------|--------|------|
| P1 | **提案確認率** | 表示された提案を確認した割合 | `viewed / (pending + viewed)` | ≥ 90% |
| P2 | **採用率** | 確認後に採用された割合 | `accepted / (accepted + dismissed)` | 40〜70% |
| P3 | **却下理由分布** | 却下理由の内訳 | `GROUP BY dismissReason` | `not_applicable` が最多なら健全 |
| P4 | **ソース別採用率** | 提案ソースごとの採用率 | `acceptRate BY source` | 均等に近い |
| P5 | **提案→反映速度** | 提案から採用までの日数 | `AVG(decidedAt - generatedAt)` | ≤ 3 日 |
| P6 | **期限切れ率** | expired になった提案の割合 | `expired / total` | ≤ 10% |

### 既存の実装基盤

すでに [`adoptionMetrics.ts`](../../src/features/daily/domain/adoptionMetrics.ts) に以下が実装済み。

| 関数 | 内容 |
|------|------|
| `computeAdoptionMetrics()` | accept / dismiss の集計 |
| `computeByRule()` | ルール別の採用率 |
| `countISPImports()` | ISP への反映件数 |
| `safeRate()` | ゼロ除算安全な割合計算 |
| `extractRulePrefix()` | ルールのグルーピング |

### 追加が必要な Pure Function

```typescript
// src/domain/metrics/proposalMetrics.ts

interface ProposalMetricsInput {
  adoptionRecords: ProposalAdoptionRecord[];
  proposals: PlanningProposalBundle[];
  period: { start: string; end: string };
}

interface ProposalMetricsResult {
  // 基本指標
  totalProposals: number;
  viewedCount: number;
  viewedRate: number;
  acceptedCount: number;
  dismissedCount: number;
  deferredCount: number;
  expiredCount: number;
  acceptRate: number;
  expiredRate: number;

  // ソース別
  bySource: {
    source: ProposalSource;
    total: number;
    accepted: number;
    acceptRate: number;
  }[];

  // 却下理由分布
  dismissReasons: {
    reason: DismissReason;
    count: number;
    rate: number;
  }[];

  // 速度
  avgDecisionDays: number;
  medianDecisionDays: number;
}

function computeProposalMetrics(input: ProposalMetricsInput): ProposalMetricsResult;
```

---

## 3. PDCA Metrics — サイクル指標

> **問い:** 計画→実施→評価→改善のループが回っているか？（原則 6）

### KPI

| # | 指標 | 定義 | 算出式 | 目標 |
|---|------|------|--------|------|
| C1 | **モニタリング実施率** | 90 日サイクル内にモニタリングが実施された割合 | `完了 / ( 完了 + 期限超過)` | 100% |
| C2 | **モニタリング遅延日数** | 期限超過している平均日数 | `AVG(today - dueDate) WHERE overdue` | 0 日 |
| C3 | **Bridge 活用率** | Bridge 取込が行われた支援計画の割合 | `Bridge経由取込あり / 全支援計画` | ≥ 50% |
| C4 | **Provenance 追跡率** | Provenance 付きフィールドの割合 | `provenance付き / 全取込フィールド` | 100% |
| C5 | **計画版数** | 支援計画の平均版数/90 日サイクル | `AVG(version count) per cycle` | ≥ 2 |

### Pure Function

```typescript
// src/domain/metrics/pdcaMetrics.ts

interface PdcaCycleInput {
  monitoringSchedules: {
    userId: string;
    dueDate: string;
    completedDate?: string;
  }[];
  planningSheetVersions: PlanningSheetVersion[];
  importAuditRecords: ImportAuditRecord[];
  provenanceEntries: ProvenanceEntry[];
  today: string;  // ISO 8601
}

interface PdcaCycleResult {
  monitoringCompletionRate: number;
  overdueCount: number;
  avgOverdueDays: number;
  bridgeUsageRate: number;
  provenanceCoverage: number;
  avgVersionsPerCycle: number;
}

function computePdcaCycleMetrics(input: PdcaCycleInput): PdcaCycleResult;
```

---

## 4. Knowledge Metrics — 組織知化指標

> **問い:** 判断が組織の資産として蓄積されているか？（原則 8）

### KPI

| # | 指標 | 定義 | 算出式 | 目標 |
|---|------|------|--------|------|
| K1 | **判断記録数** | 月あたりの採用/却下記録数 | `COUNT(AdoptionRecord) per month` | ≥ 20 件/月 |
| K2 | **理由付き却下率** | 却下時に理由が記録された割合 | `理由あり却下 / 全却下` | ≥ 80% |
| K3 | **Evidence Link 数** | 支援計画あたりの Evidence Link 平均数 | `AVG(links) per planningSheet` | ≥ 3 |
| K4 | **パターン再利用率** | 過去に採用された提案パターンの再出現率 | `同一 rulePrefix の再提案中の再採用率` | 上昇傾向 |
| K5 | **引き継ぎカバレッジ** | 担当変更時に判断履歴が参照された割合 | `参照あり引き継ぎ / 全引き継ぎ` | ≥ 50% |

### Pure Function

```typescript
// src/domain/metrics/knowledgeMetrics.ts

interface KnowledgeMetricsInput {
  adoptionRecords: ProposalAdoptionRecord[];
  evidenceLinks: EvidenceLink[];
  planningSheetIds: string[];
  period: { start: string; end: string };
}

interface KnowledgeMetricsResult {
  recordsPerMonth: number;
  reasonedDismissRate: number;
  avgLinksPerSheet: number;
  patternReuseRate: number;
  topPatterns: {
    rulePrefix: string;
    label: string;
    acceptRate: number;
    count: number;
  }[];
}

function computeKnowledgeMetrics(input: KnowledgeMetricsInput): KnowledgeMetricsResult;
```

---

## 5. Quality Metrics — 支援品質指標

> **問い:** 支援の質が向上しているか？（原則 10）

### KPI

| # | 指標 | 定義 | 算出式 | 目標 |
|---|------|------|--------|------|
| Q1 | **モニタリング評価改善率** | 「有効」評価が増加しているか | `有効 / (有効 + 一部有効 + 無効) の推移` | 上昇傾向 |
| Q2 | **行動パターン変化率** | ABC パターンの前月比変化量 | `場面変化検出の 件数推移` | 減少傾向 |
| Q3 | **目標達成率** | 目標の達成度の平均 | `AVG(goalProgress)` | ≥ 60% |
| Q4 | **制度遵守率** | Regulatory Check の合格率 | `Pass / Total findings` | ≥ 90% |
| Q5 | **安全事故率** | ヒヤリハット・事故の発生率 | `件数 / 延べ利用者日数` | 減少傾向 |

### 長期追跡のポイント

Quality Metrics は **短期では測れない**。以下の期間で評価する。

| 期間 | 評価内容 |
|------|---------|
| **月次** | モニタリング評価の推移、制度遵守率 |
| **四半期** | 行動パターン変化、目標達成率の推移 |
| **年次** | 安全事故率、全体的な支援品質トレンド |

---

## 6. Ops Dashboard 設計

### ダッシュボード構成

```
┌──────────────────────────────────────────────────────────────┐
│  Support Operations OS — Ops Dashboard                       │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  DAU: 12/15     │  │  採用率: 58%    │  │  遅延: 0件   │ │
│  │  記録率: 94%    │  │  期限切れ: 3%   │  │  Version: 2.3│ │
│  │  ■■■■■■■■■░     │  │  ■■■■■■░░░░     │  │  ⭐⭐⭐        │ │
│  │  Adoption       │  │  Proposal       │  │  PDCA        │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐│
│  │  判断蓄積: 24件 │  │  採用率推移（過去12週）             ││
│  │  Evidence: 4.2  │  │  ■                                  ││
│  │  理由付き: 85%  │  │   ■ ■                               ││
│  │  Knowledge      │  │  ■ ■ ■ ■   ■                       ││
│  └─────────────────┘  │   ■ ■ ■ ■ ■ ■ ■ ■ ■ ■ ■           ││
│                       └─────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │  ⚠️ 注意項目                                            ││
│  │  ・モニタリング期限 7日以内: 3件                          ││
│  │  ・未確認提案: 5件                                       ││
│  │  ・記録なし利用者: 1名（出席済み）                       ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### カードのカラーコード

| 状態 | 色 | 条件 |
|------|-----|------|
| 🟢 良好 | `success.main` | 目標達成 |
| 🟡 注意 | `warning.main` | 目標の 80〜100% |
| 🔴 警告 | `error.main` | 目標の 80% 未満 |

### 情報の更新頻度

| カテゴリ | 更新頻度 | トリガー |
|---------|---------|---------|
| Adoption | **リアルタイム** | ページ読込時 |
| Proposal | **日次** | 日次バッチ or 操作時 |
| PDCA | **日次** | モニタリングスケジュール確認時 |
| Knowledge | **週次** | 集計バッチ |
| Quality | **月次** | モニタリング完了時 |

---

## 7. 実装マップ

### 既存コードとの対応

| メトリクス | 既存実装 | 追加が必要な実装 |
|-----------|---------|----------------|
| **Adoption: CTA クリック** | ✅ [recordCtaClick.ts](../../src/features/today/telemetry/recordCtaClick.ts) | — |
| **Proposal: 採用率** | ✅ [adoptionMetrics.ts](../../src/features/daily/domain/adoptionMetrics.ts) | ProposalBundle 版の拡張 |
| **Proposal: ルール別採用率** | ✅ `computeByRule()` | — |
| **PDCA: モニタリング遅延** | ✅ [monitoringSchedule.ts](../../src/features/planning-sheet/monitoringSchedule.ts) | 遅延日数の集約 |
| **Knowledge: Evidence Link** | ✅ [evidenceLink.ts](../../src/domain/isp/evidenceLink.ts) | リンク数集約 |
| **Quality: 目標達成率** | ✅ [goalProgressUtils.ts](../../src/features/monitoring/domain/goalProgressUtils.ts) | 全ユーザー集約 |

### 新規作成が必要なファイル

```
src/domain/metrics/
  ├── adoptionDashboardMetrics.ts   ← Adoption KPI の Pure Function
  ├── proposalMetrics.ts            ← Proposal KPI の Pure Function
  ├── pdcaCycleMetrics.ts           ← PDCA KPI の Pure Function
  ├── knowledgeMetrics.ts           ← Knowledge KPI の Pure Function
  └── index.ts                      ← 統合エクスポート

src/features/ops-dashboard/
  ├── components/
  │   ├── AdoptionCard.tsx          ← Adoption KPI カード
  │   ├── ProposalCard.tsx          ← Proposal KPI カード
  │   ├── PdcaCycleCard.tsx         ← PDCA KPI カード
  │   ├── KnowledgeCard.tsx         ← Knowledge KPI カード
  │   ├── AlertList.tsx             ← ⚠️ 注意項目リスト
  │   └── TrendChart.tsx            ← 推移グラフ
  ├── hooks/
  │   └── useOpsMetrics.ts          ← メトリクス取得 hook
  └── OpsMetricsDashboard.tsx       ← ダッシュボード本体
```

### 実装優先順位

| 優先度 | メトリクス | 理由 |
|--------|-----------|------|
| **P1** | Proposal 採用率 | すでに `adoptionMetrics.ts` があり、拡張が容易 |
| **P1** | PDCA モニタリング遅延 | `monitoringSchedule.ts` から計算可能 |
| **P2** | Adoption 記録入力率 | Daily Record の集計 |
| **P2** | Knowledge Evidence 数 | `evidenceLink` の集計 |
| **P3** | Quality 目標達成率 | `goalProgressUtils` からの集約 |
| **P3** | Adoption DAU | Firestore telemetry の集約 |

---

## 8. Data Sources

### メトリクスが参照するデータ

```
                      ┌────────────────────────────────┐
                      │        Metrics Engine           │
                      │    (Pure Function Layer)        │
                      └──────────┬─────────────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
          ▼                      ▼                      ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Records         │  │  Decisions       │  │  Telemetry       │
│                  │  │                  │  │                  │
│  Daily Record    │  │  AdoptionRecord  │  │  CTA Click       │
│  Handoff         │  │  IspDecision     │  │  Page View       │
│  ABC Record      │  │  ImportAudit     │  │  Record Save     │
│  Attendance      │  │  PlanningVersion │  │                  │
│  Monitoring      │  │  EvidenceLink    │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
      ↓                      ↓                      ↓
   SharePoint           localStorage            Firestore
   (本番)               (開発/デモ)              (テレメトリ)
```

---

## 変更履歴

| 日付 | バージョン | 変更内容 | 著者 |
|------|-----------|---------|------|
| 2026-03-16 | 1.0 | 初版作成 | プロダクトチーム |

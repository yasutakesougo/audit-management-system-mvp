# 支援PDCAエンジン — L1/L2 レビュー周期とデータフロー

## 1. 概要

本システムでは以下の **2層のレビュー** を明確に区別する。

| 層 | 名称 | 目的 | 周期 | 性質 |
|---|---|---|---|---|
| **L1** | 個別支援計画（ISP） | 支援方針の正式見直し | **6か月** | 計画レベルのレビュー |
| **L2** | 支援計画シート / モニタリング | 支援状況の確認・進捗チェック | **3か月** | 支援状況のチェック |

> **周期が違う理由**: L1 は法的な支援計画の更新であり、計画変更・家族意向・サービス調整を含む重い判断。
> L2 は日常の支援記録を分析し、目標進捗や問題の早期発見を行う軽量なチェック。
> モニタリング（L2）結果は ISP 見直し（L1）の根拠として利用される。

---

## 2. L1：個別支援計画（ISP）

### 扱う内容

- 長期目標 / 短期目標
- 支援内容 / サービス内容
- 本人意向 / 家族意向
- 計画変更判定
- 同意取得 / 交付記録

### 見直し周期

| 条件 | 周期 | 実装 |
|---|---|---|
| 原則 | 180日（6か月） | `reviewCycleDays: 180` |
| 初回 | ※制度上「初回は3か月以内」とする運用指針あり | 🔜 今後対応 |

### 実装ポイント

```
schema.ts → ispReviewControlSchema
  reviewCycleDays: 180  (デフォルト)
  lastReviewedAt: ISO 8601
  nextReviewDueAt: ISO 8601

supportPlanDeadline.ts
  次回モニタ期限 = lastMonitoringDate + 6か月

schema.ts → daysUntilIspReview()
  見直し期限までの残日数計算

schema.ts → isIspReviewOverdue()
  見直し期限超過判定
```

---

## 3. L2：支援計画シート / モニタリング

### 扱う内容

- 日次記録の分析
- 行動タグ / ABC 分析
- 目標進捗（GoalProgress）
- 支援効果の評価
- 所見 / 改善提案

### モニタリング周期

| 条件 | 周期 | 実装 |
|---|---|---|
| 定期モニタリング | 90日（3か月） | `monitoringCycleDays: 90` |
| 行動トリガー | 随時 | `ReassessmentTrigger: incident / monitoring` |

### 実装ポイント

```
schema.ts → planningSheetFormSchema
  monitoringCycleDays: 90  (デフォルト、1〜365 設定可)

monitoringSchedule.ts → calculateMonitoringSchedule()
  周期番号 / 超過判定 / 進捗率 / 残日数

planningSheetReassessment.ts
  DEFAULT_REASSESSMENT_CYCLE_DAYS: 90
  ReassessmentTrigger: scheduled | incident | monitoring | other
  PlanChangeDecision: no_change | minor_revision | major_revision | urgent_revision

MonitoringCountdown.tsx → computeMonitoringCycle()
  アセスメント日起点の3か月カウントダウンUI
```

---

## 4. PDCA 階層構造

```
┌───────────────────────────────────────────────────────────────┐
│                     L1: 個別支援計画 (ISP)                     │
│                     ── 6か月 レビュー ──                       │
│                                                               │
│  Plan: 長期目標 / 短期目標 / 支援内容 / 家族意向               │
│  ──────────────────────────────────────                       │
│         ▲ ISP見直し                    │ 計画交付              │
│         │ (根拠: L2結果)               ▼                      │
├───────────────────────────────────────────────────────────────┤
│                  L2: モニタリング (支援計画シート)               │
│                  ── 3か月 確認 ──                              │
│                                                               │
│  Check: 目標進捗 / 行動分析 / 支援効果 / 所見                  │
│  ──────────────────────────────────────                       │
│         ▲ 分析・集約                   │ 手順設計              │
│         │                             ▼                      │
├───────────────────────────────────────────────────────────────┤
│                        L3: 日次記録 (Daily)                    │
│                        ── 毎日 ──                             │
│                                                               │
│  Do: 支援手順実施 / 行動タグ / バイタル / 特記事項              │
└───────────────────────────────────────────────────────────────┘
```

**データフロー**:

```
Daily records (毎日)
     ↓  蓄積・タグ付け
Monitoring analytics (3か月)
     ↓  GoalProgress 推論
Monitoring sheet 作成
     ↓  根拠データとして参照
ISP review (6か月)
     ↓  計画更新 → 新しい目標設定
Daily records (次サイクル)
```

---

## 5. 完成形アーキテクチャ

### 5.1 全体像

```
                     ┌──────────────────────┐
                     │   ISP Review Engine   │
                     │   (6か月)             │
                     │                      │
                     │  ・見直し候補生成     │
                     │  ・計画変更判定       │
                     │  ・承認ワークフロー   │
                     └──────────┬───────────┘
                                │
                     ISP見直し提案
                     (根拠: モニタリング結果)
                                │
                     ┌──────────▼───────────┐
                     │  Monitoring Engine    │
                     │  (3か月)              │
                     │                      │
                     │  ・GoalProgress推論   │
                     │  ・行動傾向分析       │
                     │  ・再評価トリガー     │
                     │  ・所見テンプレ生成   │
                     └──────────┬───────────┘
                                │
                     分析対象データ取得
                                │
           ┌────────────────────┼────────────────────┐
           │                    │                    │
    ┌──────▼──────┐    ┌───────▼───────┐    ┌──────▼──────┐
    │  Daily       │    │  Behavior     │    │  Iceberg    │
    │  Records     │    │  Tags         │    │  Analysis   │
    │  (L3)        │    │               │    │             │
    │  支援手順記録 │    │  行動タグ集計  │    │  ABC/仮説    │
    └─────────────┘    └───────────────┘    └─────────────┘
```

### 5.2 Monitoring → ISP 連携（Phase 4-A/4-B ✅ 実装済み）

**判定マトリクス**:

```
MonitoringResult (GoalProgressSummary)
├── achieved/progressing  → 「継続」continue
├── stagnant + stable     → 「支援方法の見直し」adjust-support
├── stagnant + declining  → 「目標再設定」revise-goal（昇格）
├── regressing + stable   → 「目標再設定」revise-goal
├── regressing + declining (記録≥3) → 「緊急レビュー」urgent-review
└── noData                → 「判定保留」pending
```

**実装ファイル**:

| Phase | ファイル | 役割 |
|---|---|---|
| 4-A | `ispRecommendationTypes.ts` | 型定義（5レベル + evidence + summary） |
| 4-A | `ispRecommendationUtils.ts` | 判定ロジック（pure function） |
| 4-A | `ispRecommendationUtils.spec.ts` | テスト（37テスト） |
| 4-A | `monitoringDailyAnalytics.ts` | `DailyMonitoringSummary.ispRecommendations` 統合 |
| 4-B | `IspRecommendationCard.tsx` | 提案表示 UI + 判断操作 UI |
| 4-B | `MonitoringDailyDashboard.tsx` | ダッシュボード統合 |
| 4-B | `useMonitoringDailyAnalytics.ts` | hook に goalNames 伝播 |
| 4-C | `ispRecommendationDecisionTypes.ts` | 判断記録の型定義 |
| 4-C | `ispRecommendationDecisionUtils.ts` | 判断記録の pure function |
| 4-C | `ispRecommendationDecisionUtils.spec.ts` | テスト（19テスト） |
| 4-C | `IspRecommendationCard.tsx` | 判断操作 UI（採用/保留/見送り + メモ） |
| 4-C | `IspDecisionRepository.ts` | Repository インターフェース |
| 4-C | `InMemoryIspDecisionRepository.ts` | InMemory 実装（テスト / fallback） |
| 4-C | `SharePointIspDecisionRepository.ts` | SharePoint 実装（本番永続化） |
| 4-C | `createIspDecisionRepository.ts` | Repository ファクトリ |
| 4-C | `useIspRecommendationDecisions.ts` | 判断記録 Hook（取得 / 保存 / 状態管理） |

**表示フロー**: 目標進捗 → ISP見直し提案（判断操作付き） → 昼食傾向 → 所見ドラフト

### 5.3 アラート体系

| レイヤー | アラート | トリガー |
|---|---|---|
| L1 ISP | 🟡 見直し30日前 | `nextReviewDueAt - 30days` |
| L1 ISP | 🟠 見直し期限 | `nextReviewDueAt` |
| L1 ISP | 🔴 見直し超過 | `nextReviewDueAt < today` |
| L2 モニタリング | 🟡 モニタリング30日前 | `nextMonitoringDate - 30days` |
| L2 モニタリング | 🟠 モニタリング期限 | `nextMonitoringDate` |
| L2 モニタリング | 🔴 モニタリング超過 | `nextMonitoringDate < today` |
| L2 再評価 | 🔴 行動トリガー発火 | `ReassessmentTrigger: incident` |

---

## 6. ISP 初回3か月ルール（今後対応）

制度上、初回の ISP モニタリングは **3か月以内** に実施する運用指針がある。

### 設計案

```typescript
// ispReviewControlSchema に追加
isFirstReview: z.boolean().default(true),

// 見直し周期の解決ロジック
function resolveReviewCycleDays(control: IspReviewControl): number {
  if (control.isFirstReview) return 90;  // 初回: 3か月
  return control.reviewCycleDays;        // 以降: 6か月（180日）
}
```

初回モニタリング完了時に `isFirstReview` を `false` に更新する。

---

## 7. 監査対応メモ

この2層構造は以下の監査項目に対応する。

| 監査項目 | 対応レイヤー | 証跡 |
|---|---|---|
| 個別支援計画の定期見直し | L1 | ISP `reviewControl.lastReviewedAt` |
| モニタリングの定期実施 | L2 | PlanningSheet `monitoringCycleDays` + 実施記録 |
| 計画変更の根拠記録 | L1 ← L2 | MonitoringResult → ISP Review |
| 支援手順の実施記録 | L3 | ProcedureRecord |
| 再評価の実施記録 | L2 | PlanningSheetReassessment |

---

*最終更新: 2026-03-15*
*関連: [ISP三層モデル](isp-three-layer-model.md) | [再評価ドメイン](../../src/domain/isp/planningSheetReassessment.ts)*

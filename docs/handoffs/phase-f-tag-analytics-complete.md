# Phase F 完走サマリー: Tag Analytics Decision Support

> **行動タグ分析の意思決定支援化 完了**
> 2026-03-19 / Session: e9ee2547

---

## 目的

日次記録の行動タグ（behaviorTags）を、記録データから意思決定データに昇格させる。

```
記録する → 見返せる → 傾向が分かる → 気づける → 行動につながる
```

## フェーズごとの価値

| Phase | テーマ | 価値 | PR |
|-------|--------|------|-----|
| F1 | 見える化 | タグ頻度・時間帯分布・トレンドを可視化 | merged (前回) |
| F1深化 | 使える化 | PlanningSheetPage に Accordion 統合 | #1099 merged |
| F1.5 | 比較できる化 | 期間プリセット切替 (7d/30d/90d) | #1100 |
| F2 | 気づける化 | spike/drop/new の自動検知 | #1101 |
| F2.5 | 信頼して見続けられる | ノイズ制御 (maxAlerts/maxPerType/minNewCount) | #1102 |
| F3 | 行動につながる化 | Planning 示唆生成（根拠文 + 示唆文） | #1103 |

## マージ推奨順

```
#1100 → #1101 → #1102 → #1103
```

依存関係とレビュー負荷の両面で、この順が最もクリーン。

## 主要ファイル構成

```
src/features/tag-analytics/
├── domain/
│   ├── tagAnalytics.ts            ← F1: counts/trend/timeSlots + F1.5: presets
│   ├── tagTrendAlerts.ts          ← F2+F2.5: spike/drop/new 検知 + ノイズ制御
│   ├── planningSuggestions.ts     ← F3: 根拠文 + 示唆文生成
│   └── __tests__/
│       ├── tagAnalytics.spec.ts        (38 tests)
│       ├── tagTrendAlerts.spec.ts      (31 tests)
│       └── planningSuggestions.spec.ts  (17 tests)
├── hooks/
│   └── useTagAnalytics.ts         ← 4状態契約 + trendAlerts 統合
├── components/
│   ├── TagAnalyticsSection.tsx    ← メイン表示 + period + alerts + suggestions
│   ├── TrendAlertsBanner.tsx      ← F2: アラートUI
│   └── PlanningSuggestionsCard.tsx ← F3: 示唆UI
└── index.ts                       ← バレル（F1〜F3 全エクスポート）
```

## 設計原則

### pure domain → hook → UI の分離

- **domain**: 全ロジックを pure function で実装。副作用なし。
- **hook**: `useTagAnalytics` が4状態契約 (loading/ready/empty/error) で管理。
- **UI**: domain の出力をそのまま描画。判断ロジックを持たない。

### ノイズ制御は domain で

アラートの出すぎ問題を UI ではなく domain で解決。
`maxAlerts=5`, `maxPerType=3`, `minNewCount=2` で信頼性を確保。

### 示唆は自動入力しない

F3 の示唆は「検討してください」トーンに留め、
支援計画への反映は担当者の判断に委ねる設計。

## 検知ルール

| タイプ | 条件 | 重要度 |
|--------|------|--------|
| spike | 日次平均が baseline の 2.0 倍以上 | ⚠️ warning |
| drop | baseline ≥ 2件 かつ current = 0件 | ℹ️ info |
| new | baseline = 0件 かつ current ≥ 2件 | ℹ️ info |

## テスト推移

```
F1  :  33
F1.5:  38  (+5  presetToDateRange)
F2  :  60  (+22 detectTagTrends)
F2.5:  69  (+9  ノイズ制御)
F3  :  86  (+17 示唆生成)
全体: 137  (domain 86 + page 51)
```

## 統合ポイント

| ページ | 表示 | showSuggestions |
|--------|------|-----------------|
| UserDetailPage | タグ分析セクション + 期間切替 + アラート | false |
| SupportPlanningSheetPage | Accordion 内 + 期間切替 + アラート + **示唆** | **true** |

## バグ修正

- `toISOString()` による UTC ズレ問題を `formatLocalDate()` で修正（F1.5）

## 次の拡張候補

### 短期（磨き込み）

- Planning 側での導線強化（示唆からの直接ナビゲーション）
- アラート根拠の説明改善（日次平均の数値明示）
- 実データ運用での閾値調整

### 中期（機能拡張）

- タグごとの詳細ドリルダウン
- カスタム期間指定（日付ピッカー）
- タグ間の相関分析

### 長期（AI連携）

- AI要約による自動示唆改善
- 予測モデルによる早期アラート
- 支援計画テンプレートの自動提案

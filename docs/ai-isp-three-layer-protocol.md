# AI開発エージェント向け: ISP三層モデル設計プロトコル

> **ADR-005 準拠** — [ADR-005](./adr/ADR-005-isp-three-layer-separation.md) で Accepted された設計原則

このドキュメントは、本プロジェクトの AI 開発エージェント（Copilot, Cursor, Gemini, Claude 等）が ISP 関連機能を提案・設計・実装する際に 必ず 従うべき設計プロトコルです。

---

## 最重要原則

個別支援計画（ISP）と支援計画シート等は、制度上・運用上の役割が異なる **別文書** です。
同一文書として統合してはいけません。
ただし、相互参照できる設計は **必須** です。

---

## 定義

### 1. ISP（個別支援計画）— 第1層
- 法定の中核文書
- 本人の意向、総合的支援方針、課題、目標、達成時期、留意事項等を定める上位計画
- 同意、交付、モニタリング、見直しの運用が必要
- **既存コード**: `supportPlanFields.ts`, `ispGoalMapper.ts`, ISP Editor

### 2. 支援計画シート等 — 第2層 + 第3層
- 支援計画シート + 支援手順書兼記録用紙 を指す
- 行動特性や場面ごとの支援方法を、工程別・手順別に具体化する実装文書
- 実施記録を蓄積し、再アセスメントと支援更新につなげる
- **既存コード**: `ibdTypes.ts` → `SupportPlanSheet`, `SupportProcedureManual`, `SupportScene`

---

## 概念モデル

### 第1層: ISP

```
ISP
├── 本人・家族の意向
├── 総合的支援方針
├── QOL向上課題
├── 長期目標・短期目標
├── 達成時期
├── 留意事項
├── 作成日 / 同意日
├── 交付記録
├── モニタリング結果
└── 見直し日
```

### 第2層: 支援計画シート

```
支援計画シート (SupportPlanSheet)
├── 行動観察 → icebergModel.observableBehaviors
├── 情報収集 → icebergModel.underlyingFactors
├── 分析・理解・仮説 → icebergModel
├── 支援課題 → positiveConditions
├── 対応方針 → icebergModel.environmentalAdjustments
├── 環境調整 → icebergModel.environmentalAdjustments
├── 関わり方の具体策 → SupportProcedureStep
├── 作成者 / 作成日
├── 版番号 (version)
└── 見直し日 (nextReviewDueDate)
```

### 第3層: 支援手順書兼記録

```
支援手順書兼記録 (SupportProcedureManual + 実施記録)
├── 時間帯
├── 活動 (SupportScene)
├── 支援手順 (SupportProcedureStep)
├── 実施チェック → ProcedureExecutionRecord
├── 利用者の様子
├── 特記事項
├── 連絡事項
├── 実施者
└── 実施日時
```

---

## 設計上の必須原則

| # | 原則 | 既存実装参照 |
|---|---|---|
| 1 | ISP と支援計画シートを統合しない | `ISPReference` で参照リンク |
| 2 | ISP は「目的・目標・方針」の管理対象 | `ispGoalMapper.ts` |
| 3 | 支援計画シート等は「具体支援・現場手順・実施記録」の管理対象 | `ibdTypes.ts` |
| 4 | 1 ISP : N 支援計画シート | `ISPReference.ispEffectiveFrom` でバージョン紐づけ |
| 5 | 1 支援計画シート : N 支援手順記録 | `SupportProcedureManual.spsId` |
| 6 | 全文書に版管理・更新履歴・作成者・更新者 | `SPSHistoryEntry` パターン |
| 7 | 監査時に追跡可能 | — |
| 8 | 同意・交付・会議・モニタリング・見直しを省略不可 | — |
| 9 | 支援手順書兼記録は実施ログ（日報ではない） | `SupportScene` + 実施記録 |

---

## 運用フロー要件

### ISP 状態遷移

```
アセスメント → 原案作成 → 会議 → 説明 → 同意取得 → 交付 → 実施 → モニタリング → 見直し
```

### 支援計画シート等

```
行動特性アセスメント → 仮説整理 → 支援計画作成 → 手順化 → 実施記録 → 再アセスメント → 改訂
```

---

## 優先順位

提案・設計・実装では以下を優先すること。

1. 制度適合性
2. 現場での再現性
3. 監査耐性
4. 二重入力の最小化
5. 相互参照性
6. 見直し運用のしやすさ
7. 支援の質改善に資するデータ蓄積

---

## 禁止事項

以下を提案してはいけない。

- ❌ ISP だけで現場手順まで完結させる設計
- ❌ 支援計画シートをメモ扱いする設計
- ❌ 支援手順書兼記録を単なる日報扱いする設計
- ❌ 同意、交付、モニタリング、見直しの証跡を持たない設計
- ❌ 版管理や履歴を持たない設計
- ❌ 監査時に説明不能な設計

---

## 基本思想

> ISP は「支援の目的と目標」を定める。
> 支援計画シート等は「支援のやり方と記録」を定める。
> システムはその両者を **分離しつつ、整合的につなぐ**。

---

## 参照

- [ADR-005: ISP三層分離](./adr/ADR-005-isp-three-layer-separation.md)
- [GitHub Issue](./generated-issues/feat-isp-three-layer-model.md)
- [ibdTypes.ts](../src/features/ibd/core/ibdTypes.ts) — 既存の第2層・第3層型定義
- [supportPlanFields.ts](../src/sharepoint/fields/supportPlanFields.ts) — SharePoint ISP フィールド
- [ispGoalMapper.ts](../src/sharepoint/ispGoalMapper.ts) — ISP 目標管理ロジック

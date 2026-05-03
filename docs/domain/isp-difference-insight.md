# ISP Difference Insight (氷山分析差分検知) 仕様

> [!NOTE]
> **SSOT (Single Source of Truth)**: 判定ロジックの実装正定義は `src/domain/isp/differenceInsight.ts` を参照してください。

氷山分析（Iceberg Analysis）の結果と、現在の個別支援計画シート（Support Planning Sheet）の整合性を検証し、未反映のインサイトを自動検知する仕組みについて。

## 1. 目的
PDCAサイクルの「分析(A) → 計画(P)」の接続を強化する。
現場職員が氷山分析で導き出した「新しい行動」や「新しい仮説要因」が、支援計画に反映されずに形骸化することを防ぐためのガードレールとして機能する。

## 2. 判定ロジック
差分検知は、以下の2つのステップで行われる。

### ステップ1: Iceberg Snapshot の要約 (`summarizeIcebergSnapshot`)
複雑なグラフ構造から、比較に必要な重要情報を抽出する。
- **主要対象行動**: `behavior` ノードのうち、最も更新日時が新しいものを採用。
- **主要な要因**: `confidence` (信頼度) が高いリンクを優先し、その接続元（source）ノードを要因として採用。

### ステップ2: 計画書との比較 (`calculateDifferenceInsight`)
抽出された要約と、現在の計画書の各フィールドを照合する。

| 照合項目 | 比較対象 (Planning Sheet) | 検知条件 | 重要度 |
| :--- | :--- | :--- | :--- |
| **行動** | `assessment.targetBehaviors` | 計画のターゲット行動一覧に含まれていない場合 | **High** |
| **要因** | `assessment.hypotheses` | 計画の仮説（要因/機能）一覧に含まれていない場合 | **Medium** |

## 3. UI への統合
本ロジックは以下の画面で共通利用されている。

- **支援計画一覧 (`PlanningSheetListPage`)**
    - `DifferenceInsightBadge` として表示。
    - 複数の計画シートがある中で、どの利用者に「要見直し」のインサイトがあるかを一覧で把握可能。
- **支援計画詳細 (`SupportPlanningSheetPage`)**
    - `DifferenceInsightBar` および `IcebergSummaryBar` として表示。
    - 編集時に「氷山分析ではこう出ていますが、計画に反映しますか？」という気づきを与える。

## 4. 関連ファイル
- `src/domain/isp/differenceInsight.ts`: 判定ロジック本体（純粋関数）
- `src/domain/isp/schema/ispViewTypes.ts`: インサイト・要約の型定義
- `src/domain/isp/__tests__/differenceInsight.spec.ts`: 仕様を保証するテストコード

---
*このドキュメントは PR #1768 での集約化に伴い作成された（2026-05-03）。*

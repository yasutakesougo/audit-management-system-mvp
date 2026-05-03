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

## 5. UI 表示方針

差分検知結果は、ユーザーに「現状の計画と分析の乖離」を気づかせるためのガードレールとして表示される。現時点では自動反映機能は持たず、ユーザーによる「確認」と「手動での見直し」を促す。

### 表示メッセージ
- **High 差分 (行動)**: 「氷山分析で見つかった行動が支援計画に未反映」であることを示す。
    - 表示例: `[行動] 追加: 自傷行為`
- **Medium 差分 (要因)**: 「背景要因・仮説が支援計画に未反映」であることを示す。
    - 表示例: `[要因] 要検討: 睡眠不足`

### 画面別導線
- **支援計画一覧 (`PlanningSheetListPage`)**
    - 目的: 複数の利用者・計画の中から、優先的に見直すべき対象を特定する。
    - 導線: バーが表示されている計画を選択し、詳細画面へ進む。
- **支援計画詳細 (`SupportPlanningSheetPage`)**
    - 目的: 現在の計画編集・参照時に、最新の分析結果との乖離を意識させる。
    - 導線: 表示内容を元に、アセスメントや支援手順の修正を検討する。

---
*このドキュメントは PR #1768 および #1772 での UI 契約固定に伴い更新された。*

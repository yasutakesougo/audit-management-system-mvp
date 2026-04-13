# 残存 Path-A Read 導線 棚卸しレポート

作成日: 2026-04-13
ステータス: 分析ダッシュボード移行前

## 1. 概要
ABC記録（行動記録）の「Path-B 正本化」プロジェクトにおいて、主要な判定・提案ロジック（アラート、戦略初期値、是正提案）の B 移行は完了した。
現在 Path-A（旧 `BehaviorRepository`）を直接読み取っている箇所は、主に「過去の履歴表示」と「集計レポート」に限定されている。

## 2. 残存読取導線一覧

| 画面/機能 | 呼出元ファイル | 取得メソッド | 備考 |
|---|---|---|---|
| **行動分析ダッシュボード** | `src/pages/AnalysisDashboardPage.tsx` | `useBehaviorStore.fetchForAnalysis` | 過去30, 60, 90日の全件取得。分析の主導線。 |
| **日次画面 履歴バー** | `src/features/daily/hooks/useTimeBasedSupportPage.ts` | `useBehaviorStore.fetchByUser` | 入力画面横に表示される「直近5件」の履歴。 |
| **デモデータ生成** | `src/pages/AnalysisDashboardPage.tsx` | `seedDemoBehaviors` | 開発/デモ用のダミーデータ注入。InMemoryRepo を操作。 |

## 3. 移行プラン

### Step 1: `AnalysisDashboard` の Path-B 移行
- `behaviorStore` の `fetchForAnalysis` 実装を、`repo.listByUser` ではなく `ibdStore.getABCRecordsForUser` を使用するように変更する。
- ソートと期間フィルタリングをメモリ内で行う（`action-engine` と同様のパターン）。

### Step 2: `fetchByUser` (Recent 5) の Path-B 移行
- 日次入力画面の履歴表示も Path-B 基準に寄せる。
- これにより、同一画面内での「書き込みは A+B、読み取りは B」という不整合防止構造が完成する。

### Step 3: `BehaviorRepository` Read-Port の廃止
- すべての読取が B に移行した後、`getBehaviorRepository()` から read 系のメソッド呼出を除去し、定義をシンプルにする。

## 4. 判定ロジックへの影響
- `AnalysisDashboard` は `useBehaviorAnalytics` という純粋な集計ロジックを使用している。
- データ取得元を B に変えても、渡される `ABCRecord[]` の型と構造は同一（A→B同期済み）であるため、グラフや集計値の計算ロジックに影響はない。

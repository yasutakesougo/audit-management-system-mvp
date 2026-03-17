# P6-A3: Planner Assist 計測ダッシュボード可視化 (v1)

## 概要
Planner Assist の利用状況を可視化する管理者向けダッシュボード（v1）を実装する。
P6-A で実装済みの `computePlannerAssistMetrics()` を活用し、「Planner Assist が実際に効いているのか」を測るための管理画面を提供する。

本実装は可視化 UI コンポーネントの構築にフォーカスし、本番の Analytics 保存先との接続は行わず、インメモリやモックデータでの表示検証を目的とする。

## 前提条件
- P4, P5, P6-A の基盤（権限制御・UI集約・計測 emit 接続）がマージ済みのブランチで作業すること。
- 表示ルールとして以下を適用する。
  - サンプル数不足は `insufficient` バッジで明示する
  - パーセンテージは少数第1位（例: `42.1%`）で丸める
  - Latency（到達時間）は秒（s）表示で統一し、小数第2位まで（例: `1.23s`）

## 実装要件 (可視化 4つのカード)

1. **初回遷移先 (First Navigation)**
   - 項目: `Monitoring`, `Planning`, `Assessment`, `Other`
   - 表示形式: 横棒グラフか、シンプルなプログレスバーによるパーセンテージ表示

2. **アクション押下率 (Action Click Rate)**
   - 項目: セッションあたり平均クリック数、カテゴリ別のクリック比率
   - 表示形式: カテゴリ別の棒グラフなど直感的に「何が押されているか」分かるもの

3. **到達時間 (Navigation Latency)**
   - 項目: Median (中央値), Mean (平均値), p90
   - 表示形式: 秒表示の数値強調パネル（例: `1.23s`）

4. **提案採用率変化 (Adoption Uplift)**
   - 項目: Before, After, Uplift (ポイント差), Insufficient ガード判定
   - 表示形式:
     - 採用率と変化量 (Uplift) を数値で表示（グラフ表示は不要）
     - サンプル数（`afterRate` 計算時点での総数）が規定（MIN_UPLIFT_SAMPLES=3）未満の場合は、「データ不足 (Insufficient)」バッジを明示的に表示し、Uplift をグレーアウトなどの処理にする

## 追加する主要ファイルとコンポーネント

- `src/features/support-plan-guide/components/planner-assist/PlannerAssistDashboard.tsx` (新規)
  - 4つのカードをグリッドレイアウトで配置するダッシュボード本体。
- 各カード用の Presentation コンポーネント (ダッシュボード内に同梱、または別ファイル)
  - `FirstNavigationCard`
  - `ActionClickRateCard`
  - `NavigationLatencyCard`
  - `AdoptionUpliftCard`

## 完了の定義 (DoD)
- [ ] 管理者向けにダッシュボードが表示されること
- [ ] 各指標カードに指定の表示要件通りに数値・グラフが描画されること (モックデータ利用)
- [ ] 既存の `[domain/plannerAssistMetrics.ts]` の出力結果をダッシュボードコンポーネントが正しく解釈し、表示できること
- [ ] `insufficient: true` の場合に「データ不足」の表示が行われること (表示ルールの順守)
- [ ] 既存のテストを通しつつ、新規ダッシュボードコンポーネントの表示テスト（モックデータのレンダリングなど）が追加されていること
- [ ] エラーおよび型チェック (TypeScript) が全て通ること

# ExceptionCenter Priority Week-1 Review

ExceptionCenter の priority 導入直後 1 週間だけ実施する運用計測 runbook。

## 目的

- Top3 が実際に使われているかを確認する
- deep link が遷移先まで到達しているかを確認する
- CTA 後に dismiss/snooze まで進む速度を確認する

## 対象データ

- Firestore `telemetry`
- `type == "suggestion_lifecycle_event"`
- `sourceScreen == "exception-center"`
- 直近 7 日（固定）

## 利用イベント

- `suggestion_shown`（Top3 は `ctaSurface == "priority-top3"`）
- `suggestion_cta_clicked`（`ctaSurface: "table" | "priority-top3"`）
- `suggestion_deep_link_arrived`
- `suggestion_dismissed`
- `suggestion_snoozed`

## 指標定義

1. Top3 クリック率
   - 分子: `suggestion_cta_clicked` かつ `ctaSurface == "priority-top3"`
   - 分母: `suggestion_shown` かつ `ctaSurface == "priority-top3"`
   - 式: `top3Clicked / top3Shown`

2. deep link 到達率
   - 分子: `suggestion_deep_link_arrived`
   - 分母: `suggestion_cta_clicked`
   - 式: `arrived / clicked`

3. dismiss/snooze 完了までの時間（分）
   - 単位: `stableId`
   - 開始: 最初の `suggestion_cta_clicked`
   - 終了: 最初の `suggestion_dismissed` または `suggestion_snoozed`
   - 集計: p50 / p90（週次）

## 手順（週次 15 分）

1. Firestore Console で `telemetry` を開く。
2. `type == "suggestion_lifecycle_event"` かつ `sourceScreen == "exception-center"` で 7 日に絞る。
3. 上記 3 指標を集計する。
4. 週次ノートに `top3Clicked/top3Shown`, `arrived/clicked`, `p50/p90` を記録する。
5. 1 週間終了時に重み調整要否を判定する（調整は 1 回のみ）。

## 2026-04-01 集計クエリ雛形

レビュー日 `2026-04-01` の Week1 窓は以下で固定する。

- JST: `2026-03-25 00:00:00` 〜 `2026-03-31 23:59:59`
- UTC: `2026-03-24 15:00:00` 〜 `2026-03-31 14:59:59`

### 1) Firestore Console 条件テンプレ

`telemetry` コレクションで以下を共通条件にする。

- `type == "suggestion_lifecycle_event"`
- `sourceScreen == "exception-center"`
- `ts >= 2026-03-24T15:00:00Z`
- `ts <= 2026-03-31T14:59:59Z`

個別指標の追加条件:

- Top3 shown: `event == "suggestion_shown"` and `ctaSurface == "priority-top3"`
- Top3 click: `event == "suggestion_cta_clicked"` and `ctaSurface == "priority-top3"`
- table click: `event == "suggestion_cta_clicked"` and `ctaSurface == "table"`
- deep link arrived: `event == "suggestion_deep_link_arrived"`
- completion: `event in ["suggestion_dismissed", "suggestion_snoozed"]`

### 2) SQL 雛形（BigQuery / 取り込み後分析）

`project.dataset.telemetry` は実環境に置き換える。

```sql
-- Week1 base events (2026-03-25..2026-03-31 JST)
WITH base AS (
  SELECT
    ts,
    event,
    stableId,
    ruleId,
    priority,
    sourceScreen,
    ctaSurface
  FROM `project.dataset.telemetry`
  WHERE type = 'suggestion_lifecycle_event'
    AND sourceScreen = 'exception-center'
    AND ts >= TIMESTAMP('2026-03-24 15:00:00+00')
    AND ts <= TIMESTAMP('2026-03-31 14:59:59+00')
)
SELECT
  COUNTIF(event = 'suggestion_shown' AND ctaSurface = 'priority-top3') AS top3_shown,
  COUNTIF(event = 'suggestion_cta_clicked' AND ctaSurface = 'priority-top3') AS top3_click,
  COUNTIF(event = 'suggestion_cta_clicked' AND ctaSurface = 'table') AS table_click,
  COUNTIF(event = 'suggestion_deep_link_arrived') AS arrived,
  COUNTIF(event IN ('suggestion_dismissed', 'suggestion_snoozed')) AS completion
FROM base;
```

```sql
-- KPI rates
WITH agg AS (
  SELECT
    COUNTIF(event = 'suggestion_shown' AND ctaSurface = 'priority-top3') AS top3_shown,
    COUNTIF(event = 'suggestion_cta_clicked' AND ctaSurface = 'priority-top3') AS top3_click,
    COUNTIF(event = 'suggestion_cta_clicked') AS total_click,
    COUNTIF(event = 'suggestion_deep_link_arrived') AS arrived,
    COUNTIF(event IN ('suggestion_dismissed', 'suggestion_snoozed')) AS completion
  FROM `project.dataset.telemetry`
  WHERE type = 'suggestion_lifecycle_event'
    AND sourceScreen = 'exception-center'
    AND ts >= TIMESTAMP('2026-03-24 15:00:00+00')
    AND ts <= TIMESTAMP('2026-03-31 14:59:59+00')
)
SELECT
  SAFE_DIVIDE(top3_click, top3_shown) AS top3_ctr,
  SAFE_DIVIDE(arrived, total_click) AS deep_link_arrival_rate,
  SAFE_DIVIDE(completion, arrived) AS completion_rate_from_arrival
FROM agg;
```

```sql
-- dismiss/snooze 完了までの時間（分）: p50 / p90
WITH base AS (
  SELECT
    ts,
    event,
    stableId
  FROM `project.dataset.telemetry`
  WHERE type = 'suggestion_lifecycle_event'
    AND sourceScreen = 'exception-center'
    AND ts >= TIMESTAMP('2026-03-24 15:00:00+00')
    AND ts <= TIMESTAMP('2026-03-31 14:59:59+00')
),
first_click AS (
  SELECT stableId, MIN(ts) AS click_ts
  FROM base
  WHERE event = 'suggestion_cta_clicked'
  GROUP BY stableId
),
first_completion AS (
  SELECT stableId, MIN(ts) AS done_ts
  FROM base
  WHERE event IN ('suggestion_dismissed', 'suggestion_snoozed')
  GROUP BY stableId
),
durations AS (
  SELECT
    c.stableId,
    TIMESTAMP_DIFF(d.done_ts, c.click_ts, MINUTE) AS minutes_to_done
  FROM first_click c
  JOIN first_completion d USING (stableId)
  WHERE d.done_ts >= c.click_ts
)
SELECT
  COUNT(*) AS paired_count,
  APPROX_QUANTILES(minutes_to_done, 100)[OFFSET(50)] AS p50_minutes,
  APPROX_QUANTILES(minutes_to_done, 100)[OFFSET(90)] AS p90_minutes
FROM durations;
```

```sql
-- table vs Top3 比較（CTR）
WITH surface AS (
  SELECT
    ctaSurface,
    COUNTIF(event = 'suggestion_shown') AS shown,
    COUNTIF(event = 'suggestion_cta_clicked') AS clicked
  FROM `project.dataset.telemetry`
  WHERE type = 'suggestion_lifecycle_event'
    AND sourceScreen = 'exception-center'
    AND ts >= TIMESTAMP('2026-03-24 15:00:00+00')
    AND ts <= TIMESTAMP('2026-03-31 14:59:59+00')
    AND ctaSurface IN ('table', 'priority-top3')
  GROUP BY ctaSurface
)
SELECT
  ctaSurface,
  shown,
  clicked,
  SAFE_DIVIDE(clicked, shown) AS ctr
FROM surface
ORDER BY ctaSurface;
```

### 3) 2026-04-01 週次レビュー記録テンプレ

- `top3_shown`:
- `top3_click`:
- `top3_ctr`:
- `table_click`:
- `arrived`:
- `deep_link_arrival_rate`:
- `completion_rate_from_arrival`:
- `p50_minutes`:
- `p90_minutes`:

判定メモ:

- CTR 低 / 到達率 高: priority 重み見直し候補
- CTR 高 / 到達率 低: CTA または deep link 整合を優先調査
- 到達率 高 / 完了率 低: 遷移先画面の導線・運用フロー改善を優先

## 判定基準（初期値）

- Top3 クリック率 < 15%: Top3 文言/並び見直し候補
- deep link 到達率 < 90%: 導線不整合を調査
- 完了時間 p50 > 60 分: 優先度重み見直し候補

## 更新ルール

- 閾値や指標を変えたら本 runbook を同時更新する。
- 重み調整 PR にはこの runbook の集計結果を必ず添付する。

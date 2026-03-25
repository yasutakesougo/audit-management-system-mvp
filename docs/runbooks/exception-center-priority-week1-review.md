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

## 判定基準（初期値）

- Top3 クリック率 < 15%: Top3 文言/並び見直し候補
- deep link 到達率 < 90%: 導線不整合を調査
- 完了時間 p50 > 60 分: 優先度重み見直し候補

## 更新ルール

- 閾値や指標を変えたら本 runbook を同時更新する。
- 重み調整 PR にはこの runbook の集計結果を必ず添付する。


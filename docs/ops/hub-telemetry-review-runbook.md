# Hub Telemetry Review Runbook (7 Hub)

- 作成日: 2026-03-28
- 対象: `/today /records /planning /operations /billing /master /platform`
- 目的: ハブカードの並び順を「感覚」ではなく実測で更新する

## 0. 前提

- データソース: Firestore `telemetry` コレクション
- イベント種別: `type = 'hub_entry_telemetry'`
- 見る期間: 直近 14 日（最低 7 日）
- 集計粒度: `hubId` / `entryId` / `role` / `section` / `position`

## 1. 収集イベント（実装名）

実装ファイル: `src/app/hubs/hubTelemetry.ts`

| Runbook名 | 実イベント名 (`event`) | 主な用途 |
| --- | --- | --- |
| hub viewed | `hub_viewed` | ハブ表示回数（分母） |
| card viewed | `hub_card_viewed` | カード表示回数（分母） |
| card clicked | `hub_card_clicked` | 導線クリック回数（分子） |
| help link clicked | `hub_help_link_clicked` | 説明導線の迷い指標 |
| empty state cta clicked | `hub_empty_state_cta_clicked` | 空状態からの救済導線利用 |

必須フィールド:

- `hubId`
- `entryId`（hub単位イベントは省略可）
- `role`
- `section`（`primary / secondary / comingSoon / emptyState / hub`）
- `position`（1始まり）
- `telemetryName`

## 2. KPI定義（固定）

### 2-1. Hub CTR（入口全体）

`hub viewed -> card clicked` の率。

`hub_card_clicked / hub_viewed`

### 2-2. Card CTR（カード単位）

`card viewed -> card clicked` の率。

`hub_card_clicked / hub_card_viewed`

### 2-3. Help偏り

`help link clicked` の偏りを見る。

- `hub_help_link_clicked / hub_viewed`
- `hub_help_link_clicked / hub_card_viewed`（カード単位）

### 2-4. Role差分

`role` ごとにクリック上位カードを比較する。

- 各 `role` の `hub_card_clicked` 上位3件
- `role` 間で順位差が大きいカードを抽出

## 3. 集計クエリ例（BigQuery想定）

### 3-1. Hub CTR（hub × role）

```sql
WITH base AS (
  SELECT
    hubId,
    role,
    event,
    DATE(clientTs) AS d
  FROM telemetry.events
  WHERE type = 'hub_entry_telemetry'
    AND DATE(clientTs) BETWEEN @start AND @end
)
SELECT
  hubId,
  role,
  COUNTIF(event = 'hub_card_clicked') AS card_clicks,
  COUNTIF(event = 'hub_viewed') AS hub_views,
  SAFE_DIVIDE(
    COUNTIF(event = 'hub_card_clicked'),
    COUNTIF(event = 'hub_viewed')
  ) AS hub_ctr
FROM base
GROUP BY hubId, role
ORDER BY hubId, role;
```

### 3-2. Card CTR（hub × entry × role）

```sql
WITH base AS (
  SELECT
    hubId,
    entryId,
    role,
    event
  FROM telemetry.events
  WHERE type = 'hub_entry_telemetry'
    AND DATE(clientTs) BETWEEN @start AND @end
)
SELECT
  hubId,
  entryId,
  role,
  COUNTIF(event = 'hub_card_viewed') AS card_views,
  COUNTIF(event = 'hub_card_clicked') AS card_clicks,
  SAFE_DIVIDE(
    COUNTIF(event = 'hub_card_clicked'),
    COUNTIF(event = 'hub_card_viewed')
  ) AS card_ctr
FROM base
WHERE entryId IS NOT NULL
GROUP BY hubId, entryId, role
ORDER BY hubId, role, card_ctr DESC;
```

### 3-3. Help偏り（hub × role）

```sql
WITH base AS (
  SELECT
    hubId,
    role,
    event
  FROM telemetry.events
  WHERE type = 'hub_entry_telemetry'
    AND DATE(clientTs) BETWEEN @start AND @end
)
SELECT
  hubId,
  role,
  COUNTIF(event = 'hub_help_link_clicked') AS help_clicks,
  COUNTIF(event = 'hub_viewed') AS hub_views,
  SAFE_DIVIDE(
    COUNTIF(event = 'hub_help_link_clicked'),
    COUNTIF(event = 'hub_viewed')
  ) AS help_rate_per_hub_view
FROM base
GROUP BY hubId, role
ORDER BY help_rate_per_hub_view DESC;
```

### 3-4. Role別クリック上位

```sql
SELECT
  role,
  hubId,
  entryId,
  COUNT(*) AS clicks
FROM telemetry.events
WHERE type = 'hub_entry_telemetry'
  AND event = 'hub_card_clicked'
  AND DATE(clientTs) BETWEEN @start AND @end
GROUP BY role, hubId, entryId
QUALIFY ROW_NUMBER() OVER (
  PARTITION BY role, hubId
  ORDER BY clicks DESC
) <= 3;
```

## 4. 重み更新ルール（初期）

`hubDefinitions` の `kpiWeight / usagePriority / rolePriority` は次の順で判断する。

1. `card_ctr` が継続的に高いカードは上位化候補
2. `help_rate` が高いカードは説明不足候補（順序変更より先に文言/ヘルプ確認）
3. role差分が大きいカードは `rolePriority` 調整候補
4. 変更は hub ごとに小さく（1回で2カードまで）実施

## 5. レビュー手順（20分）

1. 直近14日の `hub_entry_telemetry` を抽出
2. 4指標（Hub CTR / Card CTR / Help偏り / Role差分）を確認
3. 変更候補を `hubDefinitions` に反映
4. unit + smoke を実行して入口契約を確認
5. PR本文に「変更理由（どの指標で変更したか）」を記録

## 6. 注意点

- いまは完了寄与イベントを直接持っていないため、まずは入口行動最適化を優先する
- role は `viewer / staff / reception / admin` の運用ロールをそのまま送る
- `HubLanding` にソートロジックを戻さない（辞書解決を維持する）


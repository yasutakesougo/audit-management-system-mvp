# /today Telemetry Baseline Runbook (PR-5)

- 作成日: 2026-03-26
- 対象: `/today` キオスク運用の初期ベースライン取得
- 目的: 改善を「感覚」ではなく「数値」で判断できる状態にする

## 0. 前提

- 期間: 7日間（最低3日）
- 粒度: 日次 + 全体集計
- 対象: `/today` 利用セッション

## 1. 収集イベント（実装名）

`type = 'kiosk_ux_event'` のうち、以下を収集する。

| Runbook名 | 実イベント名 (`event`) | 主な用途 |
| --- | --- | --- |
| `kiosk_session_start` | `ux_kiosk_session_started` | kiosk利用率 |
| `kiosk_visible_refetch` | `ux_visible_refresh_completed` | visible復帰後遅延 |
| `quick_record_start` | `ux_quick_record_started` | QuickRecord所要時間/離脱率の分母 |
| `quick_record_save` | `ux_quick_record_save_completed` | QuickRecord所要時間 |
| `quick_record_abandon` | `ux_quick_record_abandoned` | 保存前離脱率 |

必須フィールド:

- `ts` / `clientTs`（時刻）
- `sessionId`
- `role`（`staff` / `admin` / `unknown`）
- `userId`（QuickRecord系）

## 2. KPI定義（固定）

### 2-1. kiosk利用率

`kiosk_sessions / total_today_sessions`

補足:

- `kiosk_sessions = COUNT(event='ux_kiosk_session_started')`
- `total_today_sessions` は landing 系イベント（例: `/today` 着地イベント）を利用

### 2-2. visible復帰遅延

`p50 / p90 of durationMs where event='ux_visible_refresh_completed'`

### 2-3. QuickRecord時間

`p50 / p90 of durationMs where event='ux_quick_record_save_completed'`

### 2-4. 保存前離脱率

`quick_record_abandon / quick_record_start`

補足:

- `quick_record_abandon = COUNT(event='ux_quick_record_abandoned')`
- `quick_record_start = COUNT(event='ux_quick_record_started')`

## 3. 集計クエリ例（BigQuery想定）

### 3-1. kiosk利用率

```sql
SELECT
  COUNTIF(event = 'ux_kiosk_session_started') / NULLIF(COUNTIF(event = 'today_landing'), 0) AS kiosk_rate
FROM telemetry.events
WHERE date BETWEEN @start AND @end;
```

### 3-2. visible復帰遅延

```sql
SELECT
  APPROX_QUANTILES(durationMs, 100)[OFFSET(50)] AS p50_ms,
  APPROX_QUANTILES(durationMs, 100)[OFFSET(90)] AS p90_ms
FROM telemetry.events
WHERE event = 'ux_visible_refresh_completed'
  AND date BETWEEN @start AND @end;
```

### 3-3. QuickRecord時間

```sql
SELECT
  APPROX_QUANTILES(durationMs, 100)[OFFSET(50)] AS p50_ms,
  APPROX_QUANTILES(durationMs, 100)[OFFSET(90)] AS p90_ms
FROM telemetry.events
WHERE event = 'ux_quick_record_save_completed'
  AND date BETWEEN @start AND @end;
```

### 3-4. 保存前離脱率

```sql
SELECT
  COUNTIF(event = 'ux_quick_record_abandoned') /
  NULLIF(COUNTIF(event = 'ux_quick_record_started'), 0) AS abandon_rate
FROM telemetry.events
WHERE date BETWEEN @start AND @end;
```

## 4. ベースライン記録フォーマット

```md
## /today Telemetry Baseline (Week 1)

期間: YYYY-MM-DD ~ YYYY-MM-DD

### 1. kiosk利用率
- 平均: XX%
- 傾向: ↑ / → / ↓

### 2. visible復帰遅延
- p50: XX ms
- p90: XX ms

### 3. QuickRecord時間
- p50: XX 秒
- p90: XX 秒

### 4. 保存前離脱率
- XX%

### 所感
- （例）kiosk率は想定より低く、入口導線の改善余地あり
- （例）QuickRecord p90が長く、入力摩擦が残っている可能性
```

## 5. 合格ライン（仮）

- kiosk率: > 60%
- visible復帰: p90 < 1500ms
- QuickRecord: p50 < 5秒 / p90 < 12秒
- 離脱率: < 20%

## 6. 次アクション判断

- kiosk率が低い: 入口導線（ショートカット・固定起動）改善
- visible復帰遅延が高い: refetch経路と依存クエリ見直し
- QuickRecord時間が長い: 入力UI最適化
- 離脱率が高い: Hero/初期フォーカス/遷移導線を再調整


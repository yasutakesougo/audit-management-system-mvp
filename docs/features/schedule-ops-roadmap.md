# Schedule Ops — Feature Roadmap

> **Last updated**: 2026-03-20
> **Feature root**: `src/features/schedules/`

---

## ✅ Phase 1: Daily Operations View

**Goal**: 画面が成立する

- `OpsDailyTable` — 利用者一覧テーブル
- `OpsSummaryCards` — 日別サマリカード
- `OpsFilterBar` — フィルタバー
- `OpsDetailDrawer` — 利用者詳細
- `OpsScheduleHeader` — ヘッダ（日付切替・ビュー切替）
- `OpsSchedulePage` — 統合ページ (wiring only)
- `useScheduleOps` — Facade hook
- Smoke tests (10 cases)

---

## ✅ Phase 2: Weekly & List Operational Views

**Goal**: 運用が成立する

- `OpsWeekDayCell` — 1日セル (負荷サマリ表示)
- `OpsWeekBoard` — 7日グリッド (レスポンシブ)
- `OpsListView` — 監査テーブル (ソート・検索)
- 3 view exhaustive switch (daily/weekly/list)
- Weekly drilldown → daily

---

## ✅ Phase 3: Leave Recommendation & Explanation Layer

**Goal**: 判断を助ける画面に進化する

### 3-A: Load Scoring Engine
- `computeLoadScore` — 重み付き負荷スコア
- `classifyLoadLevel` — 4段階（low/moderate/high/critical）
- `assessLeaveEligibility` — 3段階（available/caution/unavailable）
- `computeWeeklyLoadScores` — 週間一括算出
- Leave eligibility badges (🟢/🟡/🔴) in weekly cells

### 3-B: Leave Suggestion Panel
- `suggestBestLeaveDays` — 推奨日ランキング
- `OpsLeaveSuggestionPanel` — おすすめ日パネル (🥇🥈🥉)
- Click-to-drilldown (weekly → daily)

### 3-C: Recommendation Reasons
- `computeLeaveReasons` — 理由導出（優先度付き、最大2つ）
- Reason labels in suggestion panel
- 42 domain tests

---

## ✅ Phase 4-A: Operations Intelligence (管理者向け)

**Goal**: 判断支援を両輪にする（おすすめ ↔ 危険）

### 4-A-1: High Load Day Warnings (PR #1118)
- `computeHighLoadReasons` — 危険理由の導出（6種類）
- `computeHighLoadWarnings` — 週間の危険日一覧（high/critical 日の抽出）
- `OpsHighLoadWarningBanner` — weekly view 上部の警告バナー
- 57 domain tests

### 4-A-2: Staffing Shortage List (PR #1119)
- `OpsStaffingShortageList` — 逼迫日テーブル（list view）
- 日付・レベル・負荷スコア・理由をカラム表示
- 新規ロジックなし — HighLoadWarning[] を並べるだけ

### ⏭ 4-A-3: 既存休暇データ反映 (#1117)
- 承認済み休暇を負荷スコアに加味
- 推奨精度の向上

---

## ✅ Phase 5-A: Schedule Unified Tabs (PR #1121)

**Goal**: 2つのスケジュールページを1つに統合

### 達成内容
- SchedulesHeader に「運営」「一覧」タブ追加
- WeekPage で tab=ops/list 時に Ops コンポーネントをレンダリング
- Today 連動: `?date=YYYY-MM-DD&source=today` で注目日バナー
- `/schedule-ops` → `/schedules/week?tab=ops` リダイレクト

### Before / After
```
Before: /schedules/week [日][週][月][組織] + /schedule-ops [日][週][一覧]
After:  /schedules/week [日][週][月][運営][一覧]
```

---

## ✅ Phase 5-B: Navigation Cleanup (#1122)

- [x] サイドナビ「運営スケジュール」項目削除
- [x] OpsSchedulePage の deprecation
- [x] リダイレクトのクエリパラメータ引き継ぎ確認

## ✅ Phase 5-C: Filter State Isolation (#1123)

- [x] タブ切替時のフィルタクリアルール
- [x] 予定表系 ↔ Ops系パラメータの分離
- [x] テスト追加

---

## ⏭ Phase 4-B: 現場向け強化 (候補)

| Issue | 内容 | 価値 |
|-------|------|------|
| モバイル最適化 | weekly パネルのタッチ対応 | 現場タブレットで即確認 |
| ワンタップ申請導線 | 推奨日→年休申請画面の直結 | 判断→行動のフリクションを最小化 |
| 今週/来週切替 | 推奨パネルの期間拡張 | 来週分も先に確認 |
| 閾値カスタマイズ | OpsLoadWeights / Thresholds を管理画面から設定 | 施設ごとのチューニング |

---

## Architecture Principles

```
Page  → wiring only（state を受けて配る）
Hook  → state orchestration（useMemo で domain を呼ぶ）
Domain → pure functions（テスト容易、副作用なし）
UI    → presentational（ロジックなし、props で表示）
```

### View Responsibilities

| View | 責務 | 対象者 |
|------|------|--------|
| daily | 現場実行 | 支援員 |
| weekly | 負荷調整 + 年休判断 + 危険日警告 | 管理者・支援員 |
| list | 監査確認 + 逼迫日一覧 | 管理者 |


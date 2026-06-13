# Handoff Timeline Architecture

最終更新: 2026-06-13

## 目的

このドキュメントは `/handoff-timeline` の現行アーキテクチャを固定し、今後の UI 追加、SharePoint 接続、状態遷移テストを小さく進めるための参照点をまとめる。

対象は実装構造の説明のみで、画面仕様や永続化仕様は変更しない。

## ルーティングとページ入口

`/handoff-timeline` は record routes 配下の viewer 向け画面として登録され、lazy-loaded page として `HandoffTimelinePage` を読み込む。

- Route: `src/app/routes/recordRoutes.tsx`
- Lazy entry: `src/app/routes/lazyPages.tsx`
- Page: `src/pages/HandoffTimelinePage.tsx`

この画面は `/dashboard`、`/today`、例外検知、操作フェーズ設定など複数の導線から参照される。そのため、導線ごとの詳細な状態はページ内 state に閉じ込めず、URL query と navigation state で受け渡す。

## Page の責務

`HandoffTimelinePage` は薄いオーケストレーターとして扱う。

主な責務は次に限定する。

- `useHandoffDateNav` による `?range=` と `?date=` の同期
- 日、週、月の range 切替
- 前日、翌日、前週、翌週、前月、翌月、今日への移動
- `HandoffDayView`、`HandoffWeekViewSection`、`HandoffMonthViewSection` の表示切替
- Quick Note dialog と利用者状態 Quick Dialog の起動
- `/today` から遷移した場合の戻り導線表示

ページは申し送り一覧の集計、状態遷移、データ取得、Repository 切替の詳細を持たない。これにより、range 切替 UI と業務ロジックの変更を分離できる。

## URL 日付ナビゲーション

`useHandoffDateNav` が `/handoff-timeline` の日付と表示範囲を一元管理する。

URL 形式:

```text
/handoff-timeline?range=day|week|month&date=YYYY-MM-DD
```

日付の解決順は次の通り。

1. URL の `date` query が valid な `YYYY-MM-DD` なら最優先する。
2. URL に日付がない場合、`location.state.dayScope` を `today` または `yesterday` として解決する。
3. どちらもない場合は今日を fallback にする。

`range` は `day`、`week`、`month` のみを許可し、それ以外は `day` として扱う。週は月曜始まり、月は対象月の 1 日から末日を範囲として計算する。

未来方向の移動は今日を超えないように制限される。日ビューは翌日が今日以下のときだけ移動し、週ビューと月ビューも未来週、未来月へ進ませない。

## View 分離

`HandoffTimelinePage` は active range に応じて次の view に委譲する。

| Range | Component | 主な責務 |
|---|---|---|
| `day` | `HandoffDayView` | 日単位の会議モード、時間帯、ステータス、表示モード、優先キュー表示 |
| `week` | `HandoffWeekViewSection` | 週 ViewModel の呼び出しと週タイトル表示 |
| `month` | `HandoffMonthViewSection` | 月 ViewModel の呼び出しと月タイトル表示 |

週、月の section は薄いラッパーで、集計はそれぞれ `useHandoffWeekViewModel`、`useHandoffMonthViewModel` に閉じ込める。日カードクリックは `dateNav.goToDate` に戻し、day range の URL に遷移させる。

## Day View State

`HandoffDayView` は描画のオーケストレーターで、状態管理は `useHandoffDayViewState` に分離されている。

`useHandoffDayViewState` の主な責務は次の通り。

- `displayMode`: `timeline` または `grouped`
- `statusFilter`: action required、pending、all などの表示絞り込み
- `meetingMode`: normal、evening、morning
- meeting mode 切替時の日付ナビゲーション連動
- `useHandoffTimelineViewModel` と `useHandoffTimeline` の DI 接続
- URL の `handoffId` query による対象カードのハイライト
- フィルタ済み申し送り一覧と件数ラベルの生成

`/today` からの遷移では `entryMode: 'from-today'` として扱い、日ビューの初期表示を `grouped` にできる。直接アクセスでは `timeline` を初期表示にする。

## ViewModel と状態マシン

`useHandoffTimelineViewModel` は会議モード、時間帯、統計、workflow actions を管理する。

workflow actions は次の操作を UI に渡す。

- `markReviewed`
- `markCarryOver`
- `markClosed`

各 action は `handoffStateMachine.ts` の `getAllowedActions` で許可遷移を確認してから実行する。許可されない遷移や DI 未注入の場合は no-op として扱い、workflow blocked log を残す。

状態遷移の中心ルール:

| Mode | 主な許可遷移 |
|---|---|
| `normal` | `未対応 -> 対応中`、`対応中 -> 対応済` |
| `evening` | `未対応 -> 確認済/完了`、`確認済 -> 明日へ持越/完了` |
| `morning` | `明日へ持越 -> 完了`、`未対応/確認済 -> 完了` |

`対応済` と `完了` は終端ステータスとして扱われ、通常の UI action では次の遷移を出さない。

## Data Access と Ports & Adapters

申し送りデータアクセスは `HandoffRepository` port に集約する。

- Port: `src/features/handoff/domain/HandoffRepository.ts`
- Factory: `src/features/handoff/infra/handoffRepositoryFactory.ts`
- Hook boundary: `src/features/handoff/hooks/useHandoffData.ts`
- Timeline data hook: `src/features/handoff/useHandoffTimeline.ts`

UI と page は localStorage や SharePoint の詳細に依存しない。`useHandoffData` から `repo` と `auditRepo` を受け取り、`useHandoffTimeline` が取得、作成、状態更新を実行する。

Factory は `handoffConfig.storage` に応じて adapter を選ぶ。

| Adapter | 用途 |
|---|---|
| LocalStorage adapter | ローカル開発、fallback、store-backed mock |
| SharePoint adapter | `useHandoffApi` と `useHandoffAuditApi` 経由の運用データ接続 |
| Audit adapter | 作成、ステータス変更の監査ログ記録 |

Port は async API に統一されているため、localStorage 実装でも UI 側は SharePoint と同じ呼び出し形を使う。

## 更新の堅牢化

`useHandoffTimeline` は状態更新時に次の保護を持つ。

- 楽観的更新で UI に即時反映する。
- functional update 内で rollback 用 snapshot を取得し、stale closure を避ける。
- `inflightIds` で同一 handoff ID への並行更新をブロックする。
- Repository 更新に失敗した場合、snapshot に戻して error を表示する。
- 監査ログは fire-and-forget とし、永続化失敗は専用 log に分類して残す。

このため、UI は action を呼ぶだけで、ロールバック、連打ガード、監査ログ失敗の扱いを個別に実装しない。

## 変更時の境界

今後の変更では次の境界を保つ。

- Range、日付、URL 同期を変更する場合は `useHandoffDateNav` とその tests に閉じる。
- 日ビューの表示状態を変更する場合は `useHandoffDayViewState` と `HandoffDayView` に閉じる。
- 会議モードの状態遷移を変更する場合は `handoffStateMachine.ts` と ViewModel tests を先に更新する。
- 永続化先の切替や API 差分は `HandoffRepository` port と adapter に閉じ、page や view に漏らさない。
- 楽観的更新や rollback の仕様を変える場合は `useHandoffTimeline` の同一 ID 連打ガードと失敗時復元を明示的にテストする。

## Out of Scope

このドキュメントでは次を扱わない。

- SharePoint list field の追加、変更
- `/handoff-timeline` UI の見た目変更
- 状態遷移ルールの変更
- AI 分析や Record Quality との統合
- 既存 handoff データの migration

# HandoffTimelinePage Touchpoints

申し送りタイムライン画面の確認ポイントと修正起点を、運用・開発の両方で共通化する。

## 対象

- HandoffTimelinePage（`/handoff/timeline`）

## 前提

- 日付ナビゲーション（日 / 週 / 月）と date picker
- Day view の Hero / Priority Queue / フィルタ群
- 重要度（重要 / 要注意 / 通常）とステータス（未対応 / 対応中 / 対応済）
- 利用者状態のクイック登録ダイアログ

## 画面で確認する場所

- ヘッダー下の日付ナビ（前後移動 / 今日 / 日週月トグル）
- Day view の UrgentHandoffHero（最優先1件）
- HandoffActionQueue（残り要対応の優先キュー）
- Day view フィルタ（会議モード / 時間帯 / 表示モード / ステータス）
- 日次サマリー（件数表示、フィルタ中チップ）

## コードで修正する場所

- ページオーケストレーション（日付ナビ・view切替）: `src/pages/HandoffTimelinePage.tsx:45`
- 日付レンジ切替/日付遷移ハンドラ: `src/pages/HandoffTimelinePage.tsx:52`
- Day view レンダリングと操作ハンドラ: `src/features/handoff/views/HandoffDayView.tsx:81`
- Day view state（表示モード/ステータスフィルタ/meeting mode）: `src/features/handoff/hooks/useHandoffDayViewState.ts:85`
- 重要度グループ化ロジック: `src/features/handoff/domain/groupHandoffsByPriority.ts:49`
- 最優先1件選出ロジック: `src/features/handoff/domain/resolveNextHandoffAction.ts:50`
- ステータスフィルタロジック: `src/features/handoff/domain/filterHandoffsByStatus.ts:51`
- 読み込み/更新アクション境界: `src/features/handoff/useHandoffTimeline.ts:56`

## 変更目的ごとの入口

- 文言だけ直す:
  - `src/pages/HandoffTimelinePage.tsx:135`
  - `src/features/handoff/views/HandoffDayView.tsx:145`
  - `src/features/handoff/domain/filterHandoffsByStatus.ts:24`
- 並び順/フィルタ条件を直す:
  - `src/features/handoff/domain/groupHandoffsByPriority.ts:30`
  - `src/features/handoff/domain/resolveNextHandoffAction.ts:36`
  - `src/features/handoff/domain/filterHandoffsByStatus.ts:51`
- 重要度ラベル・表示条件を直す:
  - `src/features/handoff/domain/groupHandoffsByPriority.ts:32`
  - `src/features/handoff/domain/resolveNextHandoffAction.ts:30`
- 状態更新（既読/対応済）導線を直す:
  - `src/features/handoff/views/HandoffDayView.tsx:118`
  - `src/features/handoff/useHandoffTimeline.ts:154`
  - `src/features/handoff/useHandoffTimeline.ts:168`
- 画面確認だけしたい:
  - 日付ナビ -> Hero -> Priority Queue -> フィルタ切替 -> サマリー件数確認

## 最短確認手順（30秒）

1. `/handoff/timeline` を開く
2. `日` 表示で Hero が1件表示されるか確認
3. ステータスフィルタを `要対応` -> `未対応のみ` -> `すべて` に切り替える
4. Priority Queue の件数とサマリー件数が連動することを確認
5. 1件を `対応済` にして Hero/Queue から外れることを確認

## 関連PR

- #1145 Touchpoints テンプレ追加
- #1148 runbooks 入口 README 追加

## 備考

- HandoffTimelinePage は薄いオーケストレーターで、主要な表示ロジックは DayView と domain 関数に分離されている。
- 行番号は前後する可能性があるため、`resolveNextHandoffAction` / `groupHandoffsByPriority` / `filterHandoffsByStatus` でも検索する。

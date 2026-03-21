# CallLogPage Touchpoints

電話・連絡ログ画面の確認ポイントと修正起点を、運用・開発の両方で共通化する。

## 対象

- CallLogPage（`/call-logs`）

## 前提

- Hero（次に対応すべき1件）と Priority Queue（優先対応キュー）
- ステータスタブ（未対応 / 折返し待ち / 完了 / すべて）
- キーワード / 利用者紐付けフィルタ、空状態、Quick Drawer

## 画面で確認する場所

- NextCallHero（次アクション）
- CallLogPriorityQueue（優先度ごとの未対応）
- タブ切替とフィルタバー
- 空状態（データ0件 / フィルタ0件）
- 新規受付ドロワー（CallLogQuickDrawer）

## コードで修正する場所

- ページオーケストレーション: `src/pages/CallLogPage.tsx:187`
- URLプリセット復元と初期フィルタ: `src/pages/CallLogPage.tsx:198`
- Hero/Queue の完了処理: `src/pages/CallLogPage.tsx:248`
- フィルタ適用と解除: `src/pages/CallLogPage.tsx:230`, `src/pages/CallLogPage.tsx:280`
- 空状態の表示分岐: `src/pages/CallLogPage.tsx:461`, `src/pages/CallLogPage.tsx:479`
- 一覧取得・更新 mutation の境界: `src/features/callLogs/hooks/useCallLogs.ts:46`

## 変更目的ごとの入口

- 文言だけ直す:
  - `src/pages/CallLogPage.tsx:292`
  - `src/pages/CallLogPage.tsx:450`
  - `src/pages/CallLogPage.tsx:490`
- ボタン/クリック動作を直す:
  - `src/pages/CallLogPage.tsx:301`
  - `src/pages/CallLogPage.tsx:314`
  - `src/pages/CallLogPage.tsx:243`
- 導線（フィルタ・タブ・状態遷移）を直す:
  - `src/pages/CallLogPage.tsx:239`
  - `src/pages/CallLogPage.tsx:230`
  - `src/features/callLogs/hooks/useCallLogs.ts:55`
- 画面確認だけしたい:
  - Hero -> Priority Queue -> タブ/フィルタ -> 一覧 or 空状態 -> 新規受付ドロワー

## 関連PR

- #1145 Touchpointsテンプレ追加
- #1148 runbooks入口 README 追加

## 備考

- CallLogPage は `useCallLogs` 経由でデータ取得・更新する。Repository をページから直接触らない。
- 行番号は前後する可能性があるため、`NextCallHero` / `CallLogPriorityQueue` / `useCallLogs` の識別子でも検索する。

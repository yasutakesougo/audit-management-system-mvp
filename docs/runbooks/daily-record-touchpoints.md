# DailyRecordPage Touchpoints

日次記録画面の確認ポイントと修正起点を、運用・開発の両方で共通化する。

## 対象

- DailyRecordPage（`/daily/activity`）

## 前提

- 次に記録すべき対象（Hero/Queue）
- 申し送りサマリー、統計、検索/ステータス/日付フィルタ
- 一括操作、個票編集、ContextPanel

## 画面で確認する場所

- NextRecordHero（次に書く1件）
- RecordActionQueue（未完了キュー / 完了済み折りたたみ）
- 申し送りサマリーバナー
- フィルタ / 一括操作 / 記録リスト / 記録フォーム
- ContextPanel トグルと表示内容

## コードで修正する場所

- ページオーケストレーション: `src/pages/DailyRecordPage.tsx:69`
- Hero/Queue CTA（クリック導線）: `src/pages/DailyRecordPage.tsx:127`
- 保存後の次レコード遷移: `src/pages/DailyRecordPage.tsx:178`
- 申し送りサマリーCTA: `src/pages/DailyRecordPage.tsx:397`
- フィルタ/一括処理のハンドラ本体: `src/features/daily/lists/useDailyRecordViewModel.ts:114`
- 保存・削除・一括完了ロジック: `src/features/daily/lists/useDailyRecordViewModel.ts:154`

## 変更目的ごとの入口

- 文言だけ直す:
  - `src/pages/DailyRecordPage.tsx:345`
  - `src/pages/DailyRecordPage.tsx:388`
  - `src/features/daily/lists/useDailyRecordViewModel.ts:174`
- ボタン/クリック動作を直す:
  - `src/pages/DailyRecordPage.tsx:127`
  - `src/pages/DailyRecordPage.tsx:142`
  - `src/pages/DailyRecordPage.tsx:401`
- 導線（遷移先・次アクション）を直す:
  - `src/pages/DailyRecordPage.tsx:172`
  - `src/pages/DailyRecordPage.tsx:178`
  - `src/features/daily/lists/useDailyRecordViewModel.ts:147`
- 画面確認だけしたい:
  - Hero -> Queue -> 申し送りバナー -> フィルタ/一括操作 -> 記録リスト -> フォーム

## 関連PR

- #1145 Touchpointsテンプレ追加
- #1146 TodayOpsPage touchpoints追加

## 備考

- DailyRecordPage は orchestrator で、フィルタ/保存系の主要ロジックは `useDailyRecordViewModel` にある。
- 行番号は前後する可能性があるため、`NextRecordHero` / `RecordActionQueue` / `handleSaveRecordWithNext` などのキーでも検索する。

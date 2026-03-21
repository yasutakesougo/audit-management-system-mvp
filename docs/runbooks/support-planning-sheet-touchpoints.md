# SupportPlanningSheetPage Touchpoints

SupportPlanningSheetPage の確認・修正ポイントを、画面視点とコード視点で整理する。

## 対象

- SupportPlanningSheetPage（支援計画シート画面）

## 前提

- モニタリング履歴 / 支援設計 / 編集導線を含むUI

## 関連PR

- #1138 操作ガイド追加
- #1139 局所補助文追加
- #1140 空状態CTA追加
- #1141 取込後スクロール + フィードバック

## 画面で確認する場所

- 上部「操作ガイド」（「編集を始める」ボタンを含む）
- 「モニタリング履歴 / 取込履歴」セクション
- 履歴フィルタ（すべて / モニタリング / アセスメント）
- 履歴0件時の「モニタリングを取り込む」ボタン
- 最下部「更新日 / 更新者」表示

## コードで修正する場所

- 操作ガイドUI: `src/pages/SupportPlanningSheetPage.tsx:520`
- 履歴フィルタ状態と絞り込み: `src/pages/SupportPlanningSheetPage.tsx:121`, `src/pages/SupportPlanningSheetPage.tsx:228`
- 履歴フィルタUI: `src/pages/SupportPlanningSheetPage.tsx:584`
- 履歴0件/フィルタ0件メッセージ: `src/pages/SupportPlanningSheetPage.tsx:605`, `src/pages/SupportPlanningSheetPage.tsx:610`
- 取込ダイアログ起動ハンドラ: `src/pages/SupportPlanningSheetPage.tsx:517`
- 履歴セクションへのジャンプ処理: `src/pages/SupportPlanningSheetPage.tsx:385`, `src/pages/SupportPlanningSheetPage.tsx:539`
- 取込後フィードバック表示: `src/pages/SupportPlanningSheetPage.tsx:323`
- 更新確認の局所補助文: `src/pages/SupportPlanningSheetPage.tsx:728`

## 変更目的ごとの入口

- 文言だけ直す:
  - `src/pages/SupportPlanningSheetPage.tsx:527`
  - `src/pages/SupportPlanningSheetPage.tsx:530`
  - `src/pages/SupportPlanningSheetPage.tsx:599`
  - `src/pages/SupportPlanningSheetPage.tsx:605`
  - `src/pages/SupportPlanningSheetPage.tsx:728`
- ボタン動作を直す:
  - `src/pages/SupportPlanningSheetPage.tsx:517`
  - `src/pages/SupportPlanningSheetPage.tsx:539`
- 履歴フィルタ条件を直す:
  - `src/features/planning-sheet/domain/filterAuditHistory.ts:1`
  - `src/pages/SupportPlanningSheetPage.tsx:228`
- 取込後の導線を直す:
  - `src/pages/SupportPlanningSheetPage.tsx:294`
  - `src/pages/SupportPlanningSheetPage.tsx:385`
- 画面確認だけしたい:
  - 操作ガイド → 履歴フィルタ切替 → 履歴セクション → 空状態CTA → 更新表示

## 備考

行番号は UI 改修で前後する可能性があるため、変更時は `SupportPlanningSheetPage.tsx` 内の見出しコメントも併せて検索する。

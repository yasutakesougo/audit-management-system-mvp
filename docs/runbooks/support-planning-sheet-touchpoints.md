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
- 履歴0件時の「モニタリングを取り込む」ボタン
- 最下部「更新日 / 更新者」表示

## コードで修正する場所

- 操作ガイドUI: `src/pages/SupportPlanningSheetPage.tsx:512`
- 履歴0件CTA: `src/pages/SupportPlanningSheetPage.tsx:572`
- 取込ダイアログ起動ハンドラ: `src/pages/SupportPlanningSheetPage.tsx:509`
- 履歴セクションへのジャンプ処理: `src/pages/SupportPlanningSheetPage.tsx:377`, `src/pages/SupportPlanningSheetPage.tsx:528`
- 取込後フィードバック表示: `src/pages/SupportPlanningSheetPage.tsx:311`, `src/pages/SupportPlanningSheetPage.tsx:315`
- 更新確認の局所補助文: `src/pages/SupportPlanningSheetPage.tsx:690`

## 変更目的ごとの入口

- 文言だけ直す:
  - `src/pages/SupportPlanningSheetPage.tsx:519`
  - `src/pages/SupportPlanningSheetPage.tsx:539`
  - `src/pages/SupportPlanningSheetPage.tsx:573`
  - `src/pages/SupportPlanningSheetPage.tsx:690`
- ボタン動作を直す:
  - `src/pages/SupportPlanningSheetPage.tsx:509`
  - `src/pages/SupportPlanningSheetPage.tsx:528`
- 取込後の導線を直す:
  - `src/pages/SupportPlanningSheetPage.tsx:286`
  - `src/pages/SupportPlanningSheetPage.tsx:377`
- 画面確認だけしたい:
  - 操作ガイド → 履歴セクション → 空状態CTA → 更新表示

## 備考

行番号は UI 改修で前後する可能性があるため、変更時は `SupportPlanningSheetPage.tsx` 内の見出しコメントも併せて検索する。

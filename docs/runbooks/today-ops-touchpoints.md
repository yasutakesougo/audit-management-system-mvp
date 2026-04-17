# TodayOpsPage Touchpoints

Today 実行画面の確認ポイントと修正起点を、運用・開発の両方で共通化する。

## 対象

- TodayOpsPage（`/today` 実行レイヤー）

## 前提

- ヒーロー導線（今やること）
- 進捗リング / 利用者記録 / 申し送り / 電話ログ / 高負荷タイル
- Quick Record / 承認 / 利用者状態のダイアログ導線

## 画面で確認する場所

- ZONE A: ヒーローカード（今やること）
- ZONE B: 進捗リング（支援手順 / ケース記録 / 出欠 / 連絡）
- ZONE C1: 利用者記録、申し送り、電話・連絡ログ
- 高負荷日タイル（表示時のみ）
- Quick Record 完了トースト / 利用者状態成功トースト

## コードで修正する場所

- ページオーケストレーション: `src/pages/TodayOpsPage.tsx:56`
- レイアウトprops合成: `src/pages/TodayOpsPage.tsx:186`
- ProgressRingsの値計算と遷移: `src/pages/TodayOpsPage.tsx:200`
- Quick Record保存後挙動: `src/pages/TodayOpsPage.tsx:333`
- 画面カード配置（ZONE構成）: `src/features/today/layouts/TodayBentoLayout.tsx:191`
- CTA遷移・ユーザー並び替え・リスト導線: `src/features/today/hooks/useTodayLayoutProps.ts:111`

## 変更目的ごとの入口

- 文言だけ直す:
  - `src/features/today/layouts/TodayBentoLayout.tsx:187`
  - `src/pages/TodayOpsPage.tsx:389`
  - `src/pages/TodayOpsPage.tsx:430`
- ボタン/クリック動作を直す:
  - `src/features/today/hooks/useTodayLayoutProps.ts:188`
  - `src/features/today/hooks/useTodayLayoutProps.ts:235`
  - `src/pages/TodayOpsPage.tsx:315`
- 導線（どの画面へ遷移するか）を直す:
  - `src/features/today/hooks/useTodayLayoutProps.ts:245`
  - `src/features/today/hooks/useTodayLayoutProps.ts:300`
  - `src/pages/TodayOpsPage.tsx:308`
- 画面確認だけしたい:
  - ヒーローカード -> 進捗リング -> 利用者記録 -> 高負荷タイル -> 右下の各トースト

## 関連PR

- #1135 Today高負荷タイル追加
- #1137 PDCA/TODAY連携スタックの取り込み
- #1145 Touchpointsテンプレ追加
- #1510 Operational OS ナビゲーションおよびルーター整合性の硬化

## 備考

- TodayOpsPage は実行レイヤー。集約ロジック追加は `useTodaySummary` 側で行う。
- 行番号は前後する可能性があるため、見出しコメントや `TodayBentoLayout` / `useTodayLayoutProps` で併せて検索する。

# /daily/table 責務マップ（一次レビュー用）

## 目的
- 一覧形式のケース記録を「フルスクリーンダイアログ」として提供する
- 入力導線（利用者選択 → 一覧入力 → 保存）を最小操作で完結させる
- 画面の見た目と挙動を維持したまま、内部責務を分離して改修耐性を上げる

## 画面構造（ルーティング → ページ → フォーム）
- ルート: /daily/table
- Suspense境界: `SuspendedTableDailyRecordPage`
- ページ: `TableDailyRecordPage`
- コンテナ: `FullScreenDailyDialogPage`
- 本体: `TableDailyRecordForm`（`variant="content"`）

## 責務分割（UI / State / Actions）

### 1) Page / Container 層
- `TableDailyRecordPage`
  - 役割: 画面の器（タイトル・戻る導線・フルスクリーン）を提供
  - データ: `useTableDailyRecordViewModel` から `title/backTo/testId/onClose/onSave` を注入

### 2) Form 層（描画の組み立て）
- `TableDailyRecordForm`
  - 役割: セクション配置と保存ボタンの描画
  - 依存: `useTableDailyRecordForm` の state/actions を受け取る
  - サブ構成:
    - `TableDailyRecordHeader`（基本情報）
    - `TableDailyRecordUserPicker`（利用者選択）
    - `TableDailyRecordTable`（一覧入力テーブル）

### 3) Hook 層（state/derived/actions）
- `useTableDailyRecordForm`
  - state:
    - `formData`（日付・記録者・行データ）
    - `selectedUserIds` / `searchQuery` / `showTodayOnly` / `saving`
  - derived:
    - `filteredUsers`（通所日 + 検索）
    - `selectedUsers`（選択ユーザーの実体）
  - actions:
    - ユーザー選択（単体/全選択/クリア）
    - 行データ更新（活動/昼食/問題行動/特記事項）
    - 行クリア
    - 保存処理（バリデーション/保存/リセット）

## 主要データ構造
- `TableDailyRecordData`
  - `date: string`
  - `reporter: { name: string; role: string }`
  - `userRows: Array<UserRowData>`
- `UserRowData`
  - `userId, userName`
  - `amActivity, pmActivity, lunchAmount`
  - `problemBehavior`（自傷/暴力/大声/異食/その他）
  - `specialNotes`

## 変更しない前提
- UI/挙動は完全維持
- コンポーネント分割は “見通しの改善” のみ
- 保存先・API 接続は今後差し替え予定

## 次フェーズの判断ポイント（参考）
- 列追加（行テンプレ/権限別列の分岐）が入る → `TableDailyRecordTable` の内部を分割
- 利用者選択の高度化（複合フィルタ/並び替え） → `TableDailyRecordUserPicker` のロジック拡張
- 印刷/PDF → `TableDailyRecordTable` の表示専用バリアント追加

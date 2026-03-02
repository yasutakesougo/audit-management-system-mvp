# UserDetailSections の重複コード（2ファイル並存）

- **対象ファイル**:
  - `src/features/users/UserDetailSections.tsx`
  - `src/features/users/UserDetailSections/index.tsx`
- **カテゴリ**: リファクタリング
- **現状の課題**:
  `UserDetailSections` が 2 つの場所に存在しています:
  1. `src/features/users/UserDetailSections.tsx` — 単一ファイル版
  2. `src/features/users/UserDetailSections/index.tsx` — ディレクトリ版（`ISPSummarySection.tsx` を含むリファクタリング途中）

  grep の結果、両ファイルで以下のコードが重複しています:
  - `resolveUserIdentifier()` 関数
  - ユーザー詳細の Chip 表示（利用者コード、支援区分、在籍/退所、契約日等）
  - セクションカード一覧の定義
  - `size="small"` の Chip/Button パターン

  これはリファクタリング途中で旧版が削除されずに残った状態と思われ:
  1. 修正を一方にしか適用し忘れるリスク
  2. importパスの混乱（どちらを使うべきか不明確）
  3. バンドルサイズの無駄な増大
- **解決策の提案**:
  1. `UserDetailSections/index.tsx` を正として、`UserDetailSections.tsx`（フラットファイル）を削除
  2. 全ての import パスが `@/features/users/UserDetailSections` に統一されていることを確認
  3. 旧ファイルへの参照がないことを `grep` で検証後に削除
- **見積もり影響度**: Medium

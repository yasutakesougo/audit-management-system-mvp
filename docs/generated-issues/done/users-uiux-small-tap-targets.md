# UsersList.tsx における size="small" の多用とタブレット操作性の改善

- **対象ファイル**:
  - `src/features/users/UsersPanel/UsersList.tsx`（13箇所で `size="small"` 使用）
  - `src/features/users/UserDetailSections.tsx`（12箇所）
  - `src/features/users/UserDetailSections/index.tsx`（16箇所）
  - `src/features/users/UserForm.tsx`
  - `src/features/users/UsersPanel/UsersCreateForm.tsx`
  - `src/features/users/UsageStatusDashboard.tsx`
- **カテゴリ**: UI・UX
- **現状の課題**:
  福祉施設の現場ではタブレット端末での操作が主要なユースケースです。しかし、users ドメイン全体で `size="small"` が 50 箇所以上使用されています。

  MUI の `size="small"` は:
  - **Button**: 高さ 30.75px（推奨タップ領域 44px 未満）
  - **IconButton**: 34px（推奨タップ領域 48px 未満）
  - **Chip**: 高さ 24px（非常に小さい）
  - **Table**: セルパディングが縮小

  [WCAG 2.5.5](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html) ではタップターゲットの最小サイズを 44×44 CSS pixels と推奨しています。

  特に `UsersList.tsx` ではテーブル内の操作ボタン（編集・削除等）がすべて `size="small"` で、手袋着用時や高齢スタッフの操作時に誤タップのリスクがあります。
- **解決策の提案**:
  1. MUI テーマレベルで `components.MuiButton.defaultProps.size` を `"medium"` に統一
  2. テーブル内ボタンには最小 `minHeight: 44, minWidth: 44` を設定
  3. `Chip` コンポーネントには `sx={{ minHeight: 32 }}` を適用
  4. テーブルの `size="small"` は情報密度のため残すが、操作可能な要素のみタップ領域を拡大

  ```tsx
  // テーマ設定 (src/mui/theme.ts)
  components: {
    MuiButton: {
      styleOverrides: {
        sizeSmall: {
          minHeight: 44,
          minWidth: 44,
          '@media (pointer: coarse)': {
            minHeight: 48,
            minWidth: 48,
          },
        },
      },
    },
  }
  ```
- **見積もり影響度**: Medium

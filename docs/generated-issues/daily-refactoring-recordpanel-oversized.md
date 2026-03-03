# RecordPanel.tsx の肥大化解消（646行）

- **対象ファイル**: `src/features/daily/components/split-stream/RecordPanel.tsx`（646行）
- **カテゴリ**: リファクタリング
- **現状の課題**:
  `RecordPanel.tsx` は 646 行の巨大コンポーネントで、以下が混在しています:
  1. `RecordPanel` コンポーネント本体が約 590 行（L53-L643）
  2. フォーム状態管理（行動記録の入力、気分選択、メモ）
  3. 時間スロット選択と自動スクロール（`handleSlotChange` L211-228）
  4. フォーム送信ロジック（`handleSubmit` L230-278）
  5. UI レンダリング（時間スロットグリッド、気分ラジオボタン、メモテキストエリア）
  6. ロック状態管理（3状態: `open`, `readonly`, `frozen`）
  7. ハードコードされた定数（`MOOD_OPTIONS`）

  また discriminated union を使ったpropsの型（`InteractiveRecordPanelProps` vs `CustomRecordPanelProps`）は適切だが、一方でコンポーネント内のロジック分離ができていません。
- **解決策の提案**:
  ```
  src/features/daily/components/split-stream/
  ├── RecordPanel.tsx             # コンテナ (≤200行)
  ├── RecordFormFields.tsx        # フォーム入力部品
  ├── TimeSlotSelector.tsx        # 時間スロット選択UI
  ├── hooks/useRecordForm.ts      # フォーム状態管理ロジック
  └── constants.ts                # MOOD_OPTIONS等
  ```
- **見積もり影響度**: Medium

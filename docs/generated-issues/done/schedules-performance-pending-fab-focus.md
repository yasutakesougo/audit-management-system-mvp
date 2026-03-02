# useSchedulesCrud の pendingFabFocus モジュールレベル変数

- **対象ファイル**: `src/features/schedules/hooks/useSchedulesCrud.ts`（365行、L33）
- **カテゴリ**: パフォーマンス
- **現状の課題**:
  `useSchedulesCrud.ts` の 33 行目に以下のモジュールレベル変数があります:
  ```typescript
  let pendingFabFocus = false;
  export { pendingFabFocus };
  ```
  このフラグは「ダイアログが閉じた後に FAB にフォーカスを戻すかどうか」を追跡する目的ですが:
  1. **モジュールレベルの mutable 変数** が `export` されており、外部から自由に書き換え可能
  2. React のレンダリングサイクルと無関係な状態管理のため、状態変更がUIに反映されない可能性
  3. HMR（Hot Module Replacement）時に初期化されず、開発中に予期しない動作を引き起こす可能性
  4. `useSchedulesCrud` フック自体も 273 行の巨大関数（L92-L364）
- **解決策の提案**:
  `useRef` を使用してコンポーネントライフサイクルに紐付ける:
  ```typescript
  // useSchedulesCrud.ts 内
  const pendingFabFocusRef = useRef(false);

  // FAB クリック時
  pendingFabFocusRef.current = true;

  // ダイアログ閉じた時
  if (pendingFabFocusRef.current) {
    fabRef.current?.focus();
    pendingFabFocusRef.current = false;
  }
  ```
  または、より小さな専用フック `useFabFocusRestore()` に抽出する。
- **見積もり影響度**: Medium

# StaffForm.tsx の肥大化解消（693行）

- **対象ファイル**: `src/features/staff/StaffForm.tsx`（693行）
- **カテゴリ**: リファクタリング
- **現状の課題**:
  `StaffForm.tsx` の `StaffForm` コンポーネント本体が約 585 行を占めています。以下の課題があります:
  - 型定義（`FormValues`, `Errors`, `MessageState`）がコンポーネントファイル内にインライン定義
  - バリデーションロジック、変換ロジック（`toStaffStorePayload`, `sanitize`）がUIと密結合
  - 定数（`DAYS`, `BASE_WEEKDAY_OPTIONS`, `CERTIFICATION_OPTIONS`）がファイル内にハードコード
  - `onBeforeUnload` イベントハンドラなどの副作用がコンポーネント内に直書き
  - `createRef` が使われているが、関数コンポーネントでは `useRef` が推奨
- **解決策の提案**:
  ```
  src/features/staff/
  ├── StaffForm.tsx                    # レイアウト+UI (≤300行)
  ├── domain/staffFormValidation.ts    # バリデーションロジック
  ├── domain/staffFormMapper.ts        # toStaffStorePayload, sanitize
  ├── domain/staffFormConstants.ts     # DAYS, CERTIFICATION_OPTIONS 等
  └── hooks/useStaffFormGuards.ts      # onBeforeUnload, unsaved changes
  ```
  `createRef` → `useRef` に置き換え。バリデーション・変換ロジックを純粋関数として抽出し、ユニットテスト可能にする。
- **見積もり影響度**: Medium

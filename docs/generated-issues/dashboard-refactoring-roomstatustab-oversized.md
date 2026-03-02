# RoomStatusTab.tsx の肥大化解消（758行）

- **対象ファイル**: `src/features/dashboard/tabs/RoomStatusTab.tsx`（758行）
- **カテゴリ**: リファクタリング
- **現状の課題**:
  `RoomStatusTab.tsx` は 758 行の巨大コンポーネントで、以下が混在しています:
  - 予約データの型定義・定数（`Reservation`, `ROOMS`, `SLOTS`, `GROUPS`, `GROUP_COLORS`）
  - ローカルステートによる予約管理（useState ベースの CRUD）
  - カレンダーナビゲーションロジック（月移動、日付計算）
  - フォーム入力ロジック（バリデーション含む）
  - テーブル・月間カレンダーの 2 つの表示モード
  コンポーネント本体 `RoomStatusTab()` が 690 行を占め、単一のメガコンポーネントになっています。
- **解決策の提案**:
  ```
  src/features/dashboard/tabs/room-status/
  ├── RoomStatusTab.tsx            # コンテナ (≤150行)
  ├── ReservationForm.tsx          # 予約追加フォーム
  ├── ReservationCalendar.tsx      # 月間カレンダービュー
  ├── ReservationTable.tsx         # テーブルビュー
  ├── hooks/useReservations.ts     # 予約 CRUD ロジック
  └── constants.ts                 # ROOMS, SLOTS, GROUPS, GROUP_COLORS
  ```
- **見積もり影響度**: Medium

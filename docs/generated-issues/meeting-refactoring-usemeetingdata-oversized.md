# useMeetingData.ts の肥大化解消（875行）

- **対象ファイル**: `src/features/meeting/useMeetingData.ts`（875行）
- **カテゴリ**: リファクタリング
- **現状の課題**:
  `useMeetingData.ts` は 875 行の巨大フックであり、以下の複数の責務が混在しています:
  - SharePoint リスト操作（CRUD）
  - 同期処理（sync/refresh）
  - 状態管理（loading, error, syncing）
  - 3 つのフック (`useMeetingData`, `useMeetingSession`, `useTodaysMeetings`) が 1 ファイルに同居
  - `useMeetingData` 単独で 590 行を占め、テスト不可能な密結合になっている
- **解決策の提案**:
  ```
  src/features/meeting/
  ├── domain/
  │   └── meetingTypes.ts         # 型定義の集約
  ├── hooks/
  │   ├── useMeetingData.ts       # コアの状態管理 (≤200行)
  │   ├── useMeetingSession.ts    # セッション管理フック
  │   └── useTodaysMeetings.ts    # 今日の会議フック
  └── infra/
      └── meetingRepository.ts    # SharePoint 操作の分離
  ```
  リポジトリパターンを適用し、SP操作を `infra/` に閉じ込める。各フックは 200 行以内に収める。
- **見積もり影響度**: High

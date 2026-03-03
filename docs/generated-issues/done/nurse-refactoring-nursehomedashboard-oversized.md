# NurseHomeDashboard.tsx の肥大化解消（675行）とハードコードデータの分離

- **対象ファイル**: `src/features/nurse/home/NurseHomeDashboard.tsx`（675行）
- **カテゴリ**: リファクタリング
- **現状の課題**:
  `NurseHomeDashboard.tsx` は 675 行のモノリシックなコンポーネントです。特に深刻な問題:
  1. **ハードコードされたデモデータ**: `TASK_SEED`（40行）、`TIMELINE`（43行）、`INSTRUCTION_DIFFS`（46行）、`INTEGRATION_STATUS`（12行）等の巨大な定数配列がコンポーネントファイル内にインライン定義されている
  2. **6 つの型定義**（`Priority`, `RecipientTag`, `TaskSeed`, `TaskState`, `TimelineEntry`, `InstructionDiff`, `IntegrationStatus`）がファイル内にローカル定義
  3. コンポーネント本体 `NurseHomeDashboard()` が 435 行で、フィルタリング、ソート、状態管理、描画が全て混在
  4. ユーティリティ関数（`formatDueLabel`, `severityColor`, `severityBackground`）がファイルレベルに散在
- **解決策の提案**:
  ```
  src/features/nurse/home/
  ├── NurseHomeDashboard.tsx           # コンテナ (≤200行)
  ├── components/
  │   ├── TaskCard.tsx                 # タスクカード
  │   ├── TimelineSection.tsx          # タイムライン表示
  │   └── InstructionDiffTable.tsx     # 指示変更テーブル
  ├── domain/
  │   ├── nurseHomeTypes.ts            # 型定義
  │   └── nurseDemoData.ts             # デモデータ (将来的にAPIに置換)
  └── hooks/
      └── useNurseTaskState.ts         # タスク状態管理
  ```
- **見積もり影響度**: Medium

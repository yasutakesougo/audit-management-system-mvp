# mappers.ts の肥大化解消と型定義のドメイン移行（723行）

- **対象ファイル**: `src/lib/mappers.ts`（723行）
- **カテゴリ**: リファクタリング
- **現状の課題**:
  `mappers.ts` は 723 行のユーティリティファイルで、以下の問題があります:
  1. **複数ドメインの型定義が混在**: `Daily`, `Schedule`, `LocalRange` などの型が `src/lib/` 内に定義されており、それぞれのドメイン (`daily`, `schedules`) に属するべき
  2. **39 個の関数が 1 ファイルに集約**: `mapUser`, `mapStaff`, `mapDaily`, `mapSchedule` といったドメイン固有のマッパーが共通 lib に存在
  3. **`mapSchedule` 関数単独で 127 行**: 1 つの関数としても巨大
  4. **ドメイン依存の逆転**: `src/lib/` が `@/sharepoint/fields` に依存し、インフラ層の知識が共通層に漏出

  本来の依存方向: `features/X/domain → lib/` であるべきが、`lib/ → sharepoint/` → 各ドメインの知識を持つ、という逆転が起きています。
- **解決策の提案**:
  各マッパーをドメインの `infra/` 層に移動:
  ```
  src/features/users/infra/mapUser.ts       ← mapUser, 関連ユーティリティ
  src/features/staff/infra/mapStaff.ts      ← mapStaff
  src/features/daily/infra/mapDaily.ts      ← mapDaily, Daily型
  src/features/schedules/infra/mapSchedule.ts ← mapSchedule, Schedule型, LocalRange
  src/lib/mappers.ts                        ← 共通ユーティリティのみ残す
                                              (normalizeStringArray, toTimeString,
                                               toDateOnly, pickField, toBoolean等)
  ```
  共通ユーティリティのみを `src/lib/mapperUtils.ts`（≤100行）に残す。
- **見積もり影響度**: High

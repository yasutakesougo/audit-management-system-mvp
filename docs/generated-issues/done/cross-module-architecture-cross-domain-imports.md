# ドメイン間の内部モジュール依存違反

- **対象ファイル**:
  - `src/features/users/UserDetailSections/ISPSummarySection.tsx`
    → `@/features/ibd/plans/isp-editor/data/ispRepo`（ibd の data 層を直接参照）
    → `@/features/ibd/plans/isp-editor/hooks/useISPComparisonEditor`（ibd の hooks を直接参照）
  - `src/features/users/UsersPanel/hooks/useUsersPanelExport.ts`
    → `@/features/daily/repositoryFactory`（daily の internal を参照）
    → `@/features/reports/achievement/AchievementRecordPDF`（reports の internal を参照）
    → `@/features/reports/achievement/useAchievementPDF`（reports の hooks を参照）
    → `@/features/reports/monthly/MonthlySummaryExcel`（reports の internal を参照）
  - `src/features/today/domain/useTodaySummary.ts`
    → `@/features/attendance/store`（attendance の store を直接参照）
    → `@/features/dashboard/useDashboardSummary`（dashboard の internal を参照）
    → `@/features/staff/store`（staff の store を直接参照）
    → `@/features/users/usersStoreDemo`（users の internal を参照）
  - `src/features/schedules/hooks/useOrgOptions.ts`
    → `@/features/org/store`（org の store を直接参照）
  - `src/features/schedules/hooks/useScheduleUserOptions.ts`
    → `@/features/users/store`（users の store を直接参照）
  - `src/features/schedules/hooks/useSchedulesToday.ts`
    → `@/features/dashboard/logic/syncGuardrails`（dashboard の logic を直接参照）
- **カテゴリ**: アーキテクチャ
- **現状の課題**:
  複数のドメインが他ドメインの **内部モジュール**（`store`, `hooks`, `data`, `infra` 等）を直接 import しています。これはヘキサゴナルアーキテクチャの境界を破壊し、以下のリスクを生みます:
  1. **変更波及**: ドメイン B の内部リファクタリングがドメイン A を破壊
  2. **循環依存**: ドメイン間の暗黙の依存グラフが複雑化
  3. **テスト困難**: モック対象が増え、テストセットアップが肥大化

  特に `users → ibd/plans/isp-editor/data/ispRepo` は最も深刻で、users ドメインが ibd の 3 階層深い内部実装に依存しています。
- **解決策の提案**:
  各ドメインの公開 API を `index.ts`（barrel）で明示し、ドメイン間は公開 API のみを参照する:

  ```typescript
  // src/features/ibd/index.ts (公開API)
  export type { GoalItem } from './plans/isp-editor/data/ispRepo';
  export { useISPComparisonEditor } from './plans/isp-editor/hooks/useISPComparisonEditor';

  // src/features/users/UserDetailSections/ISPSummarySection.tsx (修正後)
  import type { GoalItem } from '@/features/ibd';
  import { useISPComparisonEditor } from '@/features/ibd';
  ```

  また、ESLint の `no-restricted-imports` ルールを hardened モジュールに追加し、内部パスへの直接アクセスを CI で検出する。

  **段階的対応**:
  1. まず各ドメインに `index.ts` barrel を作成
  2. 既存の内部参照を barrel 経由に書き換え
  3. ESLint ルールで再発を防止
- **見積もり影響度**: High

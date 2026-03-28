This PR is the second phase of the schedules module hardening, focusing on structural relocation and responsibility visualization.
**Objective**: "Schedules Component/Hook relocation (Non-behavioral)" 

## 変更内容
肥大化していた `schedules` モジュール内の巨大ファイルや Hook を「解体・分割」する前に、まず安全に解体できる足場を用意するために適切なディレクトリへ「再配置」しました。

### 1. 巨大 Hook の再配置
それぞれの使われ方と責務に基づき、分類ラベルとして新しいディレクトリへ暫定移動しました。
- **`hooks/legacy/`**
  - `useSchedules.ts` (重複の疑いがある旧 CRUD 等)
  - `useSchedulesCrud.ts`
- **`hooks/orchestrators/`**
  - `useScheduleCreateForm.ts` 
  - `useWeekPageOrchestrator.ts`
- **`hooks/view-models/`**
  - `useSchedulesPageState.ts`
  - `useWeekPageRouteState.ts`
  - `useWeekPageUiState.ts`

### 2. 巨大 UI の再配置
主に Dialog と Section（Page内の大きな塊）を寄せる構造を敷きました。
- **`components/dialogs/`**
  - `ScheduleDialogManager.tsx`
  - `UserStatusQuickDialog.tsx`
  - `CreateScheduleDialog.tsx`
- **`components/sections/`**
  - `SchedulesHeader.tsx`
  - `ScheduleFilterBar.tsx`
  - `SchedulesFilterResponsive.tsx`
  - `SchedulesSpLane.tsx`
- **`components/timeline/`**
  - `TimelineItem.tsx`

### 3. 旧 `/schedule` 系の残骸への対応
- 現在は削除を見送り、今後 `legacy` として扱うか段階的に削除するための仕分けが完了しています。

## テスト状況
- [x] Type checks pass (`tsc --noEmit`)
- [x] 挙動変更なし
- [x] Import パスおよび依存関係参照の完全置換

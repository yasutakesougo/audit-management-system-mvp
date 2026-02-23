# Dashboard Registry 化の実装ガイド

## 完了した作業

✅ **Step 1: コンポーネント化**
- `HandoverSection.tsx` 作成（inline JSX を分離）
- `StatsSection.tsx` 作成（inline JSX を分離）
- `impl/index.ts` に export 追加

✅ **Step 2: Registry 作成**
- `registry.tsx` 作成（型で守る版）
- `SECTION_REGISTRY` で全キーカバーを保証
- `SectionProps` 型で各セクションの props を統合

## 次のステップ: DashboardPage.tsx の更新

### Before（switch 文 + inline JSX）

```typescript
// DashboardPage.tsx (現在)
const renderSection = useCallback((section: DashboardSection) => {
  switch (section.key) {
    case 'safety':
      return <SafetySection />;
    case 'attendance':
      return <AttendanceSection ... />;
    // ...
    case 'handover':
      return <Paper>...100行のJSX...</Paper>; // ❌ inline
    case 'stats':
      return <Stack>...80行のJSX...</Stack>;  // ❌ inline
    default:
      return assertNever(section.key);
  }
}, [/* 24個の依存 */]); // ❌ 依存爆発
```

### After（registry 参照）

```typescript
// DashboardPage.tsx (新)
import { getSectionComponent } from '@/features/dashboard/sections/registry';
import type { SectionProps } from '@/features/dashboard/sections/registry';

// ...

// ✨ セクション別の props を生成する関数
const getSectionProps = useCallback((key: DashboardSectionKey): SectionProps[typeof key] => {
  switch (key) {
    case 'safety':
      return {};
    case 'attendance':
      return {
        attendanceSummary,
        showAttendanceNames,
        onToggleAttendanceNames: setShowAttendanceNames,
      };
    case 'daily':
      return {
        dailyStatusCards,
        dailyRecordStatus,
      };
    case 'schedule':
      return {
        title: section.title,
        schedulesEnabled,
        scheduleLanesToday,
      };
    case 'handover':
      return {
        title: section.title,
        handoffTotal,
        handoffCritical,
        handoffStatus,
        onOpenTimeline: openTimeline,
      };
    case 'stats':
      return {
        stats,
        intensiveSupportUsersCount: intensiveSupportUsers.length,
      };
    case 'adminOnly':
      return {
        tabValue,
        onTabChange: handleTabChange,
        stats,
        intensiveSupportUsers,
        activeUsers: users,
        usageMap,
      };
    case 'staffOnly':
      return {
        isMorningTime,
        isEveningTime,
        dailyStatusCards,
        prioritizedUsers,
        scheduleLanesToday,
        scheduleLanesTomorrow,
        renderScheduleLanes,
        stats,
        onOpenTimeline: openTimeline,
      };
  }
}, [
  attendanceSummary,
  dailyStatusCards,
  dailyRecordStatus,
  handoffTotal,
  handoffCritical,
  handoffStatus,
  openTimeline,
  schedulesEnabled,
  scheduleLanesToday,
  stats,
  intensiveSupportUsers,
  tabValue,
  handleTabChange,
  users,
  usageMap,
  isMorningTime,
  isEveningTime,
  prioritizedUsers,
  scheduleLanesTomorrow,
  renderScheduleLanes,
]);

// ✨ Registry 参照でコンポーネントを取得
const renderSection = useCallback((section: DashboardSection) => {
  const SectionComponent = getSectionComponent(section.key);
  const props = getSectionProps(section.key);
  
  // ロール判定（adminOnly/staffOnly のみ）
  if (section.key === 'adminOnly' && vm.role !== 'admin') return null;
  if (section.key === 'staffOnly' && vm.role !== 'staff') return null;
  
  return <SectionComponent {...props} />;
}, [getSectionProps, vm.role]);
```

## メリット

### ✅ 型安全性の向上
- **全キーカバー保証**: `satisfies Record<DashboardSectionKey, ...>` で検証
- **props 型の一致**: `SectionProps[K]` で自動的に正しい型が推論される
- **コンパイル時エラー**: key 追加時に registry への追加を忘れたらエラー

### ✅ 保守性の向上
- **switch 文撲滅**: key と component の手動同期が不要
- **依存配列最適化**: props 生成だけに集中できる
- **コンポーネント分離**: handover/stats が独立し、Page が減量

### ✅ テスト容易性の向上
- **Section 単体テスト**: `HandoverSection` を個別にテスト可能
- **Props 生成テスト**: `getSectionProps` を unit test 可能
- **Registry テスト**: 全キーがカバーされているか検証可能

## 実装手順

1. `HandoverSection.tsx` のimportを `DashboardPage.tsx` から削除
2. `StatsSection.tsx` のimportを追加不要（registry経由で取得）
3. `renderSection` を上記の After版に置き換え
4. `getSectionProps` を追加（props 生成ロジック）
5. inline JSX（handover/stats）を削除
6. import を整理:
   ```typescript
   import { getSectionComponent } from '@/features/dashboard/sections/registry';
   import type { SectionProps } from '@/features/dashboard/sections/registry';
   ```

## 検証

```bash
# 型チェック
npm run typecheck

# ビルド
npm run build

# E2E テスト
npx playwright test tests/e2e/dashboard-minimal.spec.ts
```

## 次の改善（Phase 2）

1. **`getSectionProps` の分離**: `useDashboardSectionProps()` hook に移動
2. **Layout 切り出し**: `DashboardLayout.tsx` にZone分岐を移動
3. **集計ロジック分離**: `useDashboardSummary()` hook に移動

---

このように段階的に減量化することで、**責務分離**が進み、**テスト可能性**が向上し、**拡張性**が高まります。

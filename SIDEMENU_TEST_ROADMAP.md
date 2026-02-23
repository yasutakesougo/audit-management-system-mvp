# サイドメニュー テスト充実化ロードマップ

> **計画日**: 2026-02-23  
> **対象**: AppShell.tsx + navigationConfig.ts  
> **目標**: テストカバレッジ 45% → 80%  
> **推定工数**: 16-20 時間

---

## 📋 概要

### 現在のギャップ

```
Priority | Test Category           | Cases | Status  | 工数
────────────────────────────────────────────────────────────
🔴 高   | pickGroup() グループ分類  | 6    | ❌ なし | 2-3h
🔴 高   | Feature flags 条件分岐  | 8    | ❌ なし | 2-3h
🔴 高   | Role visibility 権限制御  | 4    | ⚠️ 部分 | 1-2h
🟡 中   | Search interaction 検索   | 5    | ❌ なし | 2-3h
🟡 中   | Mobile drawer 終了時動作  | 3    | ❌ なし | 1-2h
🟡 中   | Collapse/Expand toggle   | 4    | ❌ なし | 1-2h
🟡 中   | Prefetch link 動作        | 3    | ❌ なし | 2-3h
🟢 低   | Footer Quick Actions     | 5    | ❌ なし | 2-3h
        ────────────────────────────────────────────────
        合計 38 test cases           38    | 13%   | 16-20h
```

---

## 🧪 Phase 1: Core Logic Tests (2-3日間)

### Test Suite 1: `navigationConfig.spec.ts`

```typescript
// tests/unit/app/config/navigationConfig.spec.ts

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createNavItems,
  filterNavItems,
  groupNavItems,
  pickGroup,
  NAV_AUDIENCE,
  NAV_GROUP_ORDER,
  type NavItem,
  type CreateNavItemsConfig,
} from '@/app/config/navigationConfig';

describe('navigationConfig', () => {
  
  // ========================================================================
  // pickGroup() Tests - 6 Group Classification
  // ========================================================================

  describe('pickGroup', () => {
    
    describe('daily group', () => {
      it('should classify /dailysupport route as daily', () => {
        const item = { to: '/dailysupport', label: '日次記録', isActive: () => false };
        expect(pickGroup(item, false)).toBe('daily');
      });

      it('should classify /daily/* routes as daily', () => {
        const items = [
          { to: '/daily/health', label: '健康記録', isActive: () => false },
          { to: '/daily/activity', label: 'アクティビティ', isActive: () => false },
        ];
        items.forEach(item => {
          expect(pickGroup(item as any, false)).toBe('daily');
        });
      });

      it('should classify /handoff* routes as daily', () => {
        const item = { to: '/handoff-timeline', label: '申し送りタイムライン', isActive: () => false };
        expect(pickGroup(item, false)).toBe('daily');
      });

      it('should classify /meeting-minutes routes as daily', () => {
        const item = { to: '/meeting-minutes', label: '議事録アーカイブ', isActive: () => false };
        expect(pickGroup(item, false)).toBe('daily');
      });

      it('should classify items with daily keywords in label', () => {
        const items = [
          { to: '/custom', label: '日次情報', isActive: () => false },
          { to: '/custom', label: '健康チェック', isActive: () => false },
        ];
        items.forEach(item => {
          expect(pickGroup(item as any, false)).toBe('daily');
        });
      });
    });

    describe('record group', () => {
      it('should classify /records* routes as record', () => {
        const item = { to: '/records', label: '黒ノート一覧', isActive: () => false };
        expect(pickGroup(item, false)).toBe('record');
      });

      it('should classify /schedule* routes as record', () => {
        const item = { to: '/schedules/week', label: 'スケジュール', isActive: () => false };
        expect(pickGroup(item, false)).toBe('record');
      });

      it('should classify items with record keywords', () => {
        const item = { to: '/custom', label: '黒ノート', isActive: () => false };
        expect(pickGroup(item, false)).toBe('record');
      });
    });

    describe('review group', () => {
      it('should classify /analysis* routes as review', () => {
        const item = { to: '/analysis/dashboard', label: '分析', isActive: () => false };
        expect(pickGroup(item, false)).toBe('review');
      });

      it('should classify /assessment* routes as review', () => {
        const item = { to: '/assessment', label: 'アセスメント', isActive: () => false };
        expect(pickGroup(item, false)).toBe('review');
      });

      it('should classify /survey* routes as review', () => {
        const item = { to: '/survey/tokusei', label: '特性アンケート', isActive: () => false };
        expect(pickGroup(item, false)).toBe('review');
      });

      it('should classify items with review keywords', () => {
        const items = [
          { to: '/custom', label: '分析レポート', isActive: () => false },
          { to: '/custom', label: '氷山分析', isActive: () => false },
        ];
        items.forEach(item => {
          expect(pickGroup(item as any, false)).toBe('review');
        });
      });
    });

    describe('master group', () => {
      it('should classify /users* routes as master', () => {
        const item = { to: '/users', label: '利用者', isActive: () => false };
        expect(pickGroup(item, false)).toBe('master');
      });

      it('should classify /staff* routes as master (non-attendance)', () => {
        const item = { to: '/staff', label: '職員', isActive: () => false };
        expect(pickGroup(item, false)).toBe('master');
      });

      it('should classify items with master keywords', () => {
        const item = { to: '/custom', label: '利用者操作', isActive: () => false };
        expect(pickGroup(item, false)).toBe('master');
      });
    });

    describe('settings group', () => {
      it('should classify items with settings keywords', () => {
        const item = { to: '/settings', label: '表示設定', isActive: () => false };
        expect(pickGroup(item, false)).toBe('settings');
      });
    });

    describe('admin group', () => {
      it('should classify /admin* routes as admin when isAdmin=true', () => {
        const item = { to: '/admin/templates', label: '支援活動マスタ', isActive: () => false };
        expect(pickGroup(item, true)).toBe('admin');
      });

      it('should NOT classify /admin* routes as admin when isAdmin=false', () => {
        const item = { to: '/admin/templates', label: '支援活動マスタ', isActive: () => false };
        expect(pickGroup(item, false)).toBe('record'); // deafult
      });

      it('should classify /checklist routes as admin when isAdmin=true', () => {
        const item = { to: '/checklist', label: '自己点検', isActive: () => false };
        expect(pickGroup(item, true)).toBe('admin');
      });

      it('should classify /audit routes as admin when isAdmin=true', () => {
        const item = { to: '/audit', label: '監査ログ', isActive: () => false };
        expect(pickGroup(item, true)).toBe('admin');
      });

      it('should NOT classify admin items when isAdmin=false', () => {
        const item = { to: '/audit', label: '監査ログ', isActive: () => false };
        expect(pickGroup(item, false)).toBe('record'); // default
      });
    });

    describe('default group', () => {
      it('should default unknown items to record', () => {
        const item = { to: '/unknown', label: 'Unknown Page', isActive: () => false };
        expect(pickGroup(item, false)).toBe('record');
      });
    });
  });

  // ========================================================================
  // createNavItems() Tests - Feature Flags & Conditions
  // ========================================================================

  describe('createNavItems', () => {
    const baseConfig: CreateNavItemsConfig = {
      dashboardPath: '/dashboard',
      currentRole: 'staff',
      schedulesEnabled: false,
      complianceFormEnabled: false,
      icebergPdcaEnabled: false,
      staffAttendanceEnabled: false,
      isAdmin: false,
      authzReady: false,
      navAudience: 'staff',
      skipLogin: false,
    };

    it('should create basic items for all users', () => {
      const items = createNavItems(baseConfig);
      const labels = items.map(i => i.label);
      
      expect(labels).toContain('日次記録');
      expect(labels).toContain('健康記録');
      expect(labels).toContain('議事録アーカイブ');
    });

    it('should include staff items when audience=staff', () => {
      const config = { ...baseConfig, navAudience: 'staff' as const };
      const items = createNavItems(config);
      const labels = items.map(i => i.label);
      
      expect(labels).toContain('黒ノート一覧');
      expect(labels).toContain('月次記録');
      expect(labels).toContain('分析');
    });

    it('should include admin items when isAdmin=true and authzReady=true', () => {
      const config = { ...baseConfig, isAdmin: true, authzReady: true, navAudience: 'admin' as const };
      const items = createNavItems(config);
      const labels = items.map(i => i.label);
      
      expect(labels).toContain('自己点検');
      expect(labels).toContain('監査ログ');
      expect(labels).toContain('支援手順マスタ');
    });

    it('should include admin items when isAdmin=true and skipLogin=true', () => {
      const config = { ...baseConfig, isAdmin: true, skipLogin: true, navAudience: 'admin' as const };
      const items = createNavItems(config);
      const labels = items.map(i => i.label);
      
      expect(labels).toContain('自己点検');
    });

    describe('feature flags', () => {
      it('should include スケジュール when schedulesEnabled=true', () => {
        const config = { ...baseConfig, schedulesEnabled: true };
        const items = createNavItems(config);
        const labels = items.map(i => i.label);
        
        expect(labels).toContain('スケジュール');
      });

      it('should NOT include スケジュール when schedulesEnabled=false', () => {
        const config = { ...baseConfig, schedulesEnabled: false };
        const items = createNavItems(config);
        const labels = items.map(i => i.label);
        
        expect(labels).not.toContain('スケジュール');
      });

      it('should include 氷山PDCA when icebergPdcaEnabled=true', () => {
        const config = { ...baseConfig, icebergPdcaEnabled: true };
        const items = createNavItems(config);
        const labels = items.map(i => i.label);
        
        expect(labels).toContain('氷山PDCA');
      });

      it('should include 職員勤怠 when staffAttendanceEnabled=true', () => {
        const config = { ...baseConfig, staffAttendanceEnabled: true };
        const items = createNavItems(config);
        const labels = items.map(i => i.label);
        
        expect(labels).toContain('職員勤怠');
      });

      it('should include コンプラ報告 when complianceFormEnabled=true', () => {
        const config = { ...baseConfig, complianceFormEnabled: true };
        const items = createNavItems(config);
        const labels = items.map(i => i.label);
        
        expect(labels).toContain('コンプラ報告');
      });

      it('should handle multiple flags simultaneously', () => {
        const config = {
          ...baseConfig,
          schedulesEnabled: true,
          icebergPdcaEnabled: true,
          staffAttendanceEnabled: true,
          complianceFormEnabled: true,
        };
        const items = createNavItems(config);
        const labels = items.map(i => i.label);
        
        expect(labels).toContain('スケジュール');
        expect(labels).toContain('氷山PDCA');
        expect(labels).toContain('職員勤怠');
        expect(labels).toContain('コンプラ報告');
      });
    });

    it('should not include duplicate items', () => {
      const config = { ...baseConfig, icebergPdcaEnabled: true };
      const items = createNavItems(config);
      const labels = items.map(i => i.label);
      
      const duplicates = labels.filter((l, i) => labels.indexOf(l) !== i);
      expect(duplicates).toHaveLength(0);
    });
  });

  // ========================================================================
  // filterNavItems() Tests - Search Filtering
  // ========================================================================

  describe('filterNavItems', () => {
    const mockItems: NavItem[] = [
      {
        label: '日次記録',
        to: '/dailysupport',
        isActive: () => false,
      },
      {
        label: '黒ノート一覧',
        to: '/records',
        isActive: () => false,
      },
      {
        label: '分析',
        to: '/analysis/dashboard',
        isActive: () => false,
      },
      {
        label: 'アセスメント',
        to: '/assessment',
        isActive: () => false,
      },
    ];

    it('should return all items when query is empty', () => {
      expect(filterNavItems(mockItems, '')).toEqual(mockItems);
    });

    it('should return all items when query is whitespace', () => {
      expect(filterNavItems(mockItems, '   ')).toEqual(mockItems);
    });

    it('should filter items by keyword match', () => {
      const result = filterNavItems(mockItems, '記録');
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('日次記録');
    });

    it('should perform case-insensitive search', () => {
      const result = filterNavItems(mockItems, 'アセスメント');
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('アセスメント');
    });

    it('should filter multiple results', () => {
      const result = filterNavItems(mockItems, 'ノート');
      expect(result).toHaveLength(1);
      expect(result[0].label).toBe('黒ノート一覧');
    });

    it('should return empty array when no match', () => {
      const result = filterNavItems(mockItems, 'zzz');
      expect(result).toHaveLength(0);
    });
  });

  // ========================================================================
  // groupNavItems() Tests - Group Classification & Ordering
  // ========================================================================

  describe('groupNavItems', () => {
    const mockItems: NavItem[] = [
      { label: '日次記録', to: '/dailysupport', isActive: () => false, testId: 'nav-daily' },
      { label: '黒ノート一覧', to: '/records', isActive: () => false },
      { label: '分析', to: '/analysis/dashboard', isActive: () => false, testId: 'nav-analysis' },
      { label: '利用者', to: '/users', isActive: () => false },
      { label: '自己点検', to: '/checklist', isActive: () => false, testId: 'nav-checklist' },
    ];

    it('should group items correctly', () => {
      const result = groupNavItems(mockItems, true);
      
      expect(result.map.get('daily')).toHaveLength(1);
      expect(result.map.get('record')).toHaveLength(1);
      expect(result.map.get('review')).toHaveLength(1);
      expect(result.map.get('master')).toHaveLength(1);
      expect(result.map.get('admin')).toHaveLength(1);
    });

    it('should maintain correct order', () => {
      const result = groupNavItems(mockItems, false);
      expect(result.ORDER).toEqual(['daily', 'record', 'review', 'master', 'admin', 'settings']);
    });

    it('should handle empty groups', () => {
      const result = groupNavItems([], false);
      
      expect(result.map.get('daily')).toEqual([]);
      expect(result.map.get('settings')).toEqual([]);
    });

    it('should exclude admin items when isAdmin=false', () => {
      const result = groupNavItems(mockItems, false);
      expect(result.map.get('admin')).toHaveLength(0);
    });

    it('should include admin items when isAdmin=true', () => {
      const result = groupNavItems(mockItems, true);
      expect(result.map.get('admin')).toHaveLength(1);
    });
  });
});
```

**実装工数**: 6-8 時間  
**テストケース**: 38 個

---

### Test Suite 2: `AppShell.nav.spec.tsx` (拡張版)

```typescript
// tests/unit/AppShell.nav.spec.tsx (append to existing)

describe('AppShell - Navigation Interaction', () => {
  
  describe('Search behavior', () => {
    it('should update filteredNavItems when search query changes', async () => {
      // ... existing test: verify search triggers filter
    });

    it('should navigate to first item on Enter key', async () => {
      // Arrange: render with search query
      // Act: press Enter
      // Assert: navigate() called with first item route
    });

    it('should clear search on Escape key', async () => {
      // Arrange: search query set
      // Act: press Escape
      // Assert: navQuery cleared
    });

    it('should handle empty search results', () => {
      // Arrange: search query with no match
      // Assert: "該当なし" message shown
    });

    it('should be case-insensitive', () => {
      // Test: 'アセスメント' and 'ASSESSMENT' both work
    });
  });

  describe('Collapse/Expand toggle', () => {
    it('should toggle navCollapsed state', async () => {
      // Act: click toggle button
      // Assert: navCollapsed flips true/false
    });

    it('should hide search field when collapsed', () => {
      // Arrange: navCollapsed = true
      // Assert: search TextField not visible
    });

    it('should hide labels when collapsed', () => {
      // Arrange: navCollapsed = true
      // Assert: ListItemText (labels) not visible
      // Assert: Tooltip shown for icons only
    });

    it('should reset search when collapsing', () => {
      // Arrange: navQuery set
      // Act: click toggle
      // Assert: navQuery cleared
    });

    it('should change drawer width dynamically', () => {
      // Arrange: monitor currentDrawerWidth
      // Act: toggle collapse
      // Assert: width changed from 240 to 64 (or vice versa)
    });
  });

  describe('Mobile drawer', () => {
    beforeEach(() => {
      // Mock useMediaQuery to return false (mobile view)
      vi.mock('@mui/material/useMediaQuery', () => ({
        default: () => false,
      }));
    });

    it('should open mobile drawer on hamburger click', async () => {
      // Act: click hamburger menu button
      // Assert: mobileOpen = true
    });

    it('should close mobile drawer on item click', async () => {
      // Arrange: mobileOpen = true
      // Act: click nav item
      // Assert: mobileOpen = false
      // Assert: navQuery cleared
    });

    it('should close mobile drawer on clicking outside', async () => {
      // Act: Drawer onClose triggered
      // Assert: mobileOpen = false
    });

    it('should show search field in mobile drawer', () => {
      // Arrange: mobileOpen = true
      // Assert: search TextField visible
    });
  });

  describe('Prefetch links', () => {
    it('should render NavLinkPrefetch when prefetchKey exists', () => {
      // Arrange: item with prefetchKey
      // Assert: component is NavLinkPrefetch
    });

    it('should render RouterLink when prefetchKey missing', () => {
      // Arrange: item without prefetchKey
      // Assert: component is RouterLink
    });

    it('should pass preloadKey prop to NavLinkPrefetch', () => {
      // Assert: NavLinkPrefetch receives preloadKey={prefetchKey}
    });

    it('should pass preloadKeys array when provided', () => {
      // Assert: NavLinkPrefetch receives preloadKeys array
    });
  });

  describe('Focus Mode', () => {
    it('should hide sidebar in focus mode', () => {
      // Arrange: layoutMode === 'focus'
      // Assert: sidebarContent is null
    });

    it('should show FAB button to exit focus mode', () => {
      // Arrange: isFocusMode = true
      // Assert: FAB with CloseFullscreenRoundedIcon visible
    });

    it('should hide header in focus mode', () => {
      // Arrange: isFocusMode = true
      // Assert: headerContent is null
    });

    it('should call updateSettings on FAB click', async () => {
      // Act: click FAB
      // Assert: updateSettings({ layoutMode: 'normal' }) called
    });
  });
});
```

**実装工数**: 8-10 時間  
**テストケース**: 20 個 (追加)

---

### 実装チェックリスト（Phase 1）

```
□ pickGroup() 6グループ             6 cases
□ createNavItems() 基本              12 cases
□ createNavItems() フラグ条件        8 cases
□ filterNavItems()                  5 cases
□ groupNavItems() 順序・グループ化    4 cases
□ Search キーボード操作              5 cases
□ Collapse/Expand toggle            5 cases
□ Mobile drawer 動作                3 cases
□ Prefetch link 処理                4 cases
────────────────────────────────────────
合計: 52 test cases | 工数: 16-20h
```

---

## ✅ 実装手順

### ステップ 1: navigationConfig.spec.ts 作成

```bash
# ファイル作成
touch tests/unit/app/config/navigationConfig.spec.ts

# テスト実行
npm test -- navigationConfig.spec.ts

# 工数: 6-8 時間
```

### ステップ 2: AppShell.nav.spec.tsx 拡張

```bash
# 既存テストに追加
# (AppShell.nav.spec.tsx に新しい describe ブロック追加)

# テスト実行
npm test -- AppShell.nav.spec.tsx

# 工数: 8-10 時間
```

### ステップ 3: カバレッジ測定

```bash
# カバレッジレポート生成
npm test -- --coverage navigationConfig.spec.ts AppShell.nav.spec.tsx

# 目標: pickGroup() > 95%, createNavItems() > 90%
```

---

## 📊 成功基準

| KPI | 目標 | 測定方法 |
|-----|------|---------|
| テストケース | 50+ | `npm test -- --listTests` |
| カバレッジ・ライン | >80% | `--coverage` flag |
| パス率 | 100% | CI 実行 |
| 実装工数 | 16-20h | チームメンバーが計測 |

---

## 📚 参考資料

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [MUI Testing Guide](https://mui.com/material-ui/guides/testing/)

---

**作成**: 2026-02-23  
**計画者**: Test Team Lead  
**ステータス**: 実装準備完了 ✅

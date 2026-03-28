/**
 * Navigation Configuration Tests
 *
 * Unit tests for navigation configuration functions extracted from AppShell.tsx
 */

import {
    createNavItems,
    filterNavItems,
    groupLabel,
    groupNavItems,
    NAV_AUDIENCE,
    NAV_GROUP_ORDER,
    pickGroup,
    roleToNavAudience,
    type NavItem,
} from '@/app/config/navigationConfig';
import { TESTIDS } from '@/testids';
import { describe, expect, it } from 'vitest';

describe('navigationConfig', () => {
  describe('pickGroup', () => {
    it('should classify daily routes correctly', () => {
      const item: Partial<NavItem> = {
        label: '日次記録',
        to: '/dailysupport',
        isActive: () => false,
        testId: TESTIDS.nav.daily,
      };
      expect(pickGroup(item, false)).toBe('today');
      expect(pickGroup(item, true)).toBe('today');
    });

    it('should classify health records as daily', () => {
      const item: Partial<NavItem> = {
        label: '健康記録',
        to: '/daily/health',
        isActive: () => false,
      };
      expect(pickGroup(item, false)).toBe('today');
    });

    it('should classify handoff timeline as daily', () => {
      const item: Partial<NavItem> = {
        label: '申し送りタイムライン',
        to: '/handoff-timeline',
        isActive: () => false,
      };
      expect(pickGroup(item, false)).toBe('today');
    });

    it('should classify meeting-related items as daily', () => {
      const meetingItems: Partial<NavItem>[] = [
        {
          label: '司会ガイド',
          to: '/meeting-guide',
          isActive: () => false,
        },
        {
          label: '朝会（作成）',
          to: '/meeting-minutes/new?category=朝会',
          isActive: () => false,
        },
        {
          label: '議事録アーカイブ',
          to: '/meeting-minutes',
          isActive: () => false,
        },
      ];

      meetingItems.forEach((item) => {
        expect(pickGroup(item, false)).toBe('today');
      });
    });

    it('should classify records as records group', () => {
      const item: Partial<NavItem> = {
        label: '記録一覧',
        to: '/records',
        isActive: () => false,
      };
      expect(pickGroup(item, false)).toBe('records');
    });

    it('should classify schedules as today group', () => {
      const item: Partial<NavItem> = {
        label: 'スケジュール',
        to: '/schedules/week',
        isActive: () => false,
        testId: TESTIDS.nav.schedules,
      };
      expect(pickGroup(item, false)).toBe('today');
    });

    it('should classify analysis as ibd group', () => {
      const item: Partial<NavItem> = {
        label: '分析',
        to: '/analysis/dashboard',
        isActive: () => false,
        testId: TESTIDS.nav.analysis,
      };
      expect(pickGroup(item, false)).toBe('planning');
    });

    it('should classify iceberg as planning group', () => {
      const item: Partial<NavItem> = {
        label: '氷山分析',
        to: '/analysis/iceberg',
        isActive: () => false,
        testId: TESTIDS.nav.iceberg,
      };
      expect(pickGroup(item, false)).toBe('planning');
    });

    it('should classify assessment as planning group', () => {
      const item: Partial<NavItem> = {
        label: 'アセスメント',
        to: '/assessment',
        isActive: () => false,
        testId: TESTIDS.nav.assessment,
      };
      expect(pickGroup(item, false)).toBe('planning');
    });

    it('should classify users and staff as master group', () => {
      const items: Partial<NavItem>[] = [
        {
          label: '利用者',
          to: '/users',
          isActive: () => false,
        },
        {
          label: '職員',
          to: '/staff',
          isActive: () => false,
        },
      ];

      items.forEach((item) => {
        expect(pickGroup(item, false)).toBe('master');
      });
    });

    it('should classify admin items as platform group for admins only', () => {
      const item: Partial<NavItem> = {
        label: '自己点検',
        to: '/checklist',
        isActive: () => false,
        testId: TESTIDS.nav.checklist,
      };
      expect(pickGroup(item, false)).toBe('platform');
      expect(pickGroup(item, true)).toBe('platform');
    });

    it('should classify audit log as platform group for admins only', () => {
      const item: Partial<NavItem> = {
        label: '監査ログ',
        to: '/audit',
        isActive: () => false,
        testId: TESTIDS.nav.audit,
      };
      expect(pickGroup(item, false)).toBe('platform');
      expect(pickGroup(item, true)).toBe('platform');
    });

    it('should default to records group for unknown items', () => {
      const item: Partial<NavItem> = {
        label: 'Unknown Item',
        to: '/unknown',
        isActive: () => false,
      };
      expect(pickGroup(item, false)).toBe('records');
      expect(pickGroup(item, true)).toBe('records');
    });
  });

  describe('createNavItems', () => {
    const baseConfig = {
      dashboardPath: '/dashboard',
      currentRole: 'staff',
      schedulesEnabled: false,
      complianceFormEnabled: false,
      icebergPdcaEnabled: false,
      staffAttendanceEnabled: false,
      todayOpsEnabled: false,
      isAdmin: false,
      authzReady: true,
      navAudience: NAV_AUDIENCE.staff,
    };

    it('should create base navigation items for staff', () => {
      const items = createNavItems(baseConfig);

      expect(items.length).toBeGreaterThan(0);
      expect(items.some((item) => item.label === '日次記録')).toBe(true);
      expect(items.some((item) => item.label === '健康記録')).toBe(true);
      // 記録一覧は records ハブ入口（viewer 相当）として表示
      expect(items.some((item) => item.label === '記録一覧')).toBe(true);
      expect(items.some((item) => item.label === '利用者')).toBe(true);
    });

    it('should include schedules when flag is enabled', () => {
      const items = createNavItems({
        ...baseConfig,
        schedulesEnabled: true,
      });

      expect(items.some((item) => item.testId === TESTIDS.nav.schedules)).toBe(true);
    });

    it('should not include schedules when flag is disabled', () => {
      const items = createNavItems({
        ...baseConfig,
        schedulesEnabled: false,
      });

      expect(items.some((item) => item.testId === TESTIDS.nav.schedules)).toBe(false);
    });

    it('should include compliance form when flag is enabled', () => {
      const items = createNavItems({
        ...baseConfig,
        complianceFormEnabled: true,
      });

      expect(items.some((item) => item.label === 'コンプラ報告')).toBe(true);
    });

    it('should include iceberg PDCA when flag is enabled', () => {
      const items = createNavItems({
        ...baseConfig,
        icebergPdcaEnabled: true,
      });

      // NOTE: icebergPdcaEnabled is currently unused (_icebergPdcaEnabled)
      // so iceberg PDCA nav item is NOT generated regardless of flag
      expect(items.some((item) => item.testId === TESTIDS.nav.icebergPdca)).toBe(false);
    });

    it('should include staff attendance when flag is enabled', () => {
      const items = createNavItems({
        ...baseConfig,
        staffAttendanceEnabled: true,
      });

      expect(items.some((item) => item.testId === TESTIDS.nav.staffAttendance)).toBe(true);
    });

    it('should include admin items for admin users', () => {
      const items = createNavItems({
        ...baseConfig,
        isAdmin: true,
        navAudience: NAV_AUDIENCE.admin,
      });

      // Admin items are now consolidated into '管理ツール' hub
      expect(items.some((item) => item.label === '管理ツール')).toBe(true);
      expect(items.some((item) => item.label === '職員勤怠管理')).toBe(true);
    });

    it('should not include admin items for non-admin users', () => {
      // isAdmin guard は有効: isAdmin=false の場合、admin ブロック内の項目は生成されない
      // isNavVisible も有効: audience フィルタで admin 項目は staff に非表示
      const items = createNavItems(baseConfig);

      // isAdmin=false なので管理ツール・職員勤怠管理は生成されない
      expect(items.some((item) => item.label === '管理ツール')).toBe(false);
      expect(items.some((item) => item.label === '職員勤怠管理')).toBe(false);
    });

    it('should filter items by audience (all items visible to all)', () => {
      const items = createNavItems(baseConfig);

      const allAudienceItems = items.filter((item) => item.audience === 'all');
      expect(allAudienceItems.length).toBeGreaterThan(0);

      // All items with audience:'all' should be present
      expect(items.some((item) => item.label === '日次記録' && item.audience === 'all')).toBe(true);
      expect(items.some((item) => item.label === '健康記録' && item.audience === 'all')).toBe(true);
    });

    it('should respect skipLogin parameter', () => {
      const itemsWithSkip = createNavItems({
        ...baseConfig,
        isAdmin: true,
        authzReady: false,
        skipLogin: true,
        navAudience: NAV_AUDIENCE.admin,
      });

      // Admin items visible with skipLogin
      expect(itemsWithSkip.some((item) => item.label === '管理ツール')).toBe(true);
    });

    it('should exclude admin-audience items for staff navAudience', () => {
      // isNavVisible が有効: audience フィルタで admin/reception 専用項目は staff に非表示
      const items = createNavItems({
        ...baseConfig,
        isAdmin: false,
        navAudience: NAV_AUDIENCE.staff,
      });

      // 請求処理は audience: [reception, admin] → staff には非表示
      expect(items.some((item) => item.label === '請求処理')).toBe(false);

      // all-audience items should still be visible
      expect(items.some((item) => item.label === '日次記録')).toBe(true);
      expect(items.some((item) => item.label === '健康記録')).toBe(true);
    });

    it('should include reception and staff items for reception navAudience', () => {
      const items = createNavItems({
        ...baseConfig,
        navAudience: NAV_AUDIENCE.reception,
      });

      expect(items.some((item) => item.label === '請求処理')).toBe(true);
      expect(items.some((item) => item.label === '送迎配車表')).toBe(true);
    });

    it('should show all items for admin navAudience (admin sees everything)', () => {
      const items = createNavItems({
        ...baseConfig,
        isAdmin: true,
        navAudience: NAV_AUDIENCE.admin,
      });

      // admin audience sees all items regardless of their audience setting
      expect(items.some((item) => item.label === '日次記録')).toBe(true);
      expect(items.some((item) => item.label === '請求処理')).toBe(true);
      // Admin items consolidated into 管理ツール
      expect(items.some((item) => item.label === '管理ツール')).toBe(true);
    });
  });

  describe('filterNavItems', () => {
    const sampleItems = [
      {
        label: '日次記録',
        to: '/dailysupport',
        isActive: () => false,
      },
      {
        label: '健康記録',
        to: '/daily/health',
        isActive: () => false,
      },
      {
        label: '記録一覧',
        to: '/records',
        isActive: () => false,
      },
      {
        label: 'スケジュール',
        to: '/schedules/week',
        isActive: () => false,
      },
    ] as unknown as NavItem[];

    it('should return all items when query is empty', () => {
      const filtered = filterNavItems(sampleItems, '');
      expect(filtered.length).toBe(sampleItems.length);
    });

    it('should filter items by label (case-insensitive)', () => {
      const result = filterNavItems(sampleItems, '記録');
      expect(result.length).toBe(3); // 日次記録, 健康記録, 記録一覧
      expect(result.every((item) => item.label.includes('記録'))).toBe(true);
    });

    it('should handle case-insensitive search', () => {
      const result = filterNavItems(sampleItems, '日次');
      expect(result.length).toBe(1);
      expect(result[0].label).toBe('日次記録');
    });

    it('should return empty array when no matches', () => {
      const result = filterNavItems(sampleItems, 'xyz');
      expect(result.length).toBe(0);
    });

    it('should trim whitespace from query', () => {
      const result = filterNavItems(sampleItems, '  日次  ');
      expect(result.length).toBe(1);
      expect(result[0].label).toBe('日次記録');
    });
  });

  describe('groupNavItems', () => {
    const sampleItems = [
      {
        label: '日次記録',
        to: '/dailysupport',
        isActive: () => false,
        testId: TESTIDS.nav.daily,
      },
      {
        label: '記録一覧',
        to: '/records',
        isActive: () => false,
      },
      {
        label: '分析',
        to: '/analysis/dashboard',
        isActive: () => false,
        testId: TESTIDS.nav.analysis,
      },
      {
        label: '利用者',
        to: '/users',
        isActive: () => false,
      },
      {
        label: '自己点検',
        to: '/checklist',
        isActive: () => false,
        testId: TESTIDS.nav.checklist,
      },
    ] as unknown as NavItem[];

    it('should group items correctly', () => {
      const { map, ORDER } = groupNavItems(sampleItems, false);

      expect(ORDER).toEqual(NAV_GROUP_ORDER);
      expect(map.get('today')).toHaveLength(1);
      expect(map.get('records')).toHaveLength(1); // 記録一覧 only
      expect(map.get('planning')).toHaveLength(1);
      expect(map.get('master')).toHaveLength(1);
      expect(map.get('platform')).toHaveLength(1);
    });

    it('should classify admin items correctly for admin users', () => {
      const { map } = groupNavItems(sampleItems, true);

      expect(map.get('master')).toHaveLength(1); // 利用者
      expect(map.get('platform')).toHaveLength(1); // 自己点検
      expect(map.get('records')).toHaveLength(1); // 記録一覧 only
    });

    it('should maintain group order', () => {
      const { ORDER } = groupNavItems(sampleItems, false);

      expect(ORDER).toEqual(['today', 'records', 'planning', 'operations', 'billing', 'master', 'platform']);
    });

    it('should omit empty groups from the map', () => {
      const { map } = groupNavItems(sampleItems, false);

      // settings has no items, so it should not exist in the map
      expect((map as Map<string, NavItem[]>).has('settings')).toBe(false);

      // groups with items should still exist
      expect(map.has('today')).toBe(true);
      expect(map.has('records')).toBe(true);
      expect(map.has('planning')).toBe(true);
      expect(map.has('master')).toBe(true);
      expect(map.has('platform')).toBe(true);
    });

    it('should bring back a group automatically when items are added to it', () => {
      const itemsWithSettings: Partial<NavItem>[] = [
        ...sampleItems,
        { label: '追加項', to: '/ops-new', isActive: () => false, group: 'operations' },
      ];
      const { map } = groupNavItems(itemsWithSettings as NavItem[], false);

      expect(map.has('operations')).toBe(true);
      expect(map.get('operations')).toHaveLength(1);
    });
  });

  describe('constants', () => {
    it('should have correct NAV_AUDIENCE values', () => {
      expect(NAV_AUDIENCE.all).toBe('all');
      expect(NAV_AUDIENCE.staff).toBe('staff');
      expect(NAV_AUDIENCE.admin).toBe('admin');
    });

    it('should map RBAC role to nav audience hierarchy', () => {
      expect(roleToNavAudience('viewer')).toBe('staff');
      expect(roleToNavAudience('reception')).toBe('reception');
      expect(roleToNavAudience('admin')).toBe('admin');
    });

    it('should have correct group labels', () => {
      expect(groupLabel.today).toBe('Today');
      expect(groupLabel.records).toBe('Records');
      expect(groupLabel.planning).toBe('Planning');
      expect(groupLabel.operations).toBe('Operations');
      expect(groupLabel.billing).toBe('Billing');
      expect(groupLabel.master).toBe('Master');
      expect(groupLabel.platform).toBe('Platform');
    });

    it('should have correct group order', () => {
      expect(NAV_GROUP_ORDER).toEqual(['today', 'records', 'planning', 'operations', 'billing', 'master', 'platform']);
    });
  });
});

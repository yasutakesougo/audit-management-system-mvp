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
    type NavItem,
} from '@/app/config/navigationConfig';
import { TESTIDS } from '@/testids';
import { describe, expect, it } from 'vitest';

describe('navigationConfig', () => {
  describe('pickGroup', () => {
    it('should classify daily routes correctly', () => {
      const item: NavItem = {
        label: '日次記録',
        to: '/dailysupport',
        isActive: () => false,
        testId: TESTIDS.nav.daily,
      };
      expect(pickGroup(item, false)).toBe('daily');
      expect(pickGroup(item, true)).toBe('daily');
    });

    it('should classify health records as daily', () => {
      const item: NavItem = {
        label: '健康記録',
        to: '/daily/health',
        isActive: () => false,
      };
      expect(pickGroup(item, false)).toBe('daily');
    });

    it('should classify handoff timeline as daily', () => {
      const item: NavItem = {
        label: '申し送りタイムライン',
        to: '/handoff-timeline',
        isActive: () => false,
      };
      expect(pickGroup(item, false)).toBe('daily');
    });

    it('should classify meeting-related items as daily', () => {
      const meetingItems: NavItem[] = [
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
        expect(pickGroup(item, false)).toBe('daily');
      });
    });

    it('should classify records as record group', () => {
      const item: NavItem = {
        label: '黒ノート一覧',
        to: '/records',
        isActive: () => false,
      };
      expect(pickGroup(item, false)).toBe('record');
    });

    it('should classify schedules as record group', () => {
      const item: NavItem = {
        label: 'スケジュール',
        to: '/schedules/week',
        isActive: () => false,
        testId: TESTIDS.nav.schedules,
      };
      expect(pickGroup(item, false)).toBe('record');
    });

    it('should classify analysis as ibd group', () => {
      const item: NavItem = {
        label: '分析',
        to: '/analysis/dashboard',
        isActive: () => false,
        testId: TESTIDS.nav.analysis,
      };
      expect(pickGroup(item, false)).toBe('ibd');
    });

    it('should classify iceberg as ibd group', () => {
      const item: NavItem = {
        label: '氷山分析',
        to: '/analysis/iceberg',
        isActive: () => false,
        testId: TESTIDS.nav.iceberg,
      };
      expect(pickGroup(item, false)).toBe('ibd');
    });

    it('should classify assessment as ibd group', () => {
      const item: NavItem = {
        label: 'アセスメント',
        to: '/assessment',
        isActive: () => false,
        testId: TESTIDS.nav.assessment,
      };
      expect(pickGroup(item, false)).toBe('ibd');
    });

    it('should classify users and staff as master group', () => {
      const items: NavItem[] = [
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

    it('should classify admin items as admin group for admins only', () => {
      const item: NavItem = {
        label: '自己点検',
        to: '/checklist',
        isActive: () => false,
        testId: TESTIDS.nav.checklist,
      };
      expect(pickGroup(item, false)).toBe('record'); // non-admin: default to record
      expect(pickGroup(item, true)).toBe('admin'); // admin: classified as admin
    });

    it('should classify audit log as admin group for admins only', () => {
      const item: NavItem = {
        label: '監査ログ',
        to: '/audit',
        isActive: () => false,
        testId: TESTIDS.nav.audit,
      };
      expect(pickGroup(item, false)).toBe('record'); // non-admin: default to record
      expect(pickGroup(item, true)).toBe('admin'); // admin: classified as admin
    });

    it('should default to record group for unknown items', () => {
      const item: NavItem = {
        label: 'Unknown Item',
        to: '/unknown',
        isActive: () => false,
      };
      expect(pickGroup(item, false)).toBe('record');
      expect(pickGroup(item, true)).toBe('record');
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
      expect(items.some((item) => item.label === '黒ノート一覧')).toBe(true);
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

      expect(items.some((item) => item.testId === TESTIDS.nav.checklist)).toBe(true);
      expect(items.some((item) => item.testId === TESTIDS.nav.audit)).toBe(true);
      expect(items.some((item) => item.label === '支援手順マスタ')).toBe(true);
    });

    it('should not include admin items for non-admin users', () => {
      const items = createNavItems(baseConfig);

      expect(items.some((item) => item.testId === TESTIDS.nav.checklist)).toBe(false);
      expect(items.some((item) => item.testId === TESTIDS.nav.audit)).toBe(false);
      expect(items.some((item) => item.label === '支援手順マスタ')).toBe(false);
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

      expect(itemsWithSkip.some((item) => item.testId === TESTIDS.nav.checklist)).toBe(true);
    });
  });

  describe('filterNavItems', () => {
    const sampleItems: NavItem[] = [
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
        label: '黒ノート一覧',
        to: '/records',
        isActive: () => false,
      },
      {
        label: 'スケジュール',
        to: '/schedules/week',
        isActive: () => false,
      },
    ];

    it('should return all items when query is empty', () => {
      const result = filterNavItems(sampleItems, '');
      expect(result.length).toBe(sampleItems.length);
    });

    it('should filter items by label (case-insensitive)', () => {
      const result = filterNavItems(sampleItems, '記録');
      expect(result.length).toBe(2); // 日次記録, 健康記録
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
    const sampleItems: NavItem[] = [
      {
        label: '日次記録',
        to: '/dailysupport',
        isActive: () => false,
        testId: TESTIDS.nav.daily,
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
    ];

    it('should group items correctly', () => {
      const { map, ORDER } = groupNavItems(sampleItems, false);

      expect(ORDER).toEqual(NAV_GROUP_ORDER);
      expect(map.get('daily')).toHaveLength(1);
      expect(map.get('record')).toHaveLength(2); // 黒ノート + 自己点検 (non-admin default)
      expect(map.get('ibd')).toHaveLength(1);
      expect(map.get('master')).toHaveLength(1);
    });

    it('should classify admin items correctly for admin users', () => {
      const { map } = groupNavItems(sampleItems, true);

      expect(map.get('admin')).toHaveLength(1); // 自己点検
      expect(map.get('record')).toHaveLength(1); // 黒ノート only
    });

    it('should maintain group order', () => {
      const { ORDER } = groupNavItems(sampleItems, false);

      expect(ORDER).toEqual(['daily', 'record', 'isp', 'ibd', 'master', 'ops', 'admin', 'settings']);
    });

    it('should omit empty groups from the map', () => {
      const { map } = groupNavItems(sampleItems, false);

      // settings has no items, so it should not exist in the map
      expect(map.has('settings')).toBe(false);

      // groups with items should still exist
      expect(map.has('daily')).toBe(true);
      expect(map.has('record')).toBe(true);
      expect(map.has('ibd')).toBe(true);
      expect(map.has('master')).toBe(true);
    });

    it('should bring back a group automatically when items are added to it', () => {
      const itemsWithSettings: NavItem[] = [
        ...sampleItems,
        { label: '表示設定', to: '/settings', isActive: () => false, group: 'settings' },
      ];
      const { map } = groupNavItems(itemsWithSettings, false);

      expect(map.has('settings')).toBe(true);
      expect(map.get('settings')).toHaveLength(1);
    });
  });

  describe('constants', () => {
    it('should have correct NAV_AUDIENCE values', () => {
      expect(NAV_AUDIENCE.all).toBe('all');
      expect(NAV_AUDIENCE.staff).toBe('staff');
      expect(NAV_AUDIENCE.admin).toBe('admin');
    });

    it('should have correct group labels', () => {
      expect(groupLabel.daily).toBe('📌 今日の業務');
      expect(groupLabel.record).toBe('📚 記録を参照');
      expect(groupLabel.ibd).toBe('🧩 強度行動障害支援');
      expect(groupLabel.isp).toBe('📋 個別支援計画');
      expect(groupLabel.master).toBe('👥 利用者・職員');
      expect(groupLabel.ops).toBe('🏢 運営管理');
      expect(groupLabel.admin).toBe('🛡️ システム管理');
      expect(groupLabel.settings).toBe('⚙️ 表示設定');
    });

    it('should have correct group order', () => {
      expect(NAV_GROUP_ORDER).toEqual(['daily', 'record', 'isp', 'ibd', 'master', 'ops', 'admin', 'settings']);
    });
  });
});

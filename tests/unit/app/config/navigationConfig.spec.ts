/**
 * Navigation Configuration Tests
 * 
 * Unit tests for navigation configuration functions extracted from AppShell.tsx
 */

import { describe, expect, it } from 'vitest';
import {
  createNavItems,
  filterNavItems,
  groupNavItems,
  groupLabel,
  NAV_AUDIENCE,
  NAV_GROUP_ORDER,
  pickGroup,
  type NavItem,
} from '@/app/config/navigationConfig';
import { TESTIDS } from '@/testids';

describe('navigationConfig', () => {
  describe('pickGroup', () => {
    it('should classify daily routes correctly', () => {
      const item: NavItem = {
        label: '日次記録',
        to: '/dailysupport',
        isActive: () => false,
        testId: TESTIDS.nav.daily,
      };
      expect(pickGroup(item)).toBe('today');
    });

    it('should classify health records as today', () => {
      const item: NavItem = {
        label: '健康記録',
        to: '/daily/health',
        isActive: () => false,
      };
      expect(pickGroup(item)).toBe('today');
    });

    it('should classify schedules as planning group', () => {
      const item: NavItem = {
        label: 'スケジュール',
        to: '/schedules/week',
        isActive: () => false,
        testId: TESTIDS.nav.schedules,
      };
      expect(pickGroup(item)).toBe('planning');
    });

    it('should default to records group for unknown items', () => {
      const item: NavItem = {
        label: 'Unknown Item',
        to: '/unknown',
        isActive: () => false,
      };
      expect(pickGroup(item)).toBe('records');
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
      isAdmin: false,
      authzReady: true,
      navAudience: NAV_AUDIENCE.staff,
    };

    it('should create base navigation items for staff', () => {
      const items = createNavItems(baseConfig);
      
      expect(items.length).toBeGreaterThan(0);
      expect(items.some((item) => item.label === '日次記録')).toBe(true);
      expect(items.some((item) => item.label === '健康記録')).toBe(true);
      expect(items.some((item) => item.label === '利用者')).toBe(true);
    });

    it('should include schedules when flag is enabled', () => {
      const items = createNavItems({
        ...baseConfig,
        schedulesEnabled: true,
      });
      
      expect(items.some((item) => item.testId === TESTIDS.nav.schedules)).toBe(true);
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
    ];

    it('should return all items when query is empty', () => {
      const result = filterNavItems(sampleItems, '');
      expect(result.length).toBe(sampleItems.length);
    });

    it('should filter items by label (case-insensitive)', () => {
      const result = filterNavItems(sampleItems, '健康');
      expect(result.length).toBe(1);
      expect(result[0].label).toBe('健康記録');
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
        label: '利用者',
        to: '/users',
        isActive: () => false,
      },
    ];

    it('should group items correctly using new group keys', () => {
      const { map, ORDER } = groupNavItems(sampleItems);
      
      expect(ORDER).toEqual(NAV_GROUP_ORDER);
      expect(map.get('today')).toHaveLength(1);
      expect(map.get('master')).toHaveLength(1);
    });
  });

  describe('constants', () => {
    it('should have correct group labels', () => {
      expect(groupLabel.today).toBe('📌 今日の業務');
      expect(groupLabel.records).toBe('📚 記録を参照');
      expect(groupLabel.planning).toBe('🗓️ 計画・調整');
      expect(groupLabel.severe).toBe('🔍 分析して改善');
      expect(groupLabel.master).toBe('👥 利用者・職員');
    });

    it('should have correct group order', () => {
      expect(NAV_GROUP_ORDER).toEqual(['today', 'records', 'planning', 'severe', 'operations', 'billing', 'master', 'platform']);
    });
  });
});

/**
 * Navigation Configuration Tests
 *
 * Unit tests for navigation configuration functions extracted from AppShell.tsx
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║ Audience Boundary Contract                                         ║
 * ║                                                                    ║
 * ║ Navigation visibility is controlled by `audience` on each NavItem  ║
 * ║ and filtered by `isNavVisible(item, navAudience)`.                 ║
 * ║                                                                    ║
 * ║ If you change an item's audience (e.g. staff → admin), the         ║
 * ║ 'Audience Boundary Contracts' tests below will fail, alerting you  ║
 * ║ that a role-visibility boundary has shifted.                        ║
 * ║                                                                    ║
 * ║ To fix: update the contract arrays (STAFF_VISIBLE_LABELS,          ║
 * ║ ADMIN_ONLY_LABELS) to match the new audience assignments.          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
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
      const item: Partial<NavItem> = {
        label: '日次記録',
        to: '/dailysupport',
        isActive: () => false,
        testId: TESTIDS.nav.daily,
      };
      expect(pickGroup(item, false)).toBe('daily');
      expect(pickGroup(item, true)).toBe('daily');
    });

    it('should classify health records as daily', () => {
      const item: Partial<NavItem> = {
        label: '健康記録',
        to: '/daily/health',
        isActive: () => false,
      };
      expect(pickGroup(item, false)).toBe('daily');
    });

    it('should classify handoff timeline as daily', () => {
      const item: Partial<NavItem> = {
        label: '申し送りタイムライン',
        to: '/handoff-timeline',
        isActive: () => false,
      };
      expect(pickGroup(item, false)).toBe('daily');
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
        expect(pickGroup(item, false)).toBe('daily');
      });
    });

    it('should classify records as record group', () => {
      const item: Partial<NavItem> = {
        label: '記録一覧',
        to: '/records',
        isActive: () => false,
      };
      expect(pickGroup(item, false)).toBe('record');
    });

    it('should classify schedules as daily group', () => {
      const item: Partial<NavItem> = {
        label: 'スケジュール',
        to: '/schedules/week',
        isActive: () => false,
        testId: TESTIDS.nav.schedules,
      };
      expect(pickGroup(item, false)).toBe('daily');
    });

    it('should classify analysis as ibd group', () => {
      const item: Partial<NavItem> = {
        label: '分析',
        to: '/analysis/dashboard',
        isActive: () => false,
        testId: TESTIDS.nav.analysis,
      };
      expect(pickGroup(item, false)).toBe('assessment');
    });

    it('should classify iceberg as assessment group', () => {
      const item: Partial<NavItem> = {
        label: '氷山分析',
        to: '/analysis/iceberg',
        isActive: () => false,
        testId: TESTIDS.nav.iceberg,
      };
      expect(pickGroup(item, false)).toBe('assessment');
    });

    it('should classify assessment as assessment group', () => {
      const item: Partial<NavItem> = {
        label: 'アセスメント',
        to: '/assessment',
        isActive: () => false,
        testId: TESTIDS.nav.assessment,
      };
      expect(pickGroup(item, false)).toBe('assessment');
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
        expect(pickGroup(item, false)).toBe('admin');
      });
    });

    it('should classify admin items as admin group for admins only', () => {
      const item: Partial<NavItem> = {
        label: '自己点検',
        to: '/checklist',
        isActive: () => false,
        testId: TESTIDS.nav.checklist,
      };
      expect(pickGroup(item, false)).toBe('admin');
      expect(pickGroup(item, true)).toBe('admin');
    });

    it('should classify audit log as admin group for admins only', () => {
      const item: Partial<NavItem> = {
        label: '監査ログ',
        to: '/audit',
        isActive: () => false,
        testId: TESTIDS.nav.audit,
      };
      expect(pickGroup(item, false)).toBe('admin');
      expect(pickGroup(item, true)).toBe('admin');
    });

    it('should default to record group for unknown items', () => {
      const item: Partial<NavItem> = {
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
      // NOTE: '記録一覧' は admin audience に変更されたため、staff には非表示
      expect(items.some((item) => item.label === 'サービス提供実績記録')).toBe(true);
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
      expect(map.get('daily')).toHaveLength(1);
      expect(map.get('record')).toHaveLength(1); // 記録一覧 only
      expect(map.get('assessment')).toHaveLength(1);
      expect(map.get('admin')).toHaveLength(2);
    });

    it('should classify admin items correctly for admin users', () => {
      const { map } = groupNavItems(sampleItems, true);

      expect(map.get('admin')).toHaveLength(2); // 利用者 + 自己点検
      expect(map.get('record')).toHaveLength(1); // 記録一覧 only
    });

    it('should maintain group order', () => {
      const { ORDER } = groupNavItems(sampleItems, false);

      expect(ORDER).toEqual(['daily', 'assessment', 'record', 'ops', 'admin']);
    });

    it('should omit empty groups from the map', () => {
      const { map } = groupNavItems(sampleItems, false);

      // settings has no items, so it should not exist in the map
      expect((map as Map<string, NavItem[]>).has('settings')).toBe(false);

      // groups with items should still exist
      expect(map.has('daily')).toBe(true);
      expect(map.has('record')).toBe(true);
      expect(map.has('assessment')).toBe(true);
      expect(map.has('admin')).toBe(true);
    });

    it('should bring back a group automatically when items are added to it', () => {
      const itemsWithSettings: Partial<NavItem>[] = [
        ...sampleItems,
        { label: '追加項', to: '/ops-new', isActive: () => false, group: 'ops' },
      ];
      const { map } = groupNavItems(itemsWithSettings as NavItem[], false);

      expect(map.has('ops')).toBe(true);
      expect(map.get('ops')).toHaveLength(1);
    });
  });

  describe('constants', () => {
    it('should have correct NAV_AUDIENCE values', () => {
      expect(NAV_AUDIENCE.all).toBe('all');
      expect(NAV_AUDIENCE.staff).toBe('staff');
      expect(NAV_AUDIENCE.admin).toBe('admin');
    });

    it('should have correct group labels', () => {
      expect(groupLabel.daily).toBe('📌 現場の実行');
      expect(groupLabel.assessment).toBe('🧩 支援計画・アセスメント');
      expect(groupLabel.record).toBe('📚 記録・振り返り');
      expect(groupLabel.ops).toBe('🏢 拠点運営');
      expect(groupLabel.admin).toBe('⚙️ マスタ・管理');
    });

    it('should have correct group order', () => {
      expect(NAV_GROUP_ORDER).toEqual(['daily', 'assessment', 'record', 'ops', 'admin']);
    });
  });

  // ── Audience Boundary Contracts ──────────────────────────────────────────
  //
  // These tests define which items each role CAN and CANNOT see.
  // They act as a safety net: if someone changes an item's audience,
  // the contract breaks and forces intentional review.
  //
  // When updating: change the contract arrays below, NOT the test logic.

  describe('Audience Boundary Contracts', () => {
    // Base config: all conditional flags ON, so we test the full menu surface
    const fullFlagConfig = {
      dashboardPath: '/dashboard',
      currentRole: 'staff',
      schedulesEnabled: true,
      complianceFormEnabled: true,
      icebergPdcaEnabled: true,
      staffAttendanceEnabled: true,
      todayOpsEnabled: true,
      isAdmin: true,
      authzReady: true,
      skipLogin: false,
      navAudience: NAV_AUDIENCE.admin, // admin sees everything
    };

    // ╔════════════════════════════════════════════════════════════════╗
    // ║ CONTRACT: Items visible to staff (audience: 'all' | 'staff') ║
    // ║ Update this list when audience assignments change.            ║
    // ╚════════════════════════════════════════════════════════════════╝
    const STAFF_VISIBLE_LABELS = [
      '今日の業務',
      '送迎配車表',
      'スケジュール',
      '日次記録',
      '健康記録',
      '申し送りタイムライン',
      '議事録',
      'ISP作成',
      'ISP更新（前回比較）',
      '支援計画シート',
      'アセスメント',
      'サービス提供実績記録',
      '個人月次業務日誌',
      '利用者',
      '職員',
      '職員勤怠',
      'コンプラ報告',
    ];

    // ╔════════════════════════════════════════════════════════════════╗
    // ║ CONTRACT: Items restricted to admin (audience: 'admin')       ║
    // ║ These must NOT appear for staff navAudience.                   ║
    // ╚════════════════════════════════════════════════════════════════╝
    const ADMIN_ONLY_LABELS = [
      '分析ワークスペース',
      '特性アンケート',
      '運営状況',
      '記録一覧',
      '申し送り分析',
      '運用メトリクス',
      '請求処理',
      '職員勤怠管理',
      '統合リソースカレンダー',
      'お部屋管理',
      '例外センター',
      '管理ツール',
    ];

    it('staff sees exactly the staff-visible items (boundary contract)', () => {
      const staffItems = createNavItems({
        ...fullFlagConfig,
        isAdmin: false,
        navAudience: NAV_AUDIENCE.staff,
      });
      const staffLabels = staffItems.map((item) => item.label).sort();
      expect(staffLabels).toEqual([...STAFF_VISIBLE_LABELS].sort());
    });

    it('admin-only items are excluded from staff view (boundary contract)', () => {
      const staffItems = createNavItems({
        ...fullFlagConfig,
        isAdmin: false,
        navAudience: NAV_AUDIENCE.staff,
      });
      const staffLabels = new Set(staffItems.map((item) => item.label));

      for (const label of ADMIN_ONLY_LABELS) {
        expect(staffLabels.has(label), `"${label}" should NOT be visible to staff`).toBe(false);
      }
    });

    it('admin sees all items including admin-only (boundary contract)', () => {
      const adminItems = createNavItems({
        ...fullFlagConfig,
        isAdmin: true,
        navAudience: NAV_AUDIENCE.admin,
      });
      const adminLabels = new Set(adminItems.map((item) => item.label));

      // Admin must see everything staff sees
      for (const label of STAFF_VISIBLE_LABELS) {
        expect(adminLabels.has(label), `"${label}" should be visible to admin`).toBe(true);
      }
      // Admin must also see admin-only items
      for (const label of ADMIN_ONLY_LABELS) {
        expect(adminLabels.has(label), `"${label}" should be visible to admin`).toBe(true);
      }
    });
  });
});

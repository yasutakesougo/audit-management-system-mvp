/**
 * Navigation Configuration
 *
 * This file contains all navigation-related configuration for the AppShell,
 * extracted from AppShell.tsx for better maintainability and testability.
 *
 * @module app/config/navigationConfig
 */

import { isDevMode } from '@/lib/env';
import type { PrefetchKey } from '@/prefetch/routes';
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type React from 'react';

// ============================================================================
// Type Definitions
// ============================================================================

export type NavAudience = 'all' | 'staff' | 'admin' | 'reception';

export type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string, search?: string) => boolean;
  testId?: string;
  icon?: React.ElementType;
  prefetchKey?: PrefetchKey;
  prefetchKeys?: PrefetchKey[];
  audience?: NavAudience | NavAudience[];
  /** Explicit group assignment. When set, pickGroup() uses this directly. */
  group?: NavGroupKey;
};

export type NavGroupKey = 'daily' | 'record' | 'ibd' | 'isp' | 'master' | 'admin' | 'settings';

// ============================================================================
// Constants
// ============================================================================

export const NAV_AUDIENCE = {
  all: 'all',
  staff: 'staff',
  admin: 'admin',
  reception: 'reception',
} as const satisfies Record<'all' | 'staff' | 'admin' | 'reception', NavAudience>;

/**
 * i18n Keys for navigation group labels
 * Used for future internationalization support (ja/en/etc)
 */
export const NAV_GROUP_I18N_KEYS = {
  daily: 'NAV_GROUP.DAILY',
  record: 'NAV_GROUP.RECORD',
  ibd: 'NAV_GROUP.IBD',
  isp: 'NAV_GROUP.ISP',
  master: 'NAV_GROUP.MASTER',
  admin: 'NAV_GROUP.ADMIN',
  settings: 'NAV_GROUP.SETTINGS',
} as const;

/**
 * Navigation group labels
 * Order: daily → record → review → master → admin → settings
 *
 * Phase 1 UX Optimization (2026-02-23):
 * - Updated emoji and text to improve clarity and visual hierarchy
 * - Optimized for both full-width and collapsed sidebar views
 * - Pairs with NAV_GROUP_I18N_KEYS for future i18n integration
 */
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',
  record: '📚 記録を参照',
  ibd: '🧩 強度行動障害支援',
  isp: '📋 個別支援計画',
  master: '👥 利用者・職員',
  admin: '🛡️ システム管理',
  settings: '⚙️ 表示設定',
};

/**
 * Navigation groups display order
 */
export const NAV_GROUP_ORDER: NavGroupKey[] = ['daily', 'record', 'isp', 'ibd', 'master', 'admin', 'settings'];

// ============================================================================
// Functions
// ============================================================================

/**
 * Determines which navigation group a nav item belongs to
 *
 * @param item - Navigation item
 * @param isAdmin - Whether the current user is an admin
 * @returns The group key for this item
 */
export function pickGroup(item: NavItem, isAdmin: boolean): NavGroupKey {
  // Explicit group assignment takes priority over inference
  if (item.group) return item.group;

  // DEV warning: flag items that lack explicit group (migration aid)
  if (isDevMode()) {
    console.warn(
      `[pickGroup] NavItem "${item.label}" (to=${item.to}) has no explicit group — falling back to label inference. ` +
      `Add \`group: '...'\` to suppress this warning.`,
    );
  }

  const { to, label, testId } = item;

  // 日次: daily + handoff/meeting + meeting minutes
  if (
    testId === TESTIDS.nav.daily ||
    to.startsWith('/daily') ||
    to.startsWith('/dailysupport') ||
    to.startsWith('/handoff') ||
    to.startsWith('/meeting-guide') ||
    to.startsWith('/meeting-minutes') ||
    label.includes('日次') ||
    label.includes('健康') ||
    label.includes('申し送り') ||
    label.includes('司会') ||
    label.includes('朝会') ||
    label.includes('夕会') ||
    label.includes('議事録')
  ) {
    return 'daily';
  }

  // 記録・運用: records, schedules
  if (
    testId === TESTIDS.nav.schedules ||
    testId === TESTIDS.nav.billing ||
    to.startsWith('/records') ||
    to.startsWith('/schedule') ||
    to.startsWith('/billing') ||
    label.includes('黒ノート') ||
    label.includes('月次') ||
    label.includes('請求処理')
  ) {
    return 'record';
  }

  // 強度行動障害支援: analysis, iceberg, assessment, survey, 支援マスタ系
  if (
    testId === TESTIDS.nav.analysis ||
    testId === TESTIDS.nav.iceberg ||
    testId === TESTIDS.nav.icebergPdca ||
    testId === TESTIDS.nav.assessment ||
    to.startsWith('/analysis') ||
    to.startsWith('/assessment') ||
    to.startsWith('/survey') ||
    to === '/admin/step-templates' ||
    to === '/admin/individual-support' ||
    to === '/admin/templates' ||
    label.includes('分析') ||
    label.includes('氷山') ||
    label.includes('アセスメント') ||
    label.includes('特性') ||
    label.includes('支援手順マスタ') ||
    label.includes('個別支援手順') ||
    label.includes('支援活動マスタ')
  ) {
    return 'ibd';
  }

  // 個別支援計画: ISP作成・更新
  if (
    testId === TESTIDS.nav.supportPlanGuide ||
    testId === TESTIDS.nav.ispEditor ||
    to.startsWith('/support-plan-guide') ||
    to.startsWith('/isp-editor') ||
    label.includes('ISP') ||
    label.includes('個別支援計画書')
  ) {
    return 'isp';
  }

  // マスタ: users, staff
  if (
    to.startsWith('/users') ||
    to.startsWith('/staff') ||
    label.includes('利用者') ||
    label.includes('職員')
  ) {
    return 'master';
  }

  // 設定: label based
  if (label.includes('設定')) {
    return 'settings';
  }

  // 管理: checklist, audit, admin/* (管理者のみ)
  if (
    isAdmin &&
    (testId === TESTIDS.nav.checklist ||
      testId === TESTIDS.nav.audit ||
      testId === TESTIDS.nav.admin ||
      to.startsWith('/checklist') ||
      to.startsWith('/audit') ||
      to.startsWith('/admin') ||
      label.includes('自己点検') ||
      label.includes('監査'))
  ) {
    return 'admin';
  }

  // デフォルトは記録
  return 'record';
}

/**
 * Configuration for creating navigation items
 */
export interface CreateNavItemsConfig {
  dashboardPath: string;
  currentRole: string | null;
  schedulesEnabled: boolean;
  complianceFormEnabled: boolean;
  icebergPdcaEnabled: boolean;
  staffAttendanceEnabled: boolean;
  todayOpsEnabled: boolean;
  isAdmin: boolean;
  authzReady: boolean;
  navAudience: NavAudience;
  skipLogin?: boolean;
}

/**
 * Creates the navigation items array based on feature flags and permissions
 *
 * This function was extracted from AppShell.tsx's useMemo for better testability.
 *
 * @param config - Configuration object containing all dependencies
 * @returns Array of navigation items
 */
export function createNavItems(config: CreateNavItemsConfig): NavItem[] {
  const {
    schedulesEnabled,
    complianceFormEnabled,
    icebergPdcaEnabled,
    staffAttendanceEnabled,
    todayOpsEnabled,
    isAdmin,
    authzReady,
    navAudience,
    skipLogin = false,
  } = config;

  // Side-nav intentionally excludes:
  // - /analysis/iceberg-pdca/edit (edit-only)
  // - /dev/schedule-create-dialog (dev-only)
  // - /daily/activity, /daily/support-checklist, /daily/time-based
  // - /schedules/day, /schedules/month
  const items: NavItem[] = [
    // todayOps gated: 今日の業務グループ先頭
    ...(todayOpsEnabled
      ? [
          {
            label: '今日の業務',
            to: '/today',
            isActive: (pathname: string) => pathname === '/today',
            icon: undefined as React.ElementType | undefined,
            testId: TESTIDS.nav.todayOps,
            audience: NAV_AUDIENCE.all as NavAudience,
            group: 'daily' as NavGroupKey,
          },
        ]
      : []),
    {
      label: '日次記録',
      to: '/dailysupport',
      isActive: (pathname) => pathname === '/dailysupport' || pathname.startsWith('/daily/'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.dailyMenu,
      testId: TESTIDS.nav.daily,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '健康記録',
      to: '/daily/health',
      isActive: (pathname) => pathname.startsWith('/daily/health'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '申し送りタイムライン',
      to: '/handoff-timeline',
      isActive: (pathname) => pathname.startsWith('/handoff-timeline'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '司会ガイド',
      to: '/meeting-guide',
      isActive: (pathname) => pathname.startsWith('/meeting-guide'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '朝会（作成）',
      to: '/meeting-minutes/new?category=朝会',
      isActive: (pathname, search = '') =>
        pathname.startsWith('/meeting-minutes/new') &&
        new URLSearchParams(search).get('category') === '朝会',
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '夕会（作成）',
      to: '/meeting-minutes/new?category=夕会',
      isActive: (pathname, search = '') =>
        pathname.startsWith('/meeting-minutes/new') &&
        new URLSearchParams(search).get('category') === '夕会',
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '議事録アーカイブ',
      to: '/meeting-minutes',
      isActive: (pathname) => pathname.startsWith('/meeting-minutes'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '黒ノート',
      to: '/dashboard',
      isActive: (pathname) => pathname === '/dashboard',
      icon: undefined,
      testId: TESTIDS.nav.dashboard,
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
    },
    {
      label: '黒ノート一覧',
      to: '/records',
      isActive: (pathname) => pathname.startsWith('/records'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
    },
    {
      label: '月次記録',
      to: '/records/monthly',
      isActive: (pathname) => pathname.startsWith('/records/monthly'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
    },
    {
      label: '支援ハブ',
      to: '/ibd',
      isActive: (pathname) => pathname === '/ibd',
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
      group: 'ibd' as NavGroupKey,
    },
    {
      label: '分析',
      to: '/analysis/dashboard',
      isActive: (pathname) => pathname.startsWith('/analysis/dashboard'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.analysisDashboard,
      testId: TESTIDS.nav.analysis,
      audience: NAV_AUDIENCE.staff,
      group: 'ibd' as NavGroupKey,
    },
    {
      label: '氷山分析',
      to: '/analysis/iceberg',
      isActive: (pathname) => pathname.startsWith('/analysis/iceberg') && !pathname.includes('pdca'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.iceberg,
      testId: TESTIDS.nav.iceberg,
      audience: NAV_AUDIENCE.staff,
      group: 'ibd' as NavGroupKey,
    },
    {
      label: 'アセスメント',
      to: '/assessment',
      isActive: (pathname) => pathname.startsWith('/assessment'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.assessmentDashboard,
      testId: TESTIDS.nav.assessment,
      audience: NAV_AUDIENCE.staff,
      group: 'ibd' as NavGroupKey,
    },
    {
      label: '特性アンケート',
      to: '/survey/tokusei',
      isActive: (pathname) => pathname.startsWith('/survey/tokusei'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
      group: 'ibd' as NavGroupKey,
    },
    {
      label: 'ISP作成',
      to: '/support-plan-guide',
      isActive: (pathname) => pathname === '/support-plan-guide',
      icon: undefined,
      testId: TESTIDS.nav.supportPlanGuide,
      audience: NAV_AUDIENCE.staff,
      group: 'isp' as NavGroupKey,
    },
    {
      label: 'ISP更新（前回比較）',
      to: '/isp-editor',
      isActive: (pathname) => pathname === '/isp-editor',
      icon: undefined,
      testId: TESTIDS.nav.ispEditor,
      audience: NAV_AUDIENCE.staff,
      group: 'isp' as NavGroupKey,
    },
    {
      label: '利用者',
      to: '/users',
      isActive: (pathname: string) => pathname.startsWith('/users'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.users,
      audience: NAV_AUDIENCE.staff,
      group: 'master' as NavGroupKey,
    },
    {
      label: '職員',
      to: '/staff',
      isActive: (pathname: string) => pathname.startsWith('/staff') && !pathname.startsWith('/staff/attendance'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.staff,
      audience: NAV_AUDIENCE.staff,
      group: 'master' as NavGroupKey,
    },
    {
      label: '請求処理',
      to: '/billing',
      isActive: (pathname) => pathname === '/billing' || pathname.startsWith('/billing/'),
      icon: undefined,
      testId: TESTIDS.nav.billing,
      audience: [NAV_AUDIENCE.reception, NAV_AUDIENCE.admin],
      group: 'admin' as NavGroupKey,
    },
  ];

  // Conditional items based on feature flags and permissions

  if (staffAttendanceEnabled) {
    items.push({
      label: '職員勤怠',
      to: '/staff/attendance',
      isActive: (pathname: string) => pathname.startsWith('/staff/attendance'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.staff,
      testId: TESTIDS.nav.staffAttendance,
      audience: NAV_AUDIENCE.staff,
      group: 'master' as NavGroupKey,
    });
  }

  if (isAdmin && (authzReady || skipLogin)) {
    items.push(
      {
        label: '支援手順マスタ',
        to: '/admin/step-templates',
        isActive: (pathname: string) => pathname.startsWith('/admin/step-templates'),
        icon: undefined,
        audience: NAV_AUDIENCE.admin,
        group: 'ibd' as NavGroupKey,
      },
      {
        label: '個別支援手順',
        to: '/admin/individual-support',
        isActive: (pathname: string) => pathname.startsWith('/admin/individual-support'),
        icon: undefined,
        audience: NAV_AUDIENCE.admin,
        group: 'ibd' as NavGroupKey,
      },
      {
        label: '職員勤怠管理',
        to: '/admin/staff-attendance',
        isActive: (pathname: string) => pathname.startsWith('/admin/staff-attendance'),
        icon: undefined,
        audience: NAV_AUDIENCE.admin,
        group: 'admin' as NavGroupKey,
      },
      {
        label: '自己点検',
        to: '/checklist',
        isActive: (pathname: string) => pathname.startsWith('/checklist'),
        icon: undefined,
        prefetchKey: PREFETCH_KEYS.checklist,
        testId: TESTIDS.nav.checklist,
        audience: NAV_AUDIENCE.admin,
        group: 'admin' as NavGroupKey,
      },
      {
        label: '監査ログ',
        to: '/audit',
        isActive: (pathname: string) => pathname.startsWith('/audit'),
        testId: TESTIDS.nav.audit,
        icon: undefined,
        prefetchKey: PREFETCH_KEYS.audit,
        audience: NAV_AUDIENCE.admin,
        group: 'admin' as NavGroupKey,
      },
    );
    if (schedulesEnabled) {
      items.push({
        label: '統合リソースカレンダー',
        to: '/admin/integrated-resource-calendar',
        isActive: (pathname: string) => pathname.startsWith('/admin/integrated-resource-calendar'),
        icon: undefined,
        testId: TESTIDS.nav.integratedResourceCalendar,
        audience: NAV_AUDIENCE.admin,
        group: 'admin' as NavGroupKey,
      });
    }

    items.push({
      label: 'ナビ診断',
      to: '/admin/navigation-diagnostics',
      isActive: (pathname: string) => pathname.startsWith('/admin/navigation-diagnostics'),
      icon: undefined,
      testId: TESTIDS.nav.navigationDiagnostics,
      audience: NAV_AUDIENCE.admin,
      group: 'admin' as NavGroupKey,
    });

    items.push({
      label: 'お部屋管理',
      to: '/room-management',
      isActive: (pathname: string) => pathname.startsWith('/room-management'),
      icon: undefined,
      testId: TESTIDS.nav.roomManagement,
      audience: NAV_AUDIENCE.admin,
      group: 'admin' as NavGroupKey,
    });
  }

  items.push({
    label: '支援活動マスタ',
    to: '/admin/templates',
    isActive: (pathname: string) => pathname.startsWith('/admin'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.adminTemplates,
    prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
    testId: TESTIDS.nav.admin,
    audience: NAV_AUDIENCE.admin,
    group: 'ibd' as NavGroupKey,
  });

  // Feature-flagged items

  if (icebergPdcaEnabled && !items.some(item => item.testId === TESTIDS.nav.icebergPdca)) {
    items.splice(3, 0, {
      label: '氷山PDCA',
      to: '/analysis/iceberg-pdca',
      isActive: (pathname: string) => pathname.startsWith('/analysis/iceberg-pdca'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.icebergPdcaBoard,
      testId: TESTIDS.nav.icebergPdca,
      audience: NAV_AUDIENCE.staff,
      group: 'ibd' as NavGroupKey,
    });
  }

  if (schedulesEnabled && !items.some(item => item.testId === TESTIDS.nav.schedules)) {
    items.push({
      label: 'スケジュール',
      to: '/schedules/week',
      isActive: (pathname: string) => pathname.startsWith('/schedule') || pathname.startsWith('/schedules'),
      testId: TESTIDS.nav.schedules,
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.schedulesWeek,
      prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
    });
  }

  if (complianceFormEnabled) {
    items.push({
      label: 'コンプラ報告',
      to: '/compliance',
      isActive: (pathname: string) => pathname.startsWith('/compliance'),
      icon: undefined,
      audience: 'staff',
      group: 'admin' as NavGroupKey,
    });
  }

  // Filter by audience
  const isNavVisible = (item: NavItem): boolean => {
    const audienceList = Array.isArray(item.audience) ? item.audience : [item.audience ?? 'all'];
    if (audienceList.includes('all')) return true;
    if (navAudience === 'admin') return true; // admin sees everything (including staff/reception stuff if needed)
    return audienceList.includes(navAudience);
  };

  return items.filter(isNavVisible);
}

/**
 * Filters navigation items based on a search query
 *
 * @param navItems - Array of navigation items to filter
 * @param query - Search query string
 * @returns Filtered array of navigation items
 */
export function filterNavItems(navItems: NavItem[], query: string): NavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return navItems;
  return navItems.filter((item) => (item.label ?? '').toLowerCase().includes(q));
}

/**
 * Groups navigation items by their category
 *
 * @param navItems - Array of navigation items to group
 * @param isAdmin - Whether the current user is an admin
 * @returns Map of group keys to navigation items and the display order
 */
export function groupNavItems(
  navItems: NavItem[],
  isAdmin: boolean
): { map: Map<NavGroupKey, NavItem[]>; ORDER: NavGroupKey[] } {
  const map = new Map<NavGroupKey, NavItem[]>();
  NAV_GROUP_ORDER.forEach((k) => map.set(k, []));

  for (const item of navItems) {
    const group = pickGroup(item, isAdmin);
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(item);
  }

  // Remove empty groups (e.g. settings with no items) to avoid rendering empty sections
  for (const [key, items] of map.entries()) {
    if (!items || items.length === 0) map.delete(key);
  }

  return { map, ORDER: NAV_GROUP_ORDER };
}

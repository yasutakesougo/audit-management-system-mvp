/**
 * Navigation Configuration
 * 
 * This file contains all navigation-related configuration for the AppShell,
 * extracted from AppShell.tsx for better maintainability and testability.
 * 
 * @module app/config/navigationConfig
 */

import type { PrefetchKey } from '@/prefetch/routes';
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type React from 'react';

// ============================================================================
// Type Definitions
// ============================================================================

export type NavAudience = 'all' | 'staff' | 'admin';

export type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string) => boolean;
  testId?: string;
  icon?: React.ElementType;
  prefetchKey?: PrefetchKey;
  prefetchKeys?: PrefetchKey[];
  audience?: NavAudience;
};

export type NavGroupKey = 'daily' | 'record' | 'review' | 'master' | 'admin' | 'settings';

// ============================================================================
// Constants
// ============================================================================

export const NAV_AUDIENCE = {
  all: 'all',
  staff: 'staff',
  admin: 'admin',
} as const satisfies Record<'all' | 'staff' | 'admin', NavAudience>;

/**
 * Navigation group labels
 * Order: daily → record → review → master → admin → settings
 */
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '🗓 日次',
  record: '🗂 記録・運用',
  review: '📊 振り返り・分析',
  master: '👥 マスタ',
  admin: '🛡 管理',
  settings: '⚙️ 設定',
};

/**
 * Navigation groups display order
 */
export const NAV_GROUP_ORDER: NavGroupKey[] = ['daily', 'record', 'review', 'master', 'admin', 'settings'];

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
    to.startsWith('/records') ||
    to.startsWith('/schedule') ||
    label.includes('黒ノート') ||
    label.includes('月次')
  ) {
    return 'record';
  }

  // 振り返り・分析: analysis, iceberg, assessment
  if (
    testId === TESTIDS.nav.analysis ||
    testId === TESTIDS.nav.iceberg ||
    testId === TESTIDS.nav.icebergPdca ||
    testId === TESTIDS.nav.assessment ||
    to.startsWith('/analysis') ||
    to.startsWith('/assessment') ||
    to.startsWith('/survey') ||
    label.includes('分析') ||
    label.includes('氷山') ||
    label.includes('アセスメント') ||
    label.includes('特性')
  ) {
    return 'review';
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
    {
      label: '日次記録',
      to: '/dailysupport',
      isActive: (pathname) => pathname === '/dailysupport' || pathname.startsWith('/daily/'),
      icon: undefined, // Icons are imported in AppShell.tsx
      prefetchKey: PREFETCH_KEYS.dailyMenu,
      testId: TESTIDS.nav.daily,
      audience: NAV_AUDIENCE.all,
    },
    {
      label: '健康記録',
      to: '/daily/health',
      isActive: (pathname) => pathname.startsWith('/daily/health'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
    },
    {
      label: '申し送りタイムライン',
      to: '/handoff-timeline',
      isActive: (pathname) => pathname.startsWith('/handoff-timeline'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
    },
    {
      label: '司会ガイド',
      to: '/meeting-guide',
      isActive: (pathname) => pathname.startsWith('/meeting-guide'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
    },
    {
      label: '朝会（作成）',
      to: '/meeting-minutes/new?category=朝会',
      isActive: (pathname) => pathname.startsWith('/meeting-minutes/new'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
    },
    {
      label: '夕会（作成）',
      to: '/meeting-minutes/new?category=夕会',
      isActive: (pathname) => pathname.startsWith('/meeting-minutes/new'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
    },
    {
      label: '議事録アーカイブ',
      to: '/meeting-minutes',
      isActive: (pathname) => pathname.startsWith('/meeting-minutes'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
    },
    {
      label: '黒ノート一覧',
      to: '/records',
      isActive: (pathname) => pathname.startsWith('/records'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
    },
    {
      label: '月次記録',
      to: '/records/monthly',
      isActive: (pathname) => pathname.startsWith('/records/monthly'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
    },
    {
      label: '分析',
      to: '/analysis/dashboard',
      isActive: (pathname) => pathname.startsWith('/analysis/dashboard'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.analysisDashboard,
      testId: TESTIDS.nav.analysis,
      audience: NAV_AUDIENCE.staff,
    },
    {
      label: '氷山分析',
      to: '/analysis/iceberg',
      isActive: (pathname) => pathname.startsWith('/analysis/iceberg'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.iceberg,
      testId: TESTIDS.nav.iceberg,
      audience: NAV_AUDIENCE.staff,
    },
    {
      label: 'アセスメント',
      to: '/assessment',
      isActive: (pathname) => pathname.startsWith('/assessment'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.assessmentDashboard,
      testId: TESTIDS.nav.assessment,
      audience: NAV_AUDIENCE.staff,
    },
    {
      label: '特性アンケート',
      to: '/survey/tokusei',
      isActive: (pathname) => pathname.startsWith('/survey/tokusei'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
    },
    {
      label: '利用者',
      to: '/users',
      isActive: (pathname: string) => pathname.startsWith('/users'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.users,
      audience: NAV_AUDIENCE.staff,
    },
    {
      label: '職員',
      to: '/staff',
      isActive: (pathname: string) => pathname.startsWith('/staff') && !pathname.startsWith('/staff/attendance'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.staff,
      audience: NAV_AUDIENCE.staff,
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
      },
      {
        label: '個別支援手順',
        to: '/admin/individual-support',
        isActive: (pathname: string) => pathname.startsWith('/admin/individual-support'),
        icon: undefined,
        audience: NAV_AUDIENCE.admin,
      },
      {
        label: '職員勤怠管理',
        to: '/admin/staff-attendance',
        isActive: (pathname: string) => pathname.startsWith('/admin/staff-attendance'),
        icon: undefined,
        audience: NAV_AUDIENCE.admin,
      },
      {
        label: '自己点検',
        to: '/checklist',
        isActive: (pathname: string) => pathname.startsWith('/checklist'),
        icon: undefined,
        prefetchKey: PREFETCH_KEYS.checklist,
        testId: TESTIDS.nav.checklist,
        audience: NAV_AUDIENCE.admin,
      },
      {
        label: '監査ログ',
        to: '/audit',
        isActive: (pathname: string) => pathname.startsWith('/audit'),
        testId: TESTIDS.nav.audit,
        icon: undefined,
        prefetchKey: PREFETCH_KEYS.audit,
        audience: NAV_AUDIENCE.admin,
      },
    );
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
    });
  }

  if (complianceFormEnabled) {
    items.push({
      label: 'コンプラ報告',
      to: '/compliance',
      isActive: (pathname: string) => pathname.startsWith('/compliance'),
      icon: undefined,
      audience: 'staff',
    });
  }

  // Filter by audience
  const isNavVisible = (item: NavItem): boolean => {
    const audience = item.audience ?? 'all';
    if (audience === 'all') return true;
    if (audience === 'admin') return navAudience === 'admin';
    return navAudience === 'admin' || navAudience === 'staff';
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
    map.get(group)!.push(item);
  }

  return { map, ORDER: NAV_GROUP_ORDER };
}

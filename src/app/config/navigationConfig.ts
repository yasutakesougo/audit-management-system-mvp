/**
 * Navigation Configuration
 * 
 * This file serves as the public API for navigation configuration.
 * It re-exports types and constants from specialized modules and
 * implements the high-level factory functions for navigation items.
 * 
 * Types and constants live in navigationConfig.types.ts; helper functions
 * (pickGroup, filterNavItems, groupNavItems, isNavVisible) live in
 * navigationConfig.helpers.ts. Both are re-exported here for public API
 * compatibility.
 * 
 * @module app/config/navigationConfig
 */

import {
  getHubNavLabel,
  getHubRequiredRole,
  getHubRootPath,
  isHubPathActive,
} from '@/app/hubs/hubDefinitions';
import type { HubId } from '@/app/hubs/hubTypes';
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';

// Import types and constants from extracted modules
import { isNavVisible, requiredRoleToNavAudience } from './navigationConfig.helpers';
import {
    NAV_AUDIENCE,
    type CreateNavItemsConfig,
    type NavGroupKey,
    type NavItem,
    type NavTier,
} from './navigationConfig.types';

// Re-export all types and constants for public API parity
export {
    groupLabel, NAV_AUDIENCE,
    NAV_GROUP_I18N_KEYS,
    NAV_GROUP_ORDER
} from './navigationConfig.types';
export type {
    CreateNavItemsConfig,
    NavAudience,
    NavGroupKey,
    NavItem,
    NavTier,
} from './navigationConfig.types';

// Re-export all helper functions for public API parity
export {
    buildVisibleNavItems,
    filterNavItems,
    groupNavItems,
    isNavVisible,
    pickGroup,
    requiredRoleToNavAudience,
    roleToNavAudience,
    splitNavItemsByTier,
} from './navigationConfig.helpers';

// ============================================================================
// Nav Item Factory
// ============================================================================

type HubNavItemOverrides = {
  label?: string;
  testId?: string;
  prefetchKey?: NavItem['prefetchKey'];
  prefetchKeys?: NavItem['prefetchKeys'];
  tier?: NavTier;
  isActive?: NavItem['isActive'];
};

const createHubNavItem = (hubId: HubId, overrides: HubNavItemOverrides = {}): NavItem => ({
  label: overrides.label ?? getHubNavLabel(hubId),
  to: getHubRootPath(hubId),
  isActive: overrides.isActive ?? ((pathname) => isHubPathActive(hubId, pathname)),
  icon: undefined,
  testId: overrides.testId,
  prefetchKey: overrides.prefetchKey,
  prefetchKeys: overrides.prefetchKeys,
  audience: requiredRoleToNavAudience(getHubRequiredRole(hubId)),
  group: hubId as NavGroupKey,
  tier: overrides.tier,
});

/**
 * Creates the navigation items array based on feature flags and permissions
 *
 * This function was extracted from AppShell.tsx’s useMemo for better testability.
 *
 * @param config - Configuration object containing all dependencies
 * @returns Array of navigation items
 */
export function createNavItems(config: CreateNavItemsConfig): NavItem[] {
  const {
    schedulesEnabled,
    complianceFormEnabled,
    staffAttendanceEnabled,
    todayOpsEnabled,
    isAdmin,
    authzReady,
    navAudience,
    isFieldStaffShell = false,
    skipLogin = false,
  } = config;

  const items: NavItem[] = [
    // --- 1. 現場の実行 (today) ---
    ...(todayOpsEnabled
      ? [createHubNavItem('today', { testId: TESTIDS.nav.todayOps })]
      : []),
    {
      label: '送迎降車表',
      to: '/transport/assignments',
      isActive: (pathname) => pathname.startsWith('/transport/assignments'),
      icon: undefined,
      testId: TESTIDS.nav.transportAssignments,
      audience: NAV_AUDIENCE.staff,
      group: 'today' as NavGroupKey,
    },
    ...(schedulesEnabled
      ? [
          {
            label: 'スケジュール',
            to: '/schedules/week',
            isActive: (pathname: string) => pathname.startsWith('/schedule') || pathname.startsWith('/schedules'),
            testId: TESTIDS.nav.schedules,
            icon: undefined,
            prefetchKey: PREFETCH_KEYS.schedulesWeek,
            prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
            audience: NAV_AUDIENCE.staff,
            group: 'today' as NavGroupKey,
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
      group: 'today' as NavGroupKey,
    },
    {
      label: '健康記録',
      to: '/daily/health',
      isActive: (pathname) => pathname.startsWith('/daily/health'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'today' as NavGroupKey,
    },
    {
      label: '申し送りタイムライン',
      to: '/handoff-timeline',
      isActive: (pathname) => pathname.startsWith('/handoff-timeline'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'today' as NavGroupKey,
    },
    {
      label: '議事録',
      to: '/meeting-minutes',
      isActive: (pathname) => pathname.startsWith('/meeting-minutes') || pathname.startsWith('/meeting-guide') || pathname.startsWith('/dashboard/briefing'),
      icon: undefined,
      audience: isFieldStaffShell ? NAV_AUDIENCE.staff : NAV_AUDIENCE.all,
      group: 'today' as NavGroupKey,
      tier: 'more',
      featureFlag: 'todayLiteNavV2',
    },

    // --- 2. 計画・アセスメント (planning / severe) ---
    createHubNavItem('planning', {
      isActive: (pathname) => pathname === '/planning' || pathname.startsWith('/planning/'),
    }),
    {
      label: '個別支援計画',
      to: '/support-plan-guide',
      isActive: (pathname) => pathname === '/support-plan-guide',
      icon: undefined,
      testId: TESTIDS.nav.supportPlanGuide,
      audience: isFieldStaffShell ? NAV_AUDIENCE.staff : NAV_AUDIENCE.all,
      group: 'planning' as NavGroupKey,
    },
    {
      label: '個別支援計画更新・前回比較',
      to: '/isp-editor',
      isActive: (pathname) => pathname.startsWith('/isp-editor'),
      icon: undefined,
      testId: TESTIDS.nav.ispEditor,
      audience: NAV_AUDIENCE.admin,
      group: 'planning' as NavGroupKey,
    },
    createHubNavItem('severe', {
      isActive: (pathname) => pathname === '/severe' || pathname.startsWith('/severe/'),
    }),
    {
      label: '支援計画シート',
      to: '/planning-sheet-list',
      isActive: (pathname) => pathname.startsWith('/planning-sheet-list') || pathname.startsWith('/support-planning-sheet'),
      icon: undefined,
      testId: TESTIDS.nav.planningSheet,
      audience: NAV_AUDIENCE.staff,
      group: 'severe' as NavGroupKey,
    },
    {
      label: 'アセスメント',
      to: '/assessment',
      isActive: (pathname) => pathname.startsWith('/assessment'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.assessmentDashboard,
      testId: TESTIDS.nav.assessment,
      audience: NAV_AUDIENCE.staff,
      group: 'severe' as NavGroupKey,
    },

    // --- 3. 記録・参照 (records) ---
    {
      label: '運営状況',
      to: '/dashboard',
      isActive: (pathname) => pathname === '/dashboard',
      icon: undefined,
      testId: TESTIDS.nav.dashboard,
      audience: NAV_AUDIENCE.admin,
      group: 'records' as NavGroupKey,
      tier: 'admin',
      featureFlag: 'todayLiteNavV2',
    },
    createHubNavItem('records'),
    {
      label: 'モニタリング記録',
      to: '/records/monthly',
      isActive: (pathname) => pathname.startsWith('/records/monthly'),
      icon: undefined,
      testId: 'nav-monitoring-record',
      audience: NAV_AUDIENCE.staff,
      group: 'records' as NavGroupKey,
    },
    {
      label: '申し送り分析',
      to: '/handoff-analysis',
      isActive: (pathname) => pathname.startsWith('/handoff-analysis'),
      icon: undefined,
      audience: NAV_AUDIENCE.admin,
      group: 'records' as NavGroupKey,
      tier: 'admin',
      featureFlag: 'todayLiteNavV2',
    },

    // --- 4. 運営・管理 (operations / platform) ---
    createHubNavItem('operations', { tier: 'admin' }),
    {
      label: '運用メトリクス',
      to: '/ops',
      isActive: (pathname) => pathname === '/ops' || pathname.startsWith('/ops/'),
      icon: undefined,
      audience: NAV_AUDIENCE.admin,
      group: 'operations' as NavGroupKey,
      tier: 'admin',
      featureFlag: 'todayLiteNavV2',
    },
    createHubNavItem('billing', { testId: TESTIDS.nav.billing }),
    createHubNavItem('master'),
    createHubNavItem('platform'),
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
      audience: NAV_AUDIENCE.admin,
      group: 'master' as NavGroupKey,
    },
  ];

  // Conditional additions
  if (staffAttendanceEnabled) {
    items.push({
      label: '職員勤怠',
      to: '/staff/attendance',
      isActive: (pathname: string) => pathname.startsWith('/staff/attendance'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.staff,
      testId: TESTIDS.nav.staffAttendance,
      audience: NAV_AUDIENCE.reception,
      group: 'operations' as NavGroupKey,
    });
  }

  if (complianceFormEnabled) {
    items.push({
      label: 'コンプラ報告',
      to: '/compliance',
      isActive: (pathname: string) => pathname.startsWith('/compliance'),
      icon: undefined,
      audience: 'staff',
      group: 'operations' as NavGroupKey,
    });
  }

  if (isAdmin && (authzReady || skipLogin)) {
    items.push({
      label: '適正化運用',
      to: '/admin/compliance-dashboard',
      isActive: (pathname: string) => pathname === '/admin/compliance-dashboard',
      audience: NAV_AUDIENCE.admin,
      group: 'operations' as NavGroupKey,
      tier: 'admin',
    });

    items.push({
      label: '制度遵守',
      to: '/admin/regulatory-dashboard',
      isActive: (pathname: string) => pathname === '/admin/regulatory-dashboard',
      audience: NAV_AUDIENCE.admin,
      group: 'operations' as NavGroupKey,
      tier: 'admin',
    });

    items.push({
      label: '職員勤怠管理',
      to: '/admin/staff-attendance',
      isActive: (pathname: string) => pathname.startsWith('/admin/staff-attendance'),
      icon: undefined,
      audience: NAV_AUDIENCE.admin,
      group: 'operations' as NavGroupKey,
    });

    items.push({
      label: '例外センター',
      to: '/admin/exception-center',
      isActive: (pathname: string) => pathname.startsWith('/admin/exception-center'),
      icon: undefined,
      testId: TESTIDS.nav.exceptionCenter,
      audience: NAV_AUDIENCE.admin,
      group: 'operations' as NavGroupKey,
      tier: 'admin',
      featureFlag: 'todayLiteNavV2',
    });

    items.push({
      label: '管理ツール',
      to: '/admin',
      isActive: (pathname: string) => (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/checklist') || pathname.startsWith('/audit') || pathname.startsWith('/settings/')) && !pathname.startsWith('/admin/exception-center') && !pathname.startsWith('/admin/compliance-dashboard') && !pathname.startsWith('/admin/regulatory-dashboard'),
      icon: undefined,
      audience: NAV_AUDIENCE.admin,
      group: 'platform' as NavGroupKey,
    });

    items.push({
      label: 'テレメトリ',
      to: '/admin/telemetry',
      isActive: (pathname: string) => pathname === '/admin/telemetry',
      icon: undefined,
      audience: NAV_AUDIENCE.admin,
      group: 'platform' as NavGroupKey,
      tier: 'admin',
    });

    items.push({
      label: '環境診断',
      to: '/admin/status',
      isActive: (pathname: string) => pathname === '/admin/status',
      icon: undefined,
      audience: NAV_AUDIENCE.admin,
      group: 'platform' as NavGroupKey,
      tier: 'admin',
    });
  }

  return items.filter((item) => isNavVisible(item, navAudience));
}

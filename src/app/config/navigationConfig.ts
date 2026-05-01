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
import { TESTIDS } from '@/testids';

// Import types and constants from extracted modules
import { isNavVisible, requiredRoleToNavAudience } from './navigationConfig.helpers';
import {
    type CreateNavItemsConfig,
    type NavGroupKey,
    type NavItem,
    type NavTier,
} from './navigationConfig.types';

// Import Route Groups
import { MASTER_ROUTES } from './routeGroups/masterRoutes';
import { OPS_ROUTES } from './routeGroups/opsRoutes';
import { PLANNING_ROUTES } from './routeGroups/planningRoutes';
import { PLATFORM_ROUTES } from './routeGroups/platformRoutes';
import { RECORD_ROUTES } from './routeGroups/recordRoutes';
import { SCHEDULES_ROUTES } from './routeGroups/schedulesRoutes';
import { SEVERE_ROUTES } from './routeGroups/severeRoutes';
import { TODAY_ROUTES } from './routeGroups/todayRoutes';

// Re-export all types and constants for public API parity
export {
    groupLabel,
    NAV_AUDIENCE,
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
    TODAY_ROUTES.TRANSPORT(isFieldStaffShell),
    TODAY_ROUTES.DAILY_SUPPORT(isFieldStaffShell),
    TODAY_ROUTES.HEALTH_RECORD(isFieldStaffShell),
    TODAY_ROUTES.CALL_LOGS(isFieldStaffShell),
    TODAY_ROUTES.HANDOFF_TIMELINE(isFieldStaffShell),
    TODAY_ROUTES.MEETING_MINUTES(isFieldStaffShell),
    
    // --- 2. スケジュール・割当 (schedules) ---
    ...(schedulesEnabled ? [
      SCHEDULES_ROUTES.CALENDAR.WEEK(isFieldStaffShell),
      SCHEDULES_ROUTES.ASSIGNMENT.TRANSPORT(isFieldStaffShell),
    ] : []),

    // --- 2. 計画・アセスメント (planning / severe) ---
    createHubNavItem('planning', {
      label: '支援計画・調整',
      isActive: (pathname) => pathname === '/planning' || pathname.startsWith('/planning/'),
    }),
    PLANNING_ROUTES.SUPPORT_PLAN_GUIDE(isFieldStaffShell),
    PLANNING_ROUTES.ISP_EDITOR(isFieldStaffShell),
    
    createHubNavItem('severe', {
      isActive: (pathname) => pathname === '/severe' || pathname.startsWith('/severe/'),
    }),
    SEVERE_ROUTES.PLANNING_SHEET(isFieldStaffShell),
    SEVERE_ROUTES.ASSESSMENT(isFieldStaffShell),

    // --- 3. 記録・参照 (records) ---
    RECORD_ROUTES.DASHBOARD(isFieldStaffShell),
    createHubNavItem('records', { label: '記録・参照' }),
    RECORD_ROUTES.MONTHLY(isFieldStaffShell),
    RECORD_ROUTES.HANDOFF_ANALYSIS(isFieldStaffShell),

    // --- 4. 運営・管理 (operations / platform) ---
    createHubNavItem('operations', { label: '運営・管理', tier: 'admin' }),
    OPS_ROUTES.METRICS(isFieldStaffShell),
    createHubNavItem('billing', { testId: TESTIDS.nav.billing }),
    createHubNavItem('master'),
    createHubNavItem('platform'),
    MASTER_ROUTES.USERS(isFieldStaffShell),
    MASTER_ROUTES.STAFF(isFieldStaffShell),
  ];

  // Conditional additions
  if (staffAttendanceEnabled) {
    items.push(OPS_ROUTES.STAFF_ATTENDANCE(isFieldStaffShell));
  }

  if (complianceFormEnabled) {
    items.push(OPS_ROUTES.COMPLIANCE_REPORT(isFieldStaffShell));
  }

  if (isAdmin && (authzReady || skipLogin)) {
    items.push(OPS_ROUTES.COMPLIANCE_DASHBOARD(isFieldStaffShell));
    items.push(OPS_ROUTES.REGULATORY_DASHBOARD(isFieldStaffShell));
    items.push(OPS_ROUTES.ADMIN_STAFF_ATTENDANCE(isFieldStaffShell));
    items.push(OPS_ROUTES.EXCEPTION_CENTER(isFieldStaffShell));
    if (schedulesEnabled && isAdmin && (authzReady || skipLogin)) {
      items.push(SCHEDULES_ROUTES.RESOURCE.INTEGRATED_CALENDAR(isFieldStaffShell));
    }
    items.push(PLATFORM_ROUTES.ADMIN(isFieldStaffShell));
    items.push(PLATFORM_ROUTES.TELEMETRY(isFieldStaffShell));
    items.push(PLATFORM_ROUTES.STATUS(isFieldStaffShell));
  }

  return items.filter((item) => isNavVisible(item, navAudience));
}


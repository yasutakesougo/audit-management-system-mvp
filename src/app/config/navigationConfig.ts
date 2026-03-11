/**
 * Navigation Configuration
 *
 * Orchestrates and assembles navigation items from per-group route constants.
 * Types and constants live in navigationConfig.types.ts; helper functions
 * (pickGroup, filterNavItems, groupNavItems, isNavVisible) live in
 * navigationConfig.helpers.ts. Route group constants live in routeGroups/.
 *
 * @module app/config/navigationConfig
 */

import { TESTIDS } from '@/testids';

import { isNavVisible } from './navigationConfig.helpers';
import {
    type CreateNavItemsConfig,
    type NavAudience,
    type NavItem,
} from './navigationConfig.types';
import { ADMIN_ROUTES_BASE, ADMIN_ROUTES_EXTRA } from './routeGroups/adminRoutes';
import { DAILY_ROUTES_BASE, DAILY_ROUTES_TODAY_OPS } from './routeGroups/dailyRoutes';
import { IBD_ROUTES_BASE, IBD_ROUTES_TEMPLATES } from './routeGroups/ibdRoutes';
import { ISP_ROUTES } from './routeGroups/ispRoutes';
import { MASTER_ROUTES } from './routeGroups/masterRoutes';
import {
    OPS_ROUTES_ADMIN_IRC,
    OPS_ROUTES_BASE,
    OPS_ROUTES_COMPLIANCE,
    OPS_ROUTES_STAFF_ATTENDANCE,
} from './routeGroups/opsRoutes';
import { RECORD_ROUTES_BASE, RECORD_ROUTES_SCHEDULES } from './routeGroups/recordRoutes';

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
    NavItem
} from './navigationConfig.types';

// Re-export all helper functions for public API parity
export {
    filterNavItems,
    groupNavItems,
    isNavVisible,
    pickGroup
} from './navigationConfig.helpers';

// ============================================================================
// Nav Item Factory
// ============================================================================

/**
 * Creates the navigation items array based on feature flags and permissions.
 *
 * Assembles per-group route constants from routeGroups/ into a single ordered
 * array, applies feature-flag conditions, and filters by audience.
 *
 * @param config - Configuration object containing all dependencies
 * @returns Array of navigation items visible for the given audience
 */
export function createNavItems(config: CreateNavItemsConfig): NavItem[] {
  const {
    schedulesEnabled,
    complianceFormEnabled,
    icebergPdcaEnabled: _icebergPdcaEnabled,
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
    // Today Ops (feature-flagged — shown at top of daily group if enabled)
    ...(todayOpsEnabled ? DAILY_ROUTES_TODAY_OPS : []),
    // Fixed groups
    ...DAILY_ROUTES_BASE,
    ...RECORD_ROUTES_BASE,
    ...IBD_ROUTES_BASE,
    ...ISP_ROUTES,
    ...MASTER_ROUTES,
    ...OPS_ROUTES_BASE,
  ];

  // Conditional: staff attendance
  if (staffAttendanceEnabled) {
    items.push(...OPS_ROUTES_STAFF_ATTENDANCE);
  }

  // Conditional: admin-only block
  if (isAdmin && (authzReady || skipLogin)) {
    items.push(...ADMIN_ROUTES_BASE);
    if (schedulesEnabled) {
      items.push(...OPS_ROUTES_ADMIN_IRC);
    }
    items.push(...ADMIN_ROUTES_EXTRA);
  }

  // Templates — always appended, after admin block
  items.push(...IBD_ROUTES_TEMPLATES);

  // Conditional: schedules (deduplicated by testId guard)
  if (schedulesEnabled && !items.some((item) => item.testId === TESTIDS.nav.schedules)) {
    items.push(...RECORD_ROUTES_SCHEDULES);
  }

  // Conditional: compliance form
  if (complianceFormEnabled) {
    items.push(...OPS_ROUTES_COMPLIANCE);
  }

  // Filter by audience using extracted helper
  return items.filter((item) => isNavVisible(item, navAudience as NavAudience));
}

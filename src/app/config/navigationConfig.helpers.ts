/**
 * Navigation Configuration — Helper Functions
 *
 * Pure helper functions for navigation visibility, filtering, and grouping.
 * Extracted from navigationConfig.ts for better maintainability.
 *
 * @module app/config/navigationConfig.helpers
 */

import { isDevMode } from '@/lib/env';
import { TESTIDS } from '@/testids';
import type { Role } from '@/auth/roles';

import {
    NAV_GROUP_ORDER,
    type NavAudience,
    type NavGroupKey,
    type NavItem,
    type NavTier,
} from './navigationConfig.types';

const NAV_AUDIENCE_LEVEL: Record<NavAudience, number> = {
  all: 0,
  staff: 1,
  reception: 2,
  admin: 3,
};

export function roleToNavAudience(role: Role): NavAudience {
  if (role === 'admin') return 'admin';
  if (role === 'reception') return 'reception';
  return 'staff';
}

export function requiredRoleToNavAudience(requiredRole: Role = 'viewer'): NavAudience {
  return roleToNavAudience(requiredRole);
}

// ============================================================================
// Visibility
// ============================================================================

/**
 * Determines whether a navigation item should be visible to a given audience.
 *
 * audience 属性に基づいてナビゲーション項目の表示を制御する。
 * - audience が 'all' または未設定: 全ユーザーに表示
 * - audience に role 階層を適用して判定
 *   (admin > reception > staff > all)
 *
 * @param item - Navigation item to evaluate
 * @param navAudience - The current user's audience level
 * @returns Whether the item should be visible
 */
export function isNavVisible(item: NavItem, navAudience: NavAudience): boolean {
  const audienceList = Array.isArray(item.audience) ? item.audience : [item.audience ?? 'all'];
  return audienceList.some((audience) => NAV_AUDIENCE_LEVEL[navAudience] >= NAV_AUDIENCE_LEVEL[audience]);
}

export type BuildVisibleNavItemsOptions = {
  showMore: boolean;
  todayLiteNavV2: boolean;
  isKiosk: boolean;
  hiddenGroups: string[];
  hiddenItems: string[];
};

const DEFAULT_TIER: NavTier = 'core';

const roleToStrictAudience = (audience: NavAudience): 'viewer' | 'reception' | 'admin' => {
  if (audience === 'admin') return 'admin';
  if (audience === 'reception') return 'reception';
  return 'viewer';
};

/**
 * Filter navigation items based on the current context (role, tier, kiosk mode, user preferences).
 *
 * Extracted filtering logic to ensure consistent behavior across AppShell and unit tests.
 */
export function buildVisibleNavItems(
  items: NavItem[],
  navAudience: NavAudience,
  opts: BuildVisibleNavItemsOptions,
): NavItem[] {
  const role = roleToStrictAudience(navAudience);

  // Kiosk mode constraints
  const KIOSK_HIDDEN_PATHS = ['/dailysupport', '/daily/health', '/transport/assignments'];
  const KIOSK_ALLOWED_GROUPS = new Set(['today']);

  return items.filter((item) => {
    // 1. Feature Tier/Lite Nav filtering
    if (opts.todayLiteNavV2) {
      const tier = item.tier ?? DEFAULT_TIER;
      if (tier === 'admin' && role !== 'admin') return false;
      if (tier === 'more' && !opts.showMore) return false;
    }

    // 2. Kiosk mode filtering
    if (opts.isKiosk) {
      if (item.group && !KIOSK_ALLOWED_GROUPS.has(item.group)) return false;
      if (KIOSK_HIDDEN_PATHS.includes(item.to)) return false;
    }

    // 3. User preference filtering
    if (item.group && opts.hiddenGroups.includes(item.group)) return false;
    if (opts.hiddenItems.includes(item.to)) return false;

    return true;
  });
}

export function splitNavItemsByTier(items: NavItem[]): Record<NavTier, NavItem[]> {
  return items.reduce<Record<NavTier, NavItem[]>>(
    (acc, item) => {
      const tier = item.tier ?? DEFAULT_TIER;
      acc[tier].push(item);
      return acc;
    },
    { core: [], more: [], admin: [] },
  );
}

// ============================================================================
// Group Classification
// ============================================================================

/**
 * Determins the fallback navigation group for items without explicit grouping
 *
 * @remarks
 * `NavItem.group` is now strictly required in TypeScript, so this function acts primarily
 * as a safety net for dynamically generated URLs or partially typed migration data.
 * The internal logic has been retained to avoid breaking external generic links.
 *
 * @param item - Partial or loosely-typed Navigation item
 * @param isAdmin - Whether the current user is an admin
 * @returns The fallback or explicit group key
 */
export function pickGroup(item: Partial<NavItem>, _isAdmin: boolean): NavGroupKey {
  // Explicit group assignment takes priority (This should always hit for valid NavItems)
  if (item.group) return item.group;

  // DEV warning: flag items that lack explicit group (used as migration/dynamic data warning)
  if (isDevMode()) {
    console.warn(
      `[pickGroup] Fallback rule hit for nav item "${item.label}" (to=${item.to}). ` +
      `Ensure full NavItem typing with \`group\` to suppress this warning.`,
    );
  }

  const to = item.to || '';
  const label = item.label || '';
  const testId = item.testId;

  // 1. Today
  if (
    testId === TESTIDS.nav.todayOps ||
    testId === TESTIDS.nav.daily ||
    testId === TESTIDS.nav.schedules ||
    testId === TESTIDS.nav.transportAssignments ||
    to.startsWith('/today') ||
    to.startsWith('/transport/assignments') ||
    to.startsWith('/daily') ||
    to.startsWith('/dailysupport') ||
    to.startsWith('/handoff-timeline') ||
    to.startsWith('/meeting') ||
    to.startsWith('/schedule') ||
    label.includes('今日') ||
    label.includes('日次') ||
    label.includes('健康') ||
    label.includes('タイムライン') ||
    label.includes('議事録') ||
    label.includes('スケジュール') ||
    label.includes('Today')
  ) {
    return 'today';
  }

  // 2. Planning
  if (
    testId === TESTIDS.nav.supportPlanGuide ||
    testId === TESTIDS.nav.ispEditor ||
    testId === TESTIDS.nav.planningSheet ||
    testId === TESTIDS.nav.analysis ||
    testId === TESTIDS.nav.assessment ||
    to.startsWith('/planning') ||
    to.startsWith('/support') ||
    to.startsWith('/isp') ||
    to.startsWith('/assessment') ||
    to.startsWith('/analysis') ||
    to.startsWith('/survey') ||
    label.includes('ISP') ||
    label.includes('支援計画') ||
    label.includes('アセスメント') ||
    label.includes('分析ワークスペース') ||
    label.includes('特性') ||
    label.includes('Planning')
  ) {
    return 'planning';
  }

  // 3. Billing
  if (
    testId === TESTIDS.nav.billing ||
    to.startsWith('/billing') ||
    label.includes('請求') ||
    label.includes('Billing')
  ) {
    return 'billing';
  }

  // 4. Operations
  if (
    testId === TESTIDS.nav.staffAttendance ||
    testId === TESTIDS.nav.integratedResourceCalendar ||
    testId === TESTIDS.nav.roomManagement ||
    testId === TESTIDS.nav.exceptionCenter ||
    to.startsWith('/operations') ||
    to.startsWith('/ops') ||
    to.startsWith('/staff/attendance') ||
    to.startsWith('/admin/staff-attendance') ||
    to.startsWith('/admin/integrated') ||
    to.startsWith('/room-management') ||
    to.startsWith('/admin/exception-center') ||
    to.startsWith('/compliance') ||
    label.includes('メトリクス') ||
    label.includes('勤怠') ||
    label.includes('カレンダー') ||
    label.includes('部屋') ||
    label.includes('コンプラ') ||
    label.includes('Operations')
  ) {
    return 'operations';
  }

  // 5. Master
  if (
    to.startsWith('/master') ||
    to.startsWith('/users') ||
    (to.startsWith('/staff') && !to.includes('attendance')) ||
    label.includes('利用者') ||
    (label.includes('職員') && !label.includes('勤怠')) ||
    label.includes('Master')
  ) {
    return 'master';
  }

  // 6. Platform
  if (
    testId === TESTIDS.nav.admin ||
    to.startsWith('/platform') ||
    to === '/admin' ||
    to.startsWith('/admin/') ||
    to.startsWith('/settings') ||
    to.startsWith('/checklist') ||
    to.startsWith('/audit') ||
    label.includes('管理ツール') ||
    label.includes('設定') ||
    label.includes('監査ログ') ||
    label.includes('自己点検') ||
    label.includes('Platform')
  ) {
    return 'platform';
  }

  // 7. デフォルト (records)
  return 'records';
}

// ============================================================================
// Filtering & Grouping
// ============================================================================

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

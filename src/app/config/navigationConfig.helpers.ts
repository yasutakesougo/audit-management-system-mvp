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

import {
    NAV_GROUP_ORDER,
    type NavAudience,
    type NavGroupKey,
    type NavItem,
} from './navigationConfig.types';

// ============================================================================
// Visibility
// ============================================================================

/**
 * Determines whether a navigation item should be visible to a given audience.
 *
 * @param item - Navigation item to evaluate
 * @param navAudience - The current user's audience level
 * @returns true if the item should be shown
 */
export function isNavVisible(item: NavItem, navAudience: NavAudience): boolean {
  const audienceList = Array.isArray(item.audience) ? item.audience : [item.audience ?? 'all'];
  if (audienceList.includes('all')) return true;
  if (navAudience === 'admin') return true;
  return audienceList.includes(navAudience);
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

  // 1. 現場の実行 (daily)
  if (
    testId === TESTIDS.nav.daily ||
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
    label.includes('スケジュール')
  ) {
    return 'daily';
  }

  // 2. 支援計画・アセスメント (assessment)
  if (
    testId === TESTIDS.nav.supportPlanGuide ||
    testId === TESTIDS.nav.ispEditor ||
    testId === TESTIDS.nav.planningSheet ||
    testId === TESTIDS.nav.analysis ||
    testId === TESTIDS.nav.assessment ||
    to.startsWith('/support') ||
    to.startsWith('/isp') ||
    to.startsWith('/assessment') ||
    to.startsWith('/analysis') ||
    to.startsWith('/survey') ||
    label.includes('ISP') ||
    label.includes('支援計画') ||
    label.includes('アセスメント') ||
    label.includes('分析ワークスペース') ||
    label.includes('特性')
  ) {
    return 'assessment';
  }

  // 3. 拠点運営 (ops)
  if (
    testId === TESTIDS.nav.billing ||
    testId === TESTIDS.nav.staffAttendance ||
    testId === TESTIDS.nav.integratedResourceCalendar ||
    testId === TESTIDS.nav.roomManagement ||
    to.startsWith('/ops') ||
    to.startsWith('/billing') ||
    to.startsWith('/staff/attendance') ||
    to.startsWith('/admin/staff-attendance') ||
    to.startsWith('/admin/integrated') ||
    to.startsWith('/room-management') ||
    to.startsWith('/compliance') ||
    label.includes('メトリクス') ||
    label.includes('請求') ||
    label.includes('勤怠') ||
    label.includes('カレンダー') ||
    label.includes('部屋') ||
    label.includes('コンプラ')
  ) {
    return 'ops';
  }

  // 4. マスタ・管理 (admin)
  if (
    testId === TESTIDS.nav.admin ||
    to.startsWith('/users') ||
    (to.startsWith('/staff') && !to.includes('attendance')) ||
    to === '/admin' ||
    to.startsWith('/admin/') ||
    to.startsWith('/settings') ||
    label.includes('利用者') ||
    (label.includes('職員') && !label.includes('勤怠')) ||
    label.includes('管理ツール') ||
    label.includes('設定')
  ) {
    return 'admin';
  }

  // 5. デフォルト (record) - 記録・振り返り
  return 'record';
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

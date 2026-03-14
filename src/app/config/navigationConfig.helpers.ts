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
    to.startsWith('/records') ||
    to.startsWith('/schedule') ||
    label.includes('運営状況') ||
    label.includes('記録一覧') ||
    label.includes('月次')
  ) {
    return 'record';
  }

  // 支援計画・分析: analysis, iceberg, assessment, survey, 支援マスタ系, ISP
  if (
    testId === TESTIDS.nav.analysis ||
    testId === TESTIDS.nav.iceberg ||
    testId === TESTIDS.nav.icebergPdca ||
    testId === TESTIDS.nav.assessment ||
    testId === TESTIDS.nav.supportPlanGuide ||
    testId === TESTIDS.nav.ispEditor ||
    testId === TESTIDS.nav.planningSheet ||
    to.startsWith('/analysis') ||
    to.startsWith('/assessment') ||
    to.startsWith('/survey') ||
    to.startsWith('/support-plan-guide') ||
    to.startsWith('/isp-editor') ||
    to.startsWith('/support-planning-sheet') ||
    to === '/admin/step-templates' ||
    to === '/admin/individual-support' ||
    to === '/admin/templates' ||
    label.includes('分析') ||
    label.includes('氷山') ||
    label.includes('アセスメント') ||
    label.includes('特性') ||
    label.includes('支援手順マスタ') ||
    label.includes('個別支援手順') ||
    label.includes('支援活動マスタ') ||
    label.includes('ISP') ||
    label.includes('個別支援計画書') ||
    label.includes('支援計画シート')
  ) {
    return 'plan';
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

  // 管理: settings, billing, attendance, room, compliance, checklist, audit, admin/*
  if (label.includes('設定')) {
    return 'admin';
  }

  if (
    testId === TESTIDS.nav.billing ||
    testId === TESTIDS.nav.staffAttendance ||
    testId === TESTIDS.nav.integratedResourceCalendar ||
    testId === TESTIDS.nav.roomManagement ||
    to.startsWith('/billing') ||
    to.startsWith('/staff/attendance') ||
    to.startsWith('/admin/staff-attendance') ||
    to.startsWith('/admin/integrated-resource-calendar') ||
    to.startsWith('/room-management') ||
    to.startsWith('/compliance') ||
    label.includes('請求') ||
    label.includes('勤怠') ||
    label.includes('お部屋') ||
    label.includes('コンプラ')
  ) {
    return 'admin';
  }

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

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
  isActive: (pathname: string, search?: string) => boolean;
  testId?: string;
  icon?: React.ElementType;
  prefetchKey?: PrefetchKey;
  prefetchKeys?: PrefetchKey[];
  audience?: NavAudience;
  tier?: 'essential' | 'more';
  badge?: number;
  group?: NavGroupKey;
};

export type NavGroupKey = 'daily' | 'record' | 'review' | 'master' | 'admin' | 'settings' | 'planning';

// ============================================================================
// Constants
// ============================================================================

export const NAV_AUDIENCE = {
  all: 'all',
  staff: 'staff',
  admin: 'admin',
} as const satisfies Record<'all' | 'staff' | 'admin', NavAudience>;

export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',
  record: '📚 記録を参照',
  review: '🔍 分析して改善',
  master: '👥 利用者・職員',
  admin: '🛡️ システム管理',
  settings: '⚙️ 表示設定',
  planning: '🗓️ 計画・調整',
};

export const NAV_GROUP_ORDER: NavGroupKey[] = ['daily', 'record', 'planning', 'review', 'master', 'admin', 'settings'];

// ============================================================================
// Functions
// ============================================================================

export function roleToNavAudience(role: string | null): NavAudience {
  if (!role) return 'staff';
  if (role === 'admin') return 'admin';
  return 'staff';
}

export function pickGroup(item: NavItem): NavGroupKey {
  const { to, label, testId } = item;
  if (item.group) return item.group;

  if (
    testId === TESTIDS.nav.daily ||
    to.startsWith('/dailysupport') ||
    label.includes('日次') ||
    label.includes('朝会') ||
    label.includes('夕会')
  ) {
    return 'daily';
  }

  if (to.startsWith('/schedule') || to.startsWith('/schedules')) {
    return 'planning';
  }

  return 'record'; // Fallback
}

export interface CreateNavItemsConfig {
  dashboardPath: string;
  currentRole: string | null;
  schedulesEnabled: boolean;
  complianceFormEnabled: boolean;
  icebergPdcaEnabled: boolean;
  staffAttendanceEnabled: boolean;
  todayOpsEnabled?: boolean;
  isAdmin: boolean;
  authzReady: boolean;
  navAudience: NavAudience;
  skipLogin?: boolean;
}

export function createNavItems(config: CreateNavItemsConfig): NavItem[] {
  const {
    schedulesEnabled,
    isAdmin,
    authzReady,
    skipLogin = false,
  } = config;

  const items: NavItem[] = [
    {
      label: '日次記録',
      to: '/dailysupport',
      isActive: (pathname) => pathname === '/dailysupport' || pathname.startsWith('/daily/'),
      prefetchKey: PREFETCH_KEYS.dailyMenu,
      testId: TESTIDS.nav.daily,
      audience: NAV_AUDIENCE.all,
      tier: 'essential',
    },
    {
      label: '健康記録',
      to: '/daily/health',
      isActive: (pathname) => pathname.startsWith('/daily/health'),
      audience: NAV_AUDIENCE.all,
      tier: 'essential',
    },
  ];

  if (schedulesEnabled) {
    items.push({
      label: 'スケジュール',
      to: '/schedules/week',
      isActive: (pathname) => pathname.startsWith('/schedule') || pathname.startsWith('/schedules'),
      testId: TESTIDS.nav.schedules,
      audience: NAV_AUDIENCE.staff,
      tier: 'essential',
    });
  }

  if (isAdmin && (authzReady || skipLogin)) {
    items.push({
      label: '監査ログ',
      to: '/audit',
      isActive: (pathname) => pathname.startsWith('/audit'),
      testId: TESTIDS.nav.audit,
      audience: NAV_AUDIENCE.admin,
      tier: 'more',
    });
  }

  return items;
}

export function buildVisibleNavItems(
  items: NavItem[],
  audience: NavAudience,
  options: {
    showMore: boolean;
    todayLiteNavV2: boolean;
    isKiosk: boolean;
    hiddenGroups: string[];
    hiddenItems: string[];
  }
): NavItem[] {
  const { showMore, todayLiteNavV2, hiddenItems } = options;

  return items.filter((item) => {
    // Audience check
    if (item.audience === 'admin' && audience !== 'admin') return false;
    
    // Tier check for NavV2
    if (todayLiteNavV2 && !showMore && item.tier === 'more') return false;
    
    // Hidden check
    if (hiddenItems.includes(item.to)) return false;
    
    return true;
  });
}

export function splitNavItemsByTier(items: NavItem[]): { essential: NavItem[]; more: NavItem[] } {
  return {
    essential: items.filter(i => i.tier === 'essential'),
    more: items.filter(i => i.tier === 'more'),
  };
}

export function filterNavItems(navItems: NavItem[], query: string): NavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return navItems;
  return navItems.filter((item) => (item.label ?? '').toLowerCase().includes(q));
}

export function groupNavItems(
  navItems: NavItem[]
): { map: Map<NavGroupKey, NavItem[]>; ORDER: NavGroupKey[] } {
  const map = new Map<NavGroupKey, NavItem[]>();
  NAV_GROUP_ORDER.forEach((k) => map.set(k, []));

  for (const item of navItems) {
    const group = pickGroup(item);
    map.get(group)?.push(item);
  }

  return { map, ORDER: NAV_GROUP_ORDER };
}

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

export type NavAudience = 'all' | 'staff' | 'reception' | 'admin';

export type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string, search?: string) => boolean;
  testId?: string;
  icon?: React.ElementType;
  prefetchKey?: PrefetchKey;
  prefetchKeys?: PrefetchKey[];
  audience?: NavAudience;
  tier?: 'core' | 'more' | 'essential' | 'admin';
  badge?: number;
  group?: NavGroupKey;
  featureFlag?: string;
};

export type NavGroupKey = 
  | 'today' 
  | 'records' 
  | 'planning' 
  | 'severe' 
  | 'operations' 
  | 'billing' 
  | 'master' 
  | 'platform'
  | 'daily'   // legacy (fallback)
  | 'record'  // legacy (fallback)
  | 'review'  // legacy (fallback)
  | 'admin'   // legacy (fallback)
  | 'settings'; // legacy (fallback)

// ============================================================================
// Constants
// ============================================================================

export const NAV_AUDIENCE = {
  all: 'all',
  staff: 'staff',
  reception: 'reception',
  admin: 'admin',
} as const satisfies Record<NavAudience, NavAudience>;

export const groupLabel: Record<NavGroupKey, string> = {
  today: '📌 今日の業務',
  records: '📚 記録を参照',
  planning: '🗓️ 計画・調整',
  severe: '🔍 分析して改善',
  operations: '⚙️ 拠点運営',
  billing: '💰 請求処理',
  master: '👥 利用者・職員',
  platform: '🛡️ システム管理',
  daily: '📌 今日の業務 (L)',
  record: '📚 記録を参照 (L)',
  review: '🔍 分析して改善 (L)',
  admin: '🛡️ システム管理 (L)',
  settings: '⚙️ 表示設定',
};

export const NAV_GROUP_ORDER: NavGroupKey[] = [
  'today', 
  'records', 
  'planning', 
  'severe', 
  'operations', 
  'billing', 
  'master', 
  'platform'
];

// ============================================================================
// Functions
// ============================================================================

export function roleToNavAudience(role: string | null): NavAudience {
  if (!role) return 'staff';
  if (role === 'admin') return 'admin';
  if (role === 'reception') return 'reception';
  return 'staff';
}

export function pickGroup(item: NavItem): NavGroupKey {
  if (item.group) return item.group;
  const { to, label, testId } = item;

  if (
    testId === TESTIDS.nav.daily ||
    to.startsWith('/dailysupport') ||
    label.includes('日次') ||
    label.includes('朝会') ||
    label.includes('夕会')
  ) {
    return 'today';
  }

  if (to.startsWith('/schedule') || to.startsWith('/schedules')) {
    return 'planning';
  }

  return 'records'; // Fallback
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
  isFieldStaffShell?: boolean;
  skipLogin?: boolean;
}

export function createNavItems(config: CreateNavItemsConfig): NavItem[] {
  const {
    schedulesEnabled,
    isAdmin,
    authzReady,
    isFieldStaffShell = false,
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
      group: 'today',
    },
    {
      label: '健康記録',
      to: '/daily/health',
      isActive: (pathname) => pathname.startsWith('/daily/health'),
      audience: NAV_AUDIENCE.all,
      tier: 'essential',
      group: 'today',
    },
    {
      label: '申し送りタイムライン',
      to: '/handoff-timeline',
      isActive: (pathname) => pathname.startsWith('/handoff-timeline'),
      audience: NAV_AUDIENCE.all,
      group: 'today',
    },
    {
      label: '議事録',
      to: '/meeting-minutes',
      isActive: (pathname) => pathname.startsWith('/meeting-minutes') || pathname.startsWith('/meeting-guide') || pathname.startsWith('/dashboard/briefing'),
      audience: isFieldStaffShell ? NAV_AUDIENCE.staff : NAV_AUDIENCE.all,
      group: 'today',
      tier: 'more',
      featureFlag: 'todayLiteNavV2',
    },
    {
      label: '個別支援計画',
      to: '/support-plan-guide',
      isActive: (pathname) => pathname === '/support-plan-guide',
      testId: TESTIDS.nav.supportPlanGuide,
      audience: isFieldStaffShell ? NAV_AUDIENCE.staff : NAV_AUDIENCE.all,
      group: 'planning',
    },
    {
      label: '支援計画シート',
      to: '/planning-sheet-list',
      isActive: (pathname) => pathname.startsWith('/planning-sheet-list') || pathname.startsWith('/support-planning-sheet'),
      testId: TESTIDS.nav.planningSheet,
      audience: NAV_AUDIENCE.staff,
      group: 'severe',
    },
    {
      label: 'アセスメント',
      to: '/assessment',
      isActive: (pathname) => pathname.startsWith('/assessment'),
      prefetchKey: PREFETCH_KEYS.assessmentDashboard,
      testId: TESTIDS.nav.assessment,
      audience: NAV_AUDIENCE.staff,
      group: 'severe',
    },
    {
      label: '運用状況',
      to: '/dashboard',
      isActive: (pathname) => pathname === '/dashboard',
      testId: TESTIDS.nav.dashboard,
      audience: NAV_AUDIENCE.admin,
      group: 'records',
      tier: 'admin',
      featureFlag: 'todayLiteNavV2',
    },
    {
      label: 'モニタリング記録',
      to: '/records/monthly',
      isActive: (pathname) => pathname.startsWith('/records/monthly'),
      testId: 'nav-monitoring-record',
      audience: NAV_AUDIENCE.staff,
      group: 'records',
    },
    {
      label: '運用メトリクス',
      to: '/ops',
      isActive: (pathname) => pathname === '/ops' || pathname.startsWith('/ops/'),
      audience: NAV_AUDIENCE.admin,
      group: 'operations',
      tier: 'admin',
      featureFlag: 'todayLiteNavV2',
    },
    {
      label: '利用者',
      to: '/users',
      isActive: (pathname: string) => pathname.startsWith('/users'),
      prefetchKey: PREFETCH_KEYS.users,
      audience: NAV_AUDIENCE.staff,
      group: 'master',
    },
    {
      label: '職員',
      to: '/staff',
      isActive: (pathname: string) => pathname.startsWith('/staff') && !pathname.startsWith('/staff/attendance'),
      prefetchKey: PREFETCH_KEYS.staff,
      audience: NAV_AUDIENCE.admin,
      group: 'master',
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
      group: 'planning',
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
      group: 'platform',
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
    essential: items.filter(i => i.tier === 'essential' || i.tier === 'core'),
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
    if (map.has(group)) {
      map.get(group)?.push(item);
    }
  }

  return { map, ORDER: NAV_GROUP_ORDER };
}

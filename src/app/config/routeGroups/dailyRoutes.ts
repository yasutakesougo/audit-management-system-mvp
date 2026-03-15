/**
 * Daily Routes — group: 'daily'
 *
 * NavItem constants for the 今日の業務 / 日次系 navigation group.
 * Extracted from navigationConfig.ts createNavItems() for single-responsibility.
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type { NavAudience, NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

/** Added only when todayOpsEnabled is true */
export const DAILY_ROUTES_TODAY_OPS: NavItem[] = [
  {
    label: '今日の業務',
    to: '/today',
    isActive: (pathname: string) => pathname === '/today',
    icon: undefined,
    testId: TESTIDS.nav.todayOps,
    audience: NAV_AUDIENCE.all as NavAudience,
    group: 'daily' as NavGroupKey,
  },
];

/** Unconditional daily group items */
export const DAILY_ROUTES_BASE: NavItem[] = [
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
  // 会議系は「議事録」に統合。司会ガイド・朝会/夕会（作成）はページ内から到達可能。
  {
    label: '議事録',
    to: '/meeting-minutes',
    isActive: (pathname) => pathname.startsWith('/meeting-minutes') || pathname.startsWith('/meeting-guide') || pathname.startsWith('/dashboard/briefing'),
    icon: undefined,
    audience: NAV_AUDIENCE.all,
    group: 'daily' as NavGroupKey,
  },
];

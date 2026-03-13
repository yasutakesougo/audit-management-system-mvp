/**
 * Record Routes — group: 'record'
 *
 * NavItem constants for the 記録を参照 navigation group.
 * Extracted from navigationConfig.ts createNavItems() for single-responsibility.
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type { NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

/** Unconditional record group items */
export const RECORD_ROUTES_BASE: NavItem[] = [
  {
    label: '運営状況',
    to: '/dashboard',
    isActive: (pathname) => pathname === '/dashboard',
    icon: undefined,
    testId: TESTIDS.nav.dashboard,
    audience: NAV_AUDIENCE.staff,
    group: 'record' as NavGroupKey,
  },
  {
    label: '記録一覧',
    to: '/records',
    isActive: (pathname) => pathname.startsWith('/records'),
    icon: undefined,
    audience: NAV_AUDIENCE.staff,
    group: 'record' as NavGroupKey,
  },
  {
    label: '月次記録',
    to: '/records/monthly',
    isActive: (pathname) => pathname.startsWith('/records/monthly'),
    icon: undefined,
    audience: NAV_AUDIENCE.staff,
    group: 'record' as NavGroupKey,
  },
  {
    label: 'サービス提供実績記録',
    to: '/records/service-provision',
    isActive: (pathname) => pathname.startsWith('/records/service-provision'),
    icon: undefined,
    audience: NAV_AUDIENCE.staff,
    group: 'record' as NavGroupKey,
  },
  {
    label: '業務日誌プレビュー',
    to: '/records/journal',
    isActive: (pathname) => pathname === '/records/journal',
    icon: undefined,
    audience: NAV_AUDIENCE.staff,
    group: 'record' as NavGroupKey,
  },
  {
    label: '個人月次業務日誌',
    to: '/records/journal/personal',
    isActive: (pathname) => pathname.startsWith('/records/journal/personal'),
    icon: undefined,
    audience: NAV_AUDIENCE.staff,
    group: 'record' as NavGroupKey,
  },
];

/** Added when schedulesEnabled is true (and not already present) */
export const RECORD_ROUTES_SCHEDULES: NavItem[] = [
  {
    label: 'スケジュール',
    to: '/schedules/week',
    isActive: (pathname: string) =>
      pathname.startsWith('/schedule') || pathname.startsWith('/schedules'),
    testId: TESTIDS.nav.schedules,
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.schedulesWeek,
    prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
    audience: NAV_AUDIENCE.staff,
    group: 'record' as NavGroupKey,
  },
];

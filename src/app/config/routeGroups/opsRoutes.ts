/**
 * Ops Routes — group: 'ops'
 *
 * NavItem constants for the 運営管理 navigation group.
 * Extracted from navigationConfig.ts createNavItems() for single-responsibility.
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type { NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

/** Unconditional ops items (always included) */
export const OPS_ROUTES_BASE: NavItem[] = [
  {
    label: '請求処理',
    to: '/billing',
    isActive: (pathname) => pathname === '/billing' || pathname.startsWith('/billing/'),
    icon: undefined,
    testId: TESTIDS.nav.billing,
    audience: [NAV_AUDIENCE.reception, NAV_AUDIENCE.admin],
    group: 'ops' as NavGroupKey,
  },
];

/** Added when staffAttendanceEnabled is true */
export const OPS_ROUTES_STAFF_ATTENDANCE: NavItem[] = [
  {
    label: '職員勤怠',
    to: '/staff/attendance',
    isActive: (pathname: string) => pathname.startsWith('/staff/attendance'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.staff,
    testId: TESTIDS.nav.staffAttendance,
    audience: NAV_AUDIENCE.staff,
    group: 'ops' as NavGroupKey,
  },
];

/** Added when isAdmin && (authzReady || skipLogin) && schedulesEnabled */
export const OPS_ROUTES_ADMIN_IRC: NavItem[] = [
  {
    label: '統合リソースカレンダー',
    to: '/admin/integrated-resource-calendar',
    isActive: (pathname: string) =>
      pathname.startsWith('/admin/integrated-resource-calendar'),
    icon: undefined,
    testId: TESTIDS.nav.integratedResourceCalendar,
    audience: NAV_AUDIENCE.admin,
    group: 'ops' as NavGroupKey,
  },
];

/** Added when complianceFormEnabled is true */
export const OPS_ROUTES_COMPLIANCE: NavItem[] = [
  {
    label: 'コンプラ報告',
    to: '/compliance',
    isActive: (pathname: string) => pathname.startsWith('/compliance'),
    icon: undefined,
    audience: 'staff',
    group: 'ops' as NavGroupKey,
  },
];

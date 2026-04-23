/**
 * Schedules Routes
 * 
 * NavItem constants for schedule-related pages.
 * While currently some items belong to 'today' or 'operations' groups,
 * they are gathered here for better domain-driven maintainability.
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type { NavAudience, NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

export const SCHEDULES_ROUTES = {
  /**
   * Main schedule view for staff.
   * Grouped under 'today' in the 7-screen IA.
   */
  WEEK: (_isFieldStaffShell: boolean): NavItem => ({
    label: '週間予定',
    to: '/schedules/week',
    isActive: (pathname: string) => pathname.startsWith('/schedule') || pathname.startsWith('/schedules'),
    testId: TESTIDS.nav.schedules,
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.schedulesWeek,
    prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
    audience: NAV_AUDIENCE.staff as NavAudience,
    group: 'schedules' as NavGroupKey,
  }),

  /**
   * Admin resource calendar view.
   * Grouped under 'operations' for administrative oversight.
   */
  INTEGRATED_CALENDAR: (_isFieldStaffShell: boolean): NavItem => ({
    label: 'リソースカレンダー',
    to: '/admin/integrated-resource-calendar',
    isActive: (pathname: string) => pathname === '/admin/integrated-resource-calendar',
    icon: undefined,
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'schedules' as NavGroupKey,
    tier: 'admin' as const,
  }),
};

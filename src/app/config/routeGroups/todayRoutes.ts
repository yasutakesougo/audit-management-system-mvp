/**
 * Today Routes — group: 'today'
 *
 * NavItem constants for the 今日の業務 navigation group.
 * Aligned with the 7-screen IA (today).
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type { NavAudience, NavGroupKey } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

/**
 * Items related to 'today' group.
 */
export const TODAY_ROUTES = {
  // Hub entry is usually handled by createHubNavItem in navigationConfig.ts
  
  TRANSPORT: (_isFieldStaffShell: boolean) => ({
    label: '送迎降車表',
    to: '/transport/assignments',
    isActive: (pathname: string) => pathname.startsWith('/transport/assignments'),
    icon: undefined,
    testId: TESTIDS.nav.transportAssignments,
    audience: NAV_AUDIENCE.staff as NavAudience,
    group: 'today' as NavGroupKey,
  }),
  
  SCHEDULES: (_isFieldStaffShell: boolean) => ({
    label: 'スケジュール',
    to: '/schedules/week',
    isActive: (pathname: string) => pathname.startsWith('/schedule') || pathname.startsWith('/schedules'),
    testId: TESTIDS.nav.schedules,
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.schedulesWeek,
    prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
    audience: NAV_AUDIENCE.staff as NavAudience,
    group: 'today' as NavGroupKey,
  }),
  
  DAILY_SUPPORT: (_isFieldStaffShell: boolean) => ({
    label: '日次記録',
    to: '/dailysupport',
    isActive: (pathname: string) => pathname === '/dailysupport' || pathname.startsWith('/daily/'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.dailyMenu,
    testId: TESTIDS.nav.daily,
    audience: NAV_AUDIENCE.all as NavAudience,
    group: 'today' as NavGroupKey,
  }),
  
  HEALTH_RECORD: (_isFieldStaffShell: boolean) => ({
    label: '健康記録',
    to: '/daily/health',
    isActive: (pathname: string) => pathname.startsWith('/daily/health'),
    icon: undefined,
    audience: NAV_AUDIENCE.all as NavAudience,
    group: 'today' as NavGroupKey,
  }),
  
  HANDOFF_TIMELINE: (_isFieldStaffShell: boolean) => ({
    label: '申し送りタイムライン',
    to: '/handoff-timeline',
    isActive: (pathname: string) => pathname.startsWith('/handoff-timeline'),
    icon: undefined,
    audience: NAV_AUDIENCE.all as NavAudience,
    group: 'today' as NavGroupKey,
  }),
  
  MEETING_MINUTES: (isFieldStaffShell: boolean) => ({
    label: '議事録',
    to: '/meeting-minutes',
    isActive: (pathname: string) => pathname.startsWith('/meeting-minutes') || pathname.startsWith('/meeting-guide') || pathname.startsWith('/dashboard/briefing'),
    icon: undefined,
    audience: isFieldStaffShell ? NAV_AUDIENCE.staff as NavAudience : NAV_AUDIENCE.all as NavAudience,
    group: 'today' as NavGroupKey,
    tier: 'more' as const,
    featureFlag: 'todayLiteNavV2' as const,
  }),
} as const;

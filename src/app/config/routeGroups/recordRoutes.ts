/**
 * Record Routes — group: 'records'
 *
 * NavItem constants for the 記録・参照 navigation group.
 */
import { TESTIDS } from '@/testids';
import type { NavAudience, NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

export const RECORD_ROUTES = {
  DASHBOARD: (_isFieldStaffShell: boolean): NavItem => ({
    label: '運営状況',
    to: '/dashboard',
    isActive: (pathname: string) => pathname === '/dashboard',
    icon: undefined,
    testId: TESTIDS.nav.dashboard,
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'records' as NavGroupKey,
    tier: 'admin' as const,
    featureFlag: 'todayLiteNavV2' as const,
  }),
  
  MONTHLY: (_isFieldStaffShell: boolean): NavItem => ({
    label: 'モニタリング記録',
    to: '/records/monthly',
    isActive: (pathname: string) => pathname.startsWith('/records/monthly'),
    icon: undefined,
    testId: 'nav-monitoring-record',
    audience: NAV_AUDIENCE.staff as NavAudience,
    group: 'records' as NavGroupKey,
  }),
  
  HANDOFF_ANALYSIS: (_isFieldStaffShell: boolean): NavItem => ({
    label: '申し送り分析',
    to: '/handoff-analysis',
    isActive: (pathname: string) => pathname.startsWith('/handoff-analysis'),
    icon: undefined,
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'records' as NavGroupKey,
    tier: 'admin' as const,
    featureFlag: 'todayLiteNavV2' as const,
  }),
};

/**
 * Ops Routes — group: 'operations'
 *
 * NavItem constants for the 拠点運営 navigation group.
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type { NavAudience, NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

export const OPS_ROUTES = {
  METRICS: (_isFieldStaffShell: boolean): NavItem => ({
    label: '運用メトリクス',
    to: '/ops',
    isActive: (pathname: string) => pathname === '/ops' || pathname.startsWith('/ops/'),
    icon: undefined,
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'operations' as NavGroupKey,
    tier: 'admin' as const,
    featureFlag: 'todayLiteNavV2' as const,
  }),
  
  STAFF_ATTENDANCE: (_isFieldStaffShell: boolean): NavItem => ({
    label: '職員勤怠',
    to: '/staff/attendance',
    isActive: (pathname: string) => pathname.startsWith('/staff/attendance'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.staff,
    testId: TESTIDS.nav.staffAttendance,
    audience: NAV_AUDIENCE.reception as NavAudience,
    group: 'operations' as NavGroupKey,
  }),
  
  COMPLIANCE_REPORT: (_isFieldStaffShell: boolean): NavItem => ({
    label: 'コンプラ報告',
    to: '/compliance',
    isActive: (pathname: string) => pathname.startsWith('/compliance'),
    icon: undefined,
    audience: 'staff' as NavAudience,
    group: 'operations' as NavGroupKey,
  }),
  
  COMPLIANCE_DASHBOARD: (_isFieldStaffShell: boolean): NavItem => ({
    label: '適正化運用',
    to: '/admin/compliance-dashboard',
    isActive: (pathname: string) => pathname === '/admin/compliance-dashboard',
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'operations' as NavGroupKey,
    tier: 'admin' as const,
  }),
  
  REGULATORY_DASHBOARD: (_isFieldStaffShell: boolean): NavItem => ({
    label: '制度遵守',
    to: '/admin/regulatory-dashboard',
    isActive: (pathname: string) => pathname === '/admin/regulatory-dashboard',
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'operations' as NavGroupKey,
    tier: 'admin' as const,
  }),
  
  ADMIN_STAFF_ATTENDANCE: (_isFieldStaffShell: boolean): NavItem => ({
    label: '職員勤怠管理',
    to: '/admin/staff-attendance',
    isActive: (pathname: string) => pathname.startsWith('/admin/staff-attendance'),
    icon: undefined,
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'operations' as NavGroupKey,
  }),
  
  EXCEPTION_CENTER: (_isFieldStaffShell: boolean): NavItem => ({
    label: '例外センター',
    to: '/admin/exception-center',
    isActive: (pathname: string) => pathname.startsWith('/admin/exception-center'),
    icon: undefined,
    testId: TESTIDS.nav.exceptionCenter,
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'operations' as NavGroupKey,
    tier: 'admin' as const,
    featureFlag: 'todayLiteNavV2' as const,
  }),
};

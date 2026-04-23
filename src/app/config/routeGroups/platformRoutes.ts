/**
 * Platform Routes — group: 'platform'
 *
 * NavItem constants for the 管理基盤 navigation group.
 */
import type { NavAudience, NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

export const PLATFORM_ROUTES = {
  ADMIN: (_isFieldStaffShell: boolean): NavItem => ({
    label: '管理ツール',
    to: '/admin',
    isActive: (pathname: string) => (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/checklist') || pathname.startsWith('/audit') || pathname.startsWith('/settings/')) && !pathname.startsWith('/admin/exception-center') && !pathname.startsWith('/admin/compliance-dashboard') && !pathname.startsWith('/admin/regulatory-dashboard'),
    icon: undefined,
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'platform' as NavGroupKey,
  }),
  
  TELEMETRY: (_isFieldStaffShell: boolean): NavItem => ({
    label: 'テレメトリ',
    to: '/admin/telemetry',
    isActive: (pathname: string) => pathname === '/admin/telemetry',
    icon: undefined,
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'platform' as NavGroupKey,
    tier: 'admin' as const,
  }),
  
  STATUS: (_isFieldStaffShell: boolean): NavItem => ({
    label: '環境診断',
    to: '/admin/status',
    isActive: (pathname: string) => pathname === '/admin/status',
    icon: undefined,
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'platform' as NavGroupKey,
    tier: 'admin' as const,
  }),
};

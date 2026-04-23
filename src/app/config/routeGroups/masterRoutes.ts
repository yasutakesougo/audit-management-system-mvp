/**
 * Master Routes — group: 'master'
 *
 * NavItem constants for the 利用者・職員 navigation group.
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import type { NavAudience, NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

export const MASTER_ROUTES = {
  USERS: (_isFieldStaffShell: boolean): NavItem => ({
    label: '利用者',
    to: '/users',
    isActive: (pathname: string) => pathname.startsWith('/users'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.users,
    audience: NAV_AUDIENCE.staff as NavAudience,
    group: 'master' as NavGroupKey,
  }),
  
  STAFF: (_isFieldStaffShell: boolean): NavItem => ({
    label: '職員',
    to: '/staff',
    isActive: (pathname: string) => pathname.startsWith('/staff') && !pathname.startsWith('/staff/attendance'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.staff,
    audience: NAV_AUDIENCE.admin as NavAudience, // Corrected to admin as per navigationConfig.ts
    group: 'master' as NavGroupKey,
  }),
};

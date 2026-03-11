/**
 * Master Routes — group: 'master'
 *
 * NavItem constants for the 利用者・職員 navigation group.
 * Extracted from navigationConfig.ts createNavItems() for single-responsibility.
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import type { NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

/** Unconditional master group items */
export const MASTER_ROUTES: NavItem[] = [
  {
    label: '利用者',
    to: '/users',
    isActive: (pathname: string) => pathname.startsWith('/users'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.users,
    audience: NAV_AUDIENCE.staff,
    group: 'master' as NavGroupKey,
  },
  {
    label: '職員',
    to: '/staff',
    isActive: (pathname: string) =>
      pathname.startsWith('/staff') && !pathname.startsWith('/staff/attendance'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.staff,
    audience: NAV_AUDIENCE.staff,
    group: 'master' as NavGroupKey,
  },
];

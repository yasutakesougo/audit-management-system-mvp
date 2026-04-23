/**
 * Billing Routes — group: 'billing'
 *
 * NavItem constants for the 請求処理 navigation group.
 */
import { TESTIDS } from '@/testids';
import type { NavAudience, NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

export const BILLING_ROUTES = {
  HUB: (_isFieldStaffShell: boolean): NavItem => ({
    label: '請求処理',
    to: '/billing',
    isActive: (pathname: string) => pathname === '/billing' || pathname.startsWith('/billing/'),
    icon: undefined,
    testId: TESTIDS.nav.billing,
    audience: [NAV_AUDIENCE.reception, NAV_AUDIENCE.admin] as NavAudience[],
    group: 'billing' as NavGroupKey,
  }),
};

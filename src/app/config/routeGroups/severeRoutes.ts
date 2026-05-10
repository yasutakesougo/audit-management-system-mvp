/**
 * Severe Routes — group: 'severe'
 *
 * NavItem constants for the 重症児支援 navigation group.
 */
import { TESTIDS } from '@/testids';
import type { NavAudience, NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

export const SEVERE_ROUTES = {
  SUPPORT_REVIEW_HUB: (_isFieldStaffShell: boolean): NavItem => ({
    label: '支援の確認・見直し',
    to: '/support-review',
    isActive: (pathname: string) => pathname.startsWith('/support-review'),
    icon: undefined,
    testId: TESTIDS.nav.supportReviewHub,
    audience: NAV_AUDIENCE.staff as NavAudience,
    group: 'severe' as NavGroupKey,
  }),
};

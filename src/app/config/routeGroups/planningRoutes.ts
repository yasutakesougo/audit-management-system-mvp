/**
 * Planning Routes — group: 'planning'
 *
 * NavItem constants for the 支援計画・調整 navigation group.
 */
import type { NavAudience, NavGroupKey } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';
import { TESTIDS } from '@/testids';

export const PLANNING_ROUTES = {
  SUPPORT_PLAN_GUIDE: (_isFieldStaffShell: boolean) => ({
    label: '支援計画ガイド',
    to: '/support-plan-guide',
    isActive: (pathname: string) => pathname.startsWith('/support-plan-guide'),
    icon: undefined,
    audience: NAV_AUDIENCE.staff as NavAudience,
    group: 'planning' as NavGroupKey,
    tier: 'more' as const,
  }),
  
  ISP_EDITOR: (_isFieldStaffShell: boolean) => ({
    label: '個別支援計画更新・前回比較',
    to: '/isp-editor',
    isActive: (pathname: string) => pathname.startsWith('/isp-editor'),
    icon: undefined,
    testId: TESTIDS.nav.ispEditor,
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'planning' as NavGroupKey,
  }),
} as const;

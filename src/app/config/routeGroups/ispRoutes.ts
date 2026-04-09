/**
 * ISP Routes — group: 'isp'
 *
 * NavItem constants for the 個別支援計画 navigation group.
 * Extracted from navigationConfig.ts createNavItems() for single-responsibility.
 */
import { TESTIDS } from '@/testids';
import type { NavAudience, NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

/** Unconditional ISP group items */
export const ISP_ROUTES: NavItem[] = [
  {
    label: '個別支援計画作成',
    to: '/support-plan-guide',
    isActive: (pathname) => pathname === '/support-plan-guide',
    icon: undefined,
    testId: TESTIDS.nav.supportPlanGuide,
    audience: NAV_AUDIENCE.all as NavAudience,
    group: 'isp' as NavGroupKey,
  },
  {
    label: '個別支援計画更新（前回比較）',
    to: '/isp-editor',
    isActive: (pathname) => pathname.startsWith('/isp-editor'),
    icon: undefined,
    testId: TESTIDS.nav.ispEditor,
    audience: NAV_AUDIENCE.admin as NavAudience,
    group: 'isp' as NavGroupKey,
  },
  {
    label: '支援計画シート',
    to: '/planning-sheet-list',
    isActive: (pathname) => pathname.startsWith('/planning-sheet-list') || pathname.startsWith('/support-planning-sheet'),
    icon: undefined,
    testId: TESTIDS.nav.planningSheet,
    audience: NAV_AUDIENCE.staff,
    group: 'isp' as NavGroupKey,
  },
];

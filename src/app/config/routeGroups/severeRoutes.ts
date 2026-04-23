/**
 * Severe Routes — group: 'severe'
 *
 * NavItem constants for the 重症児支援 navigation group.
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type { NavAudience, NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

export const SEVERE_ROUTES = {
  PLANNING_SHEET: (_isFieldStaffShell: boolean): NavItem => ({
    label: '支援計画シート',
    to: '/planning-sheet-list',
    isActive: (pathname: string) => pathname.startsWith('/planning-sheet-list') || pathname.startsWith('/support-planning-sheet'),
    icon: undefined,
    testId: TESTIDS.nav.planningSheet,
    audience: NAV_AUDIENCE.staff as NavAudience,
    group: 'severe' as NavGroupKey,
  }),
  
  ASSESSMENT: (_isFieldStaffShell: boolean): NavItem => ({
    label: 'アセスメント',
    to: '/assessment',
    isActive: (pathname: string) => pathname.startsWith('/assessment'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.assessmentDashboard,
    testId: TESTIDS.nav.assessment,
    audience: NAV_AUDIENCE.staff as NavAudience,
    group: 'severe' as NavGroupKey,
  }),
  
  // From legacy ibdRoutes
  ANALYSIS: (_isFieldStaffShell: boolean): NavItem => ({
    label: '分析ワークスペース',
    to: '/analysis',
    isActive: (pathname: string) => pathname.startsWith('/analysis'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.analysisDashboard,
    testId: TESTIDS.nav.analysis,
    audience: NAV_AUDIENCE.staff as NavAudience,
    group: 'severe' as NavGroupKey,
  }),
};

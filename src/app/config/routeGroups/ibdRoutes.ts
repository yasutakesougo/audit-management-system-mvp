/**
 * IBD Routes — group: 'ibd'
 *
 * NavItem constants for the 強度行動障害支援 navigation group.
 * Extracted from navigationConfig.ts createNavItems() for single-responsibility.
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type { NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

/** Unconditional IBD group items */
export const IBD_ROUTES_BASE: NavItem[] = [
  {
    label: '支援ハブ',
    to: '/ibd',
    isActive: (pathname) => pathname === '/ibd',
    icon: undefined,
    audience: NAV_AUDIENCE.staff,
    group: 'ibd' as NavGroupKey,
  },
  {
    label: '分析ワークスペース',
    to: '/analysis',
    isActive: (pathname) => pathname.startsWith('/analysis'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.analysisDashboard,
    testId: TESTIDS.nav.analysis,
    audience: NAV_AUDIENCE.staff,
    group: 'ibd' as NavGroupKey,
  },
  {
    label: '行動対応プラン',
    to: '/analysis/intervention',
    isActive: (pathname) => pathname.startsWith('/analysis/intervention'),
    icon: undefined,
    audience: NAV_AUDIENCE.staff,
    group: 'ibd' as NavGroupKey,
  },
  {
    label: 'アセスメント',
    to: '/assessment',
    isActive: (pathname) => pathname.startsWith('/assessment'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.assessmentDashboard,
    testId: TESTIDS.nav.assessment,
    audience: NAV_AUDIENCE.staff,
    group: 'ibd' as NavGroupKey,
  },
  {
    label: '特性アンケート',
    to: '/survey/tokusei',
    isActive: (pathname) => pathname.startsWith('/survey/tokusei'),
    icon: undefined,
    audience: NAV_AUDIENCE.staff,
    group: 'ibd' as NavGroupKey,
  },
];

/** Unconditional, but appended after admin block (always last in ibd group) */
export const IBD_ROUTES_TEMPLATES: NavItem[] = [
  {
    label: '支援活動マスタ',
    to: '/admin/templates',
    isActive: (pathname: string) => pathname.startsWith('/admin'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.adminTemplates,
    prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
    testId: TESTIDS.nav.admin,
    audience: NAV_AUDIENCE.admin,
    group: 'ibd' as NavGroupKey,
  },
];

/**
 * IBD Routes — group: 'ibd'
 *
 * NavItem constants for the 強度行動障害支援 navigation group.
 * Extracted from navigationConfig.ts createNavItems() for single-responsibility.
 *
 * 2026-03-16: アセスメント活用に特化して整理。
 * 支援ハブ・行動対応プラン・支援手順マスタ・個別支援手順・支援活動マスタは
 * 支援計画シート（ISPグループ）と重複/下位のため除外。
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type { NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

/** IBD group items — アセスメント直結のみ */
export const IBD_ROUTES_BASE: NavItem[] = [
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

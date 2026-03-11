/**
 * Admin Routes — group: 'admin'
 *
 * NavItem constants for the システム管理 navigation group.
 * All items in this file are gated by: isAdmin && (authzReady || skipLogin).
 * Extracted from navigationConfig.ts createNavItems() for single-responsibility.
 */
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type { NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

/**
 * Core admin block — added when isAdmin && (authzReady || skipLogin).
 * Preserves original push order: step-templates, individual-support,
 * staff-attendance, checklist, audit.
 */
export const ADMIN_ROUTES_BASE: NavItem[] = [
  {
    label: '支援手順マスタ',
    to: '/admin/step-templates',
    isActive: (pathname: string) => pathname.startsWith('/admin/step-templates'),
    icon: undefined,
    audience: NAV_AUDIENCE.admin,
    group: 'ibd' as NavGroupKey,
  },
  {
    label: '個別支援手順',
    to: '/admin/individual-support',
    isActive: (pathname: string) => pathname.startsWith('/admin/individual-support'),
    icon: undefined,
    audience: NAV_AUDIENCE.admin,
    group: 'ibd' as NavGroupKey,
  },
  {
    label: '職員勤怠管理',
    to: '/admin/staff-attendance',
    isActive: (pathname: string) => pathname.startsWith('/admin/staff-attendance'),
    icon: undefined,
    audience: NAV_AUDIENCE.admin,
    group: 'ops' as NavGroupKey,
  },
  {
    label: '自己点検',
    to: '/checklist',
    isActive: (pathname: string) => pathname.startsWith('/checklist'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.checklist,
    testId: TESTIDS.nav.checklist,
    audience: NAV_AUDIENCE.admin,
    group: 'admin' as NavGroupKey,
  },
  {
    label: '監査ログ',
    to: '/audit',
    isActive: (pathname: string) => pathname.startsWith('/audit'),
    testId: TESTIDS.nav.audit,
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.audit,
    audience: NAV_AUDIENCE.admin,
    group: 'admin' as NavGroupKey,
  },
];

/**
 * Extra admin items appended after ADMIN_ROUTES_BASE + optional IRC.
 * Preserves original push order: nav-diagnostics, room-management, mode-switch.
 */
export const ADMIN_ROUTES_EXTRA: NavItem[] = [
  {
    label: 'ナビ診断',
    to: '/admin/navigation-diagnostics',
    isActive: (pathname: string) =>
      pathname.startsWith('/admin/navigation-diagnostics'),
    icon: undefined,
    testId: TESTIDS.nav.navigationDiagnostics,
    audience: NAV_AUDIENCE.admin,
    group: 'admin' as NavGroupKey,
  },
  {
    label: 'お部屋管理',
    to: '/room-management',
    isActive: (pathname: string) => pathname.startsWith('/room-management'),
    icon: undefined,
    testId: TESTIDS.nav.roomManagement,
    audience: NAV_AUDIENCE.admin,
    group: 'ops' as NavGroupKey,
  },
  {
    label: 'モード切替',
    to: '/admin/mode-switch',
    isActive: (pathname: string) => pathname.startsWith('/admin/mode-switch'),
    icon: undefined,
    audience: NAV_AUDIENCE.admin,
    group: 'admin' as NavGroupKey,
  },
];

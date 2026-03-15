/**
 * Admin Routes — group: 'ops' (管理ツール集約)
 *
 * 2026-03-16: 🛡️ システム管理・⚙️ 表示設定グループをサイドナビから廃止。
 * 自己点検・監査ログ・ナビ診断・モード切替・1日の流れ設定は
 * 管理ツール（/admin）ハブから到達可能。
 * ops グループに残す項目のみ定義。
 */
import { TESTIDS } from '@/testids';
import type { NavGroupKey, NavItem } from '../navigationConfig.types';
import { NAV_AUDIENCE } from '../navigationConfig.types';

/**
 * Core admin block — added when isAdmin && (authzReady || skipLogin).
 * ops グループの運営管理系のみ。
 */
export const ADMIN_ROUTES_BASE: NavItem[] = [
  {
    label: '職員勤怠管理',
    to: '/admin/staff-attendance',
    isActive: (pathname: string) => pathname.startsWith('/admin/staff-attendance'),
    icon: undefined,
    audience: NAV_AUDIENCE.admin,
    group: 'ops' as NavGroupKey,
  },
];

/**
 * Extra admin items: お部屋管理 + 管理ツール（ハブ）
 */
export const ADMIN_ROUTES_EXTRA: NavItem[] = [
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
    label: '管理ツール',
    to: '/admin',
    isActive: (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/checklist') || pathname.startsWith('/audit') || pathname.startsWith('/settings/'),
    icon: undefined,
    audience: NAV_AUDIENCE.admin,
    group: 'ops' as NavGroupKey,
  },
];

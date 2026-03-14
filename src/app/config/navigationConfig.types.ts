/**
 * Navigation Configuration — Type Definitions & Constants
 *
 * Extracted from navigationConfig.ts for better maintainability.
 * Contains all shared types, audience enums, group labels, and group order.
 *
 * @module app/config/navigationConfig.types
 */

import type { PrefetchKey } from '@/prefetch/routes';
import type React from 'react';

// ============================================================================
// Type Definitions
// ============================================================================

export type NavAudience = 'all' | 'staff' | 'admin' | 'reception';

export type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string, search?: string) => boolean;
  testId?: string;
  icon?: React.ElementType;
  prefetchKey?: PrefetchKey;
  prefetchKeys?: PrefetchKey[];
  audience?: NavAudience | NavAudience[];
  /** Explicit group assignment. When set, pickGroup() uses this directly. */
  group?: NavGroupKey;
};

export type NavGroupKey = 'daily' | 'record' | 'plan' | 'master' | 'admin';

/**
 * Configuration for creating navigation items
 */
export interface CreateNavItemsConfig {
  dashboardPath: string;
  currentRole: string | null;
  schedulesEnabled: boolean;
  complianceFormEnabled: boolean;
  icebergPdcaEnabled: boolean;
  staffAttendanceEnabled: boolean;
  todayOpsEnabled: boolean;
  isAdmin: boolean;
  authzReady: boolean;
  navAudience: NavAudience;
  skipLogin?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

export const NAV_AUDIENCE = {
  all: 'all',
  staff: 'staff',
  admin: 'admin',
  reception: 'reception',
} as const satisfies Record<'all' | 'staff' | 'admin' | 'reception', NavAudience>;

/**
 * i18n Keys for navigation group labels
 * Used for future internationalization support (ja/en/etc)
 */
export const NAV_GROUP_I18N_KEYS = {
  daily: 'NAV_GROUP.DAILY',
  record: 'NAV_GROUP.RECORD',
  plan: 'NAV_GROUP.PLAN',
  master: 'NAV_GROUP.MASTER',
  admin: 'NAV_GROUP.ADMIN',
} as const;

/**
 * Navigation group labels
 * Order: daily → record → review → master → admin → settings
 *
 * Phase 1 UX Optimization (2026-02-23):
 * - Updated emoji and text to improve clarity and visual hierarchy
 * - Optimized for both full-width and collapsed sidebar views
 * - Pairs with NAV_GROUP_I18N_KEYS for future i18n integration
 */
export const groupLabel: Record<NavGroupKey, string> = {
  daily: '📌 今日の業務',
  record: '📚 記録を参照',
  plan: '🧩 支援計画・分析',
  master: '👥 利用者・職員',
  admin: '⚙️ 管理',
};

/**
 * Navigation groups display order
 */
export const NAV_GROUP_ORDER: NavGroupKey[] = ['daily', 'record', 'plan', 'master', 'admin'];

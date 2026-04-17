/**
 * Navigation Configuration — Type Definitions & Constants
 *
 * Extracted from navigationConfig.ts for better maintainability.
 * Contains all shared types, audience enums, group labels, and group order.
 *
 * @module app/config/navigationConfig.types
 */

import type { PrefetchKey } from '@/prefetch/routes';
import type { HubId } from '@/app/hubs/hubTypes';
import type React from 'react';

// ============================================================================
// Type Definitions
// ============================================================================

export type NavAudience = 'all' | 'staff' | 'admin' | 'reception';
export type NavTier = 'core' | 'more' | 'admin';

export type NavItem = {
  label: string;
  to: string;
  isActive: (pathname: string, search?: string) => boolean;
  testId?: string;
  icon?: React.ElementType;
  prefetchKey?: PrefetchKey;
  prefetchKeys?: PrefetchKey[];
  audience?: NavAudience | NavAudience[];
  tier?: NavTier;
  featureFlag?: 'todayLiteNavV2';
  /** 
   * 紐づくナビゲーショングループのキー。
   * 新画面追加時、どの業務フロー/目的に沿うかを必ず指定します。
   */
  group: NavGroupKey;
  /**
   * 通知バッジまたは状態表示。
   * 例: '3', 'NEW', '🚨'
   */
  badge?: string | number;
};

/**
 * Navigation Group Keys (7-screen IA)
 *
 * @remarks
 * - today: 現場の当日実行
 * - records: 記録・振り返り
 * - planning: 支援計画・アセスメント
 * - operations: 拠点運営
 * - billing: 請求
 * - master: 利用者・職員マスタ
 * - platform: 管理基盤
 */
export type NavGroupKey = HubId;

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
  isFieldStaffShell?: boolean;
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
  today: 'NAV_GROUP.TODAY',
  records: 'NAV_GROUP.RECORDS',
  planning: 'NAV_GROUP.PLANNING',
  severe: 'NAV_GROUP.SEVERE',
  operations: 'NAV_GROUP.OPERATIONS',
  billing: 'NAV_GROUP.BILLING',
  master: 'NAV_GROUP.MASTER',
  platform: 'NAV_GROUP.PLATFORM',
} as const;

/**
 * Navigation group labels
 * Order: today → records → planning → operations → billing → master → platform
 *
 * Phase 1 UX Optimization (2026-02-23):
 * - Updated emoji and text to improve clarity and visual hierarchy
 * - Optimized for both full-width and collapsed sidebar views
 * - Pairs with NAV_GROUP_I18N_KEYS for future i18n integration
 */
export const groupLabel: Record<NavGroupKey, string> = {
  today: '📌 今日の業務',
  records: '📚 記録を参照',
  planning: '🗓️ 計画・調整',
  severe: '🔍 分析して改善',
  operations: '⚙️ 拠点運営',
  billing: '💰 請求処理',
  master: '👥 利用者・職員',
  platform: '🛡️ システム管理',
};

/**
 * Navigation groups display order
 * 7-screen IA canonical order.
 */
export const NAV_GROUP_ORDER: NavGroupKey[] = [
  'today',
  'records',
  'planning',
  'severe',
  'operations',
  'billing',
  'master',
  'platform',
];

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
  /** 
   * 紐づくナビゲーショングループのキー。
   * 新画面追加時、どの業務フロー/目的に沿うか（'daily' | 'assessment' | 'record' | 'ops' | 'admin'）を必ず指定します。
   */
  group: NavGroupKey;
};

/**
 * Navigation Group Keys (ユーザーの目的・業務フローに基づく分類)
 *
 * @remarks
 * - daily: 現場の実行 (今日の業務, スケジュール, 日次記録など現場で開く順に配置)
 * - assessment: 支援計画・アセスメント (個別支援計画(ISP), 評価, 分析など)
 * - record: 記録・振り返り (各種記録一覧, 運営状況, 分析など)
 * - ops: 拠点運営 (請求, 勤怠, カレンダーなど拠点全体の運用機能)
 * - admin: マスタ・管理 (利用者・職員マスタ, 管理ツールなど全体のハブ)
 */
export type NavGroupKey = 'daily' | 'assessment' | 'record' | 'ops' | 'admin';

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
  assessment: 'NAV_GROUP.ASSESSMENT',
  record: 'NAV_GROUP.RECORD',
  ops: 'NAV_GROUP.OPS',
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
  daily: '📌 現場の実行',
  assessment: '🧩 支援計画・アセスメント',
  record: '📚 記録・振り返り',
  ops: '🏢 拠点運営',
  admin: '⚙️ マスタ・管理',
};

/**
 * Navigation groups display order
 * admin/settings はサイドナビに項目がないため除外。
 */
export const NAV_GROUP_ORDER: NavGroupKey[] = ['daily', 'assessment', 'record', 'ops', 'admin'];

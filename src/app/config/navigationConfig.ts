/**
 * Navigation Configuration
 *
 * This file defines navigation items based on feature flags and permissions.
 * Types and constants live in navigationConfig.types.ts; helper functions
 * (pickGroup, filterNavItems, groupNavItems, isNavVisible) live in
 * navigationConfig.helpers.ts. Both are re-exported here for public API
 * compatibility.
 *
 * @module app/config/navigationConfig
 */

import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';
import type React from 'react';

// Import types and constants from extracted modules
import { isNavVisible } from './navigationConfig.helpers';
import {
    NAV_AUDIENCE,
    type CreateNavItemsConfig,
    type NavAudience,
    type NavGroupKey,
    type NavItem,
} from './navigationConfig.types';

// Re-export all types and constants for public API parity
export {
    groupLabel, NAV_AUDIENCE,
    NAV_GROUP_I18N_KEYS,
    NAV_GROUP_ORDER
} from './navigationConfig.types';
export type {
    CreateNavItemsConfig,
    NavAudience,
    NavGroupKey,
    NavItem
} from './navigationConfig.types';

// Re-export all helper functions for public API parity
export {
    filterNavItems,
    groupNavItems,
    isNavVisible,
    pickGroup
} from './navigationConfig.helpers';

// ============================================================================
// Nav Item Factory
// ============================================================================

/**
 * Creates the navigation items array based on feature flags and permissions
 *
 * This function was extracted from AppShell.tsx's useMemo for better testability.
 *
 * @param config - Configuration object containing all dependencies
 * @returns Array of navigation items
 */
export function createNavItems(config: CreateNavItemsConfig): NavItem[] {
  const {
    schedulesEnabled,
    complianceFormEnabled,
    icebergPdcaEnabled: _icebergPdcaEnabled,
    staffAttendanceEnabled,
    todayOpsEnabled,
    isAdmin,
    authzReady,
    navAudience,
    skipLogin = false,
  } = config;

  // Side-nav intentionally excludes:
  // - /analysis/iceberg-pdca/edit (edit-only)
  // - /dev/schedule-create-dialog (dev-only)
  // - /daily/activity, /daily/support-checklist, /daily/time-based
  // - /schedules/day, /schedules/month
  const items: NavItem[] = [
    // todayOps gated: 今日の業務グループ先頭
    ...(todayOpsEnabled
      ? [
          {
            label: '今日の業務',
            to: '/today',
            isActive: (pathname: string) => pathname === '/today',
            icon: undefined as React.ElementType | undefined,
            testId: TESTIDS.nav.todayOps,
            audience: NAV_AUDIENCE.all as NavAudience,
            group: 'daily' as NavGroupKey,
          },
        ]
      : []),
    {
      label: '日次記録',
      to: '/dailysupport',
      isActive: (pathname) => pathname === '/dailysupport' || pathname.startsWith('/daily/'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.dailyMenu,
      testId: TESTIDS.nav.daily,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '健康記録',
      to: '/daily/health',
      isActive: (pathname) => pathname.startsWith('/daily/health'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '申し送りタイムライン',
      to: '/handoff-timeline',
      isActive: (pathname) => pathname.startsWith('/handoff-timeline'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '申し送り分析',
      to: '/handoff-analysis',
      isActive: (pathname) => pathname.startsWith('/handoff-analysis'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
      group: 'daily' as NavGroupKey,
    },
    // 会議系は「議事録」に統合。司会ガイド・朝会夕会情報・朝会/夕会（作成）は
    // 議事録ページ内またはURL直接アクセスで到達可能。
    {
      label: '議事録',
      to: '/meeting-minutes',
      isActive: (pathname) => pathname.startsWith('/meeting-minutes') || pathname.startsWith('/meeting-guide') || pathname.startsWith('/dashboard/briefing'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '運営状況',
      to: '/dashboard',
      isActive: (pathname) => pathname === '/dashboard',
      icon: undefined,
      testId: TESTIDS.nav.dashboard,
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
    },
    {
      label: '記録一覧',
      to: '/records',
      isActive: (pathname) => pathname.startsWith('/records'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
    },
    // 月次記録・業務日誌プレビューは
    // 記録一覧（/records）のサブページとして到達可能なため、サイドナビからは除外。
    {
      label: 'サービス提供実績記録',
      to: '/records/service-provision',
      isActive: (pathname) => pathname.startsWith('/records/service-provision'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
    },
    {
      label: '個人月次業務日誌',
      to: '/records/journal/personal',
      isActive: (pathname) => pathname.startsWith('/records/journal/personal'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
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
    {
      label: 'ISP作成',
      to: '/support-plan-guide',
      isActive: (pathname) => pathname === '/support-plan-guide',
      icon: undefined,
      testId: TESTIDS.nav.supportPlanGuide,
      audience: NAV_AUDIENCE.staff,
      group: 'isp' as NavGroupKey,
    },
    {
      label: 'ISP更新（前回比較）',
      to: '/isp-editor',
      isActive: (pathname) => pathname.startsWith('/isp-editor'),
      icon: undefined,
      testId: TESTIDS.nav.ispEditor,
      audience: NAV_AUDIENCE.all,
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
    {
      label: '利用者',
      to: '/users',
      isActive: (pathname: string) => pathname.startsWith('/users'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.users,
      audience: NAV_AUDIENCE.staff,
      group: 'master' as NavGroupKey,
    },
    {
      label: '職員',
      to: '/staff',
      isActive: (pathname: string) => pathname.startsWith('/staff') && !pathname.startsWith('/staff/attendance'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.staff,
      audience: NAV_AUDIENCE.staff,
      group: 'master' as NavGroupKey,
    },
    {
      label: '請求処理',
      to: '/billing',
      isActive: (pathname) => pathname === '/billing' || pathname.startsWith('/billing/'),
      icon: undefined,
      testId: TESTIDS.nav.billing,
      audience: [NAV_AUDIENCE.reception, NAV_AUDIENCE.admin],
      group: 'ops' as NavGroupKey,
    },
  ];

  // Conditional items based on feature flags and permissions

  if (staffAttendanceEnabled) {
    items.push({
      label: '職員勤怠',
      to: '/staff/attendance',
      isActive: (pathname: string) => pathname.startsWith('/staff/attendance'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.staff,
      testId: TESTIDS.nav.staffAttendance,
      audience: NAV_AUDIENCE.staff,
      group: 'ops' as NavGroupKey,
    });
  }

  if (isAdmin && (authzReady || skipLogin)) {
    // ops グループ: 運営管理系はそのまま残す
    items.push(
      {
        label: '職員勤怠管理',
        to: '/admin/staff-attendance',
        isActive: (pathname: string) => pathname.startsWith('/admin/staff-attendance'),
        icon: undefined,
        audience: NAV_AUDIENCE.admin,
        group: 'ops' as NavGroupKey,
      },
    );
    if (schedulesEnabled) {
      items.push({
        label: '統合リソースカレンダー',
        to: '/admin/integrated-resource-calendar',
        isActive: (pathname: string) => pathname.startsWith('/admin/integrated-resource-calendar'),
        icon: undefined,
        testId: TESTIDS.nav.integratedResourceCalendar,
        audience: NAV_AUDIENCE.admin,
        group: 'ops' as NavGroupKey,
      });
    }

    items.push({
      label: 'お部屋管理',
      to: '/room-management',
      isActive: (pathname: string) => pathname.startsWith('/room-management'),
      icon: undefined,
      testId: TESTIDS.nav.roomManagement,
      audience: NAV_AUDIENCE.admin,
      group: 'ops' as NavGroupKey,
    });

    // 管理ツール（ハブ）1つに集約。
    // 自己点検・監査ログ・ナビ診断・モード切替・1日の流れ設定は
    // /admin ハブページから到達可能。
    items.push({
      label: '管理ツール',
      to: '/admin',
      isActive: (pathname: string) => pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/checklist') || pathname.startsWith('/audit') || pathname.startsWith('/settings/'),
      icon: undefined,
      audience: NAV_AUDIENCE.admin,
      group: 'ops' as NavGroupKey,
    });
  }

  // 支援活動マスタは支援計画シート（ISPグループ）に統合済みのため、
  // サイドナビからは除外。/admin/templates ルートは引き続き有効。

  // Feature-flagged items
  // NOTE: 氷山PDCA は /analysis?tab=pdca に統合済み

  if (schedulesEnabled && !items.some(item => item.testId === TESTIDS.nav.schedules)) {
    items.push({
      label: 'スケジュール',
      to: '/schedules/week',
      isActive: (pathname: string) => pathname.startsWith('/schedule') || pathname.startsWith('/schedules'),
      testId: TESTIDS.nav.schedules,
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.schedulesWeek,
      prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
    });
  }

  if (complianceFormEnabled) {
    items.push({
      label: 'コンプラ報告',
      to: '/compliance',
      isActive: (pathname: string) => pathname.startsWith('/compliance'),
      icon: undefined,
      audience: 'staff',
      group: 'ops' as NavGroupKey,
    });
  }

  // Filter by audience (using extracted helper)
  return items.filter((item) => isNavVisible(item, navAudience));
}

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
      label: '司会ガイド',
      to: '/meeting-guide',
      isActive: (pathname) => pathname.startsWith('/meeting-guide'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '朝会（作成）',
      to: '/meeting-minutes/new?category=朝会',
      isActive: (pathname, search = '') =>
        pathname.startsWith('/meeting-minutes/new') &&
        new URLSearchParams(search).get('category') === '朝会',
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '夕会（作成）',
      to: '/meeting-minutes/new?category=夕会',
      isActive: (pathname, search = '') =>
        pathname.startsWith('/meeting-minutes/new') &&
        new URLSearchParams(search).get('category') === '夕会',
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '議事録アーカイブ',
      to: '/meeting-minutes',
      isActive: (pathname) => pathname.startsWith('/meeting-minutes'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'daily' as NavGroupKey,
    },
    {
      label: '黒ノート',
      to: '/dashboard',
      isActive: (pathname) => pathname === '/dashboard',
      icon: undefined,
      testId: TESTIDS.nav.dashboard,
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
    },
    {
      label: '黒ノート一覧',
      to: '/records',
      isActive: (pathname) => pathname.startsWith('/records'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
    },
    {
      label: '月次記録',
      to: '/records/monthly',
      isActive: (pathname) => pathname.startsWith('/records/monthly'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
    },
    {
      label: 'サービス提供実績記録',
      to: '/records/service-provision',
      isActive: (pathname) => pathname.startsWith('/records/service-provision'),
      icon: undefined,
      audience: NAV_AUDIENCE.staff,
      group: 'record' as NavGroupKey,
    },
    {
      label: '業務日誌プレビュー',
      to: '/records/journal',
      isActive: (pathname) => pathname === '/records/journal',
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
    items.push(
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
      label: 'ナビ診断',
      to: '/admin/navigation-diagnostics',
      isActive: (pathname: string) => pathname.startsWith('/admin/navigation-diagnostics'),
      icon: undefined,
      testId: TESTIDS.nav.navigationDiagnostics,
      audience: NAV_AUDIENCE.admin,
      group: 'admin' as NavGroupKey,
    });

    items.push({
      label: 'お部屋管理',
      to: '/room-management',
      isActive: (pathname: string) => pathname.startsWith('/room-management'),
      icon: undefined,
      testId: TESTIDS.nav.roomManagement,
      audience: NAV_AUDIENCE.admin,
      group: 'ops' as NavGroupKey,
    });

    items.push({
      label: 'モード切替',
      to: '/admin/mode-switch',
      isActive: (pathname: string) => pathname.startsWith('/admin/mode-switch'),
      icon: undefined,
      audience: NAV_AUDIENCE.admin,
      group: 'admin' as NavGroupKey,
    });
  }

  items.push({
    label: '支援活動マスタ',
    to: '/admin/templates',
    isActive: (pathname: string) => pathname.startsWith('/admin'),
    icon: undefined,
    prefetchKey: PREFETCH_KEYS.adminTemplates,
    prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
    testId: TESTIDS.nav.admin,
    audience: NAV_AUDIENCE.admin,
    group: 'ibd' as NavGroupKey,
  });

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

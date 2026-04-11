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

import {
  getHubNavLabel,
  getHubRequiredRole,
  getHubRootPath,
  isHubPathActive,
} from '@/app/hubs/hubDefinitions';
import type { HubId } from '@/app/hubs/hubTypes';
import { PREFETCH_KEYS } from '@/prefetch/routes';
import { TESTIDS } from '@/testids';

// Import types and constants from extracted modules
import { isNavVisible, requiredRoleToNavAudience } from './navigationConfig.helpers';
import {
    NAV_AUDIENCE,
    type CreateNavItemsConfig,
    type NavGroupKey,
    type NavItem,
    type NavTier,
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
    NavItem,
    NavTier,
} from './navigationConfig.types';

// Re-export all helper functions for public API parity
export {
    buildVisibleNavItems,
    filterNavItems,
    groupNavItems,
    isNavVisible,
    pickGroup,
    requiredRoleToNavAudience,
    roleToNavAudience,
    splitNavItemsByTier,
} from './navigationConfig.helpers';

// ============================================================================
// Nav Item Factory
// ============================================================================

type HubNavItemOverrides = {
  label?: string;
  testId?: string;
  prefetchKey?: NavItem['prefetchKey'];
  prefetchKeys?: NavItem['prefetchKeys'];
  tier?: NavTier;
  isActive?: NavItem['isActive'];
};

const createHubNavItem = (hubId: HubId, overrides: HubNavItemOverrides = {}): NavItem => ({
  label: overrides.label ?? getHubNavLabel(hubId),
  to: getHubRootPath(hubId),
  isActive: overrides.isActive ?? ((pathname) => isHubPathActive(hubId, pathname)),
  icon: undefined,
  testId: overrides.testId,
  prefetchKey: overrides.prefetchKey,
  prefetchKeys: overrides.prefetchKeys,
  audience: requiredRoleToNavAudience(getHubRequiredRole(hubId)),
  group: hubId as NavGroupKey,
  tier: overrides.tier,
});

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
  // ============================================================================
  // Navigation Items
  //
  // ルール:
  // 1. 各項目は必ず group を指定し、どの目的・業務フローに属するかを明示してください。
  // 2. 各グループ内の並び順は「上から現場での使用順・頻度順」で固定しています。
  //    新機能を追加する際は、単に末尾につなげるのではなく順序を検討してください。
  // ============================================================================
  const items: NavItem[] = [
    // --- 1. 現場の実行 (daily) ---
    // 順序: 今日の業務 → 送迎配車表 → スケジュール → 日次記録 → 健康記録 → 申し送りタイムライン → 議事録
    ...(todayOpsEnabled
      ? [createHubNavItem('today', { testId: TESTIDS.nav.todayOps })]
      : []),
    {
      label: '送迎配車表',
      to: '/transport/assignments',
      isActive: (pathname) => pathname.startsWith('/transport/assignments'),
      icon: undefined,
      testId: TESTIDS.nav.transportAssignments,
      audience: NAV_AUDIENCE.staff,
      group: 'today' as NavGroupKey,
    },
    ...(schedulesEnabled
      ? [
          {
            label: 'スケジュール',
            to: '/schedules/week',
            isActive: (pathname: string) => pathname.startsWith('/schedule') || pathname.startsWith('/schedules'),
            testId: TESTIDS.nav.schedules,
            icon: undefined,
            prefetchKey: PREFETCH_KEYS.schedulesWeek,
            prefetchKeys: [PREFETCH_KEYS.muiForms, PREFETCH_KEYS.muiOverlay],
            audience: NAV_AUDIENCE.staff, // [Audience] 現場職員以上の権限で表示
            group: 'today' as NavGroupKey, // [Group] 現場実行グループ
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
      audience: NAV_AUDIENCE.all,      // [Audience] パート含め全ロールに露出（最重要アクション）
      group: 'today' as NavGroupKey,   // [Group] 現場実行グループ
    },
    {
      label: '健康記録',
      to: '/daily/health',
      isActive: (pathname) => pathname.startsWith('/daily/health'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'today' as NavGroupKey,
    },
    {
      label: '申し送りタイムライン',
      to: '/handoff-timeline',
      isActive: (pathname) => pathname.startsWith('/handoff-timeline'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'today' as NavGroupKey,
    },
    {
      // 会議系は「議事録」に統合。司会ガイド・朝会夕会情報・朝会/夕会（作成）は議事録ページ内またはURL直接アクセスで到達可能。
      label: '議事録',
      to: '/meeting-minutes',
      isActive: (pathname) => pathname.startsWith('/meeting-minutes') || pathname.startsWith('/meeting-guide') || pathname.startsWith('/dashboard/briefing'),
      icon: undefined,
      audience: NAV_AUDIENCE.all,
      group: 'today' as NavGroupKey,
      tier: 'more',                   // [Tier] 頻度が低いため Lite Nav では隠蔽対象
      featureFlag: 'todayLiteNavV2',  // [FF] Lite Nav 有効時のみティア制限を適用
    },

    // --- 2. 支援計画・アセスメント (assessment) ---
    // 順序: ISP作成・更新 → 支援計画シート → アセスメント系 → 分析系 → アンケート
    createHubNavItem('planning', {
      // Hub 自体の active は /planning 配下に限定し、配下業務画面との二重 active は避ける。
      isActive: (pathname) => pathname === '/planning' || pathname.startsWith('/planning/'),
    }),
    {
      label: '個別支援計画',
      to: '/support-plan-guide',
      isActive: (pathname) => pathname === '/support-plan-guide',
      icon: undefined,
      testId: TESTIDS.nav.supportPlanGuide,
      audience: NAV_AUDIENCE.all,
      group: 'planning' as NavGroupKey,
    },
    {
      label: 'モニタリング記録',
      to: '/records/monthly',
      isActive: (pathname) => pathname.startsWith('/records/monthly'),
      icon: undefined,
      testId: 'nav-monitoring-record',
      audience: NAV_AUDIENCE.staff,
      group: 'severe' as NavGroupKey,
    },
    {
      label: '支援計画シート',
      to: '/planning-sheet-list',
      isActive: (pathname) => pathname.startsWith('/planning-sheet-list') || pathname.startsWith('/support-planning-sheet'),
      icon: undefined,
      testId: TESTIDS.nav.planningSheet,
      audience: NAV_AUDIENCE.staff,
      group: 'severe' as NavGroupKey,
    },
    {
      label: 'アセスメント',
      to: '/assessment',
      isActive: (pathname) => pathname.startsWith('/assessment'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.assessmentDashboard,
      testId: TESTIDS.nav.assessment,
      audience: NAV_AUDIENCE.staff,
      group: 'severe' as NavGroupKey,
    },
    {
      label: '行動分析',
      to: '/analysis/dashboard',
      isActive: (pathname) => pathname.startsWith('/analysis'),
      icon: undefined,
      testId: 'nav-analysis-workspace',
      audience: NAV_AUDIENCE.all,
      group: 'severe' as NavGroupKey,
      tier: 'more',
      featureFlag: 'todayLiteNavV2',
    },

    // --- 3. 記録・振り返り (record) ---
    // 順序: 運営状況 → 記録一覧(日々のサマリー) → サービス提供実績記録 → 個人月次業務日誌 → 申し送り分析
    {
      // Tier B: Mock混在。管理者のみ表示。
      label: '運営状況',
      to: '/dashboard',
      isActive: (pathname) => pathname === '/dashboard',
      icon: undefined,
      testId: TESTIDS.nav.dashboard,
      audience: NAV_AUDIENCE.admin,
      group: 'records' as NavGroupKey,
      tier: 'admin',
      featureFlag: 'todayLiteNavV2',
    },
    createHubNavItem('records'),
    {
      // 月次記録・業務日誌プレビューは、記録一覧（/records）のサブページとして到達可能なためサイドナビから除外
      label: 'サービス提供実績記録',
      to: '/records/service-provision',
      isActive: (pathname) => pathname.startsWith('/records/service-provision'),
      icon: undefined,
      audience: NAV_AUDIENCE.reception,
      group: 'records' as NavGroupKey,
    },
    {
      label: '個人月次業務日誌',
      to: '/records/journal/personal',
      isActive: (pathname) => pathname.startsWith('/records/journal/personal'),
      icon: undefined,
      audience: NAV_AUDIENCE.reception,
      group: 'records' as NavGroupKey,
    },
    {
      // Tier B: SP接続済だが本番運用未検証。管理者のみ表示。
      label: '申し送り分析',
      to: '/handoff-analysis',
      isActive: (pathname) => pathname.startsWith('/handoff-analysis'),
      icon: undefined,
      audience: NAV_AUDIENCE.admin,
      group: 'records' as NavGroupKey,
      tier: 'admin',
      featureFlag: 'todayLiteNavV2',
    },

    // --- 4. 拠点運営 (ops) ---
    // 順序: 運用メトリクス → 請求処理 → (以下条件付で追加) 職員勤怠 → 統合カレンダー等 → コンプライアンス監査
    // NOTE: 「運営スケジュール」は /schedules/week?tab=ops に統合済み（PR #1121）。
    //       独立ナビ項目は削除し、「スケジュール」タブから到達する。
    createHubNavItem('operations', { tier: 'admin' }),
    {
      // Tier C: Mock依存。管理者のみ表示。
      label: '運用メトリクス',
      to: '/ops',
      isActive: (pathname) => pathname === '/ops' || pathname.startsWith('/ops/'),
      icon: undefined,
      audience: NAV_AUDIENCE.admin,   // [Audience] 施設長のみ（収支・稼働率等）
      group: 'operations' as NavGroupKey,
      tier: 'admin',                  // [Tier] 管理エリア
      featureFlag: 'todayLiteNavV2',
    },
    createHubNavItem('billing', { testId: TESTIDS.nav.billing }),

    // --- 5. マスタ・管理 (admin) ---
    // 順序: 利用者マスタ → 職員マスタ → (以下条件付で追加) 管理ツール (システム設定ハブ/チェックリスト等)
    createHubNavItem('master'),
    createHubNavItem('platform'),
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
      audience: NAV_AUDIENCE.admin,
      group: 'master' as NavGroupKey,
    },
  ];

  // Conditional items based on feature flags and permissions

  // 支援活動マスタは支援計画シート（ISPグループ）に統合済みのためサイドナビから除外。/admin/templates ルートは引き続き有効。
  // NOTE: 氷山PDCA は /analysis?tab=pdca に統合済み

  // --- 拠点運営 (ops) ---
  if (staffAttendanceEnabled) {
    items.push({
      label: '職員勤怠',
      to: '/staff/attendance',
      isActive: (pathname: string) => pathname.startsWith('/staff/attendance'),
      icon: undefined,
      prefetchKey: PREFETCH_KEYS.staff,
      testId: TESTIDS.nav.staffAttendance,
      audience: NAV_AUDIENCE.reception,
      group: 'operations' as NavGroupKey,
    });
  }

  if (complianceFormEnabled) {
    items.push({
      label: 'コンプラ報告',
      to: '/compliance',
      isActive: (pathname: string) => pathname.startsWith('/compliance'),
      icon: undefined,
      audience: 'staff',
      group: 'operations' as NavGroupKey,
    });
  }

  if (isAdmin && (authzReady || skipLogin)) {
    items.push({
      label: '職員勤怠管理',
      to: '/admin/staff-attendance',
      isActive: (pathname: string) => pathname.startsWith('/admin/staff-attendance'),
      icon: undefined,
      audience: NAV_AUDIENCE.admin,
      group: 'operations' as NavGroupKey,
    });

    if (schedulesEnabled) {
      items.push({
        label: '統合リソースカレンダー',
        to: '/admin/integrated-resource-calendar',
        isActive: (pathname: string) => pathname.startsWith('/admin/integrated-resource-calendar'),
        icon: undefined,
        testId: TESTIDS.nav.integratedResourceCalendar,
        audience: NAV_AUDIENCE.admin,
        group: 'operations' as NavGroupKey,
      });
    }

    items.push({
      label: 'お部屋管理',
      to: '/room-management',
      isActive: (pathname: string) => pathname.startsWith('/room-management'),
      icon: undefined,
      testId: TESTIDS.nav.roomManagement,
      audience: NAV_AUDIENCE.admin,
      group: 'operations' as NavGroupKey,
    });

    // --- 拠点運営 (ops) --- 例外センター
    items.push({
      label: '例外センター',
      to: '/admin/exception-center',
      isActive: (pathname: string) => pathname.startsWith('/admin/exception-center'),
      icon: undefined,
      testId: TESTIDS.nav.exceptionCenter,
      audience: NAV_AUDIENCE.admin,   // [Audience] 管理者のみ（エラー・逸脱対応）
      group: 'operations' as NavGroupKey,
      tier: 'admin',                  // [Tier] 異常検知・リカバリ用
      featureFlag: 'todayLiteNavV2',
    });

    // --- マスタ・管理 (admin) ---
    // 管理ツール（ハブ）1つに集約。
    // 自己点検・監査ログ・ナビ診断・モード切替・1日の流れ設定は /admin ハブページから到達可能。
    items.push({
      label: '管理ツール',
      to: '/admin',
      isActive: (pathname: string) => (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/checklist') || pathname.startsWith('/audit') || pathname.startsWith('/settings/')) && !pathname.startsWith('/admin/exception-center'),
      icon: undefined,
      audience: NAV_AUDIENCE.admin,
      group: 'platform' as NavGroupKey,
    });
  }

  // Filter by audience (using extracted helper)
  return items.filter((item) => isNavVisible(item, navAudience));
}

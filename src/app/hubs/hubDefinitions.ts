import { canAccess } from '@/auth/roles';
import type { Role } from '@/auth/roles';
import type { HubDefinition, HubEntryCard, HubEntryStatus, HubId } from './hubTypes';

export const HUB_DEFINITIONS: Record<HubId, HubDefinition> = {
  today: {
    id: 'today',
    title: 'Today',
    subtitle: '現場の司令塔',
    purpose: '今やることを確認する',
    emptyStateTitle: '表示できる導線がありません',
    emptyStateDescription: '権限設定または機能公開設定を確認してください。',
    primaryCtaLabel: '今日の業務を開く',
    telemetryName: 'hub_today_view',
    requiredRole: 'viewer',
    pageTitle: 'Today',
    breadcrumbLabel: 'Today',
    analyticsName: 'hub_today',
    rootPath: '/today',
    navLabel: '今日の業務',
    activePathPrefixes: [
      '/today',
      '/transport/assignments',
      '/daily',
      '/dailysupport',
      '/handoff-timeline',
      '/meeting-minutes',
      '/meeting-guide',
      '/dashboard/briefing',
      '/schedule',
      '/schedules',
    ],
    primaryEntries: [
      {
        id: 'today-ops',
        title: '今日の業務',
        description: '当日の優先タスクを確認',
        to: '/today',
        status: 'primary',
        kpiWeight: 100,
        usagePriority: 1,
      },
      {
        id: 'today-attendance',
        title: '通所管理',
        description: '出欠と受け入れ状況を更新',
        to: '/daily/attendance',
        kpiWeight: 96,
        usagePriority: 2,
      },
      {
        id: 'today-record',
        title: '日々の記録',
        description: '日中の記録を入力',
        to: '/daily/table',
        kpiWeight: 92,
        usagePriority: 3,
      },
      {
        id: 'today-handoff',
        title: '申し送り',
        description: '共有事項を確認・登録',
        to: '/handoff-timeline',
        kpiWeight: 88,
        usagePriority: 4,
      },
    ],
    secondaryEntries: [
      {
        id: 'today-transport',
        title: '送迎配車表',
        description: '送迎の割当と時刻を確認',
        to: '/transport/assignments',
        kpiWeight: 72,
        usagePriority: 5,
      },
      {
        id: 'today-health',
        title: '健康記録',
        description: '体調・バイタル情報を記録',
        to: '/daily/health',
        kpiWeight: 68,
        usagePriority: 6,
      },
    ],
  },
  records: {
    id: 'records',
    title: 'Records',
    subtitle: '記録と振り返り',
    purpose: '記録を書く・確認する',
    emptyStateTitle: '表示できる導線がありません',
    emptyStateDescription: '記録関連の権限設定を確認してください。',
    primaryCtaLabel: '記録を開く',
    telemetryName: 'hub_records_view',
    requiredRole: 'viewer',
    pageTitle: 'Records',
    breadcrumbLabel: 'Records',
    analyticsName: 'hub_records',
    rootPath: '/records',
    navLabel: '記録一覧',
    activePathPrefixes: ['/records', '/handoff-analysis'],
    primaryEntries: [
      {
        id: 'records-list',
        title: '記録一覧',
        description: '日々の記録の一覧を確認',
        to: '/records',
        status: 'primary',
        kpiWeight: 95,
        usagePriority: 1,
      },
      {
        id: 'records-monthly',
        title: '月次サマリー',
        description: '月単位で進捗を確認',
        to: '/records/monthly',
        kpiWeight: 90,
        usagePriority: 2,
      },
      {
        id: 'records-service',
        title: 'サービス提供実績記録',
        description: '提供実績を登録・確認',
        to: '/records/service-provision',
        kpiWeight: 88,
        usagePriority: 3,
      },
      {
        id: 'records-journal',
        title: '個人月次業務日誌',
        description: '個人単位で振り返る',
        to: '/records/journal/personal',
        kpiWeight: 84,
        usagePriority: 4,
      },
    ],
    secondaryEntries: [
      {
        id: 'records-handoff-analysis',
        title: '申し送り分析',
        description: '傾向を分析して改善に繋げる',
        to: '/handoff-analysis',
        requiredRole: 'admin',
        kpiWeight: 60,
        usagePriority: 5,
      },
    ],
  },
  planning: {
    id: 'planning',
    title: 'Planning',
    subtitle: '計画作成と見直し',
    purpose: '計画を作成・見直しする',
    emptyStateTitle: '表示できる導線がありません',
    emptyStateDescription: '計画機能の権限設定を確認してください。',
    primaryCtaLabel: '計画を開く',
    telemetryName: 'hub_planning_view',
    helpLink:
      'https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/docs/ai-isp-three-layer-protocol.md',
    requiredRole: 'viewer',
    standaloneRoute: true,
    pageTitle: 'Planning',
    breadcrumbLabel: 'Planning',
    analyticsName: 'hub_planning',
    rootPath: '/planning',
    navLabel: 'Planning',
    activePathPrefixes: [
      '/planning',
      '/support-plan-guide',
      '/isp-editor',
      '/planning-sheet-list',
      '/support-planning-sheet',
      '/assessment',
      '/analysis',
      '/survey/tokusei',
    ],
    primaryEntries: [
      {
        id: 'planning-guide',
        title: '個別支援計画',
        description: '個別支援計画を作成・見直し',
        to: '/support-plan-guide',
        status: 'primary',
        kpiWeight: 96,
        usagePriority: 1,
      },
      {
        id: 'planning-sheet-list',
        title: '支援計画シート',
        description: '計画シートの一覧と詳細を管理',
        to: '/planning-sheet-list',
        kpiWeight: 91,
        usagePriority: 2,
      },
      {
        id: 'planning-assessment',
        title: 'アセスメント',
        description: '評価情報を確認・入力',
        to: '/assessment',
        kpiWeight: 89,
        usagePriority: 3,
      },
      {
        id: 'planning-monitoring',
        title: 'モニタリング記録',
        description: '進捗確認と月次記録を管理',
        to: '/records/monthly',
        requiredRole: 'reception',
        kpiWeight: 87,
        usagePriority: 4,
      },
    ],
    secondaryEntries: [
      {
        id: 'planning-analysis',
        title: '分析ワークスペース',
        description: '分析と仮説整理を実施',
        to: '/analysis',
        requiredRole: 'viewer',
        kpiWeight: 74,
        usagePriority: 5,
      },
      {
        id: 'planning-survey',
        title: '特性アンケート',
        description: '特性データを確認',
        to: '/survey/tokusei',
        requiredRole: 'admin',
        kpiWeight: 70,
        usagePriority: 6,
      },
      {
        id: 'planning-compare',
        title: '個別支援計画更新（前回比較）',
        description: '前回版との差分を確認して更新',
        to: '/isp-editor',
        requiredRole: 'admin',
        kpiWeight: 68,
        usagePriority: 7,
        rolePriority: { admin: 1 },
      },
    ],
  },
  operations: {
    id: 'operations',
    title: 'Operations',
    subtitle: '運営状況の把握と調整',
    purpose: '運営状況を把握・調整する',
    emptyStateTitle: '表示できる導線がありません',
    emptyStateDescription: '運営機能の権限設定を確認してください。',
    primaryCtaLabel: '運営画面を開く',
    telemetryName: 'hub_operations_view',
    helpLink:
      'https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/docs/ops/ops-dashboard-observability-layer.md',
    requiredRole: 'viewer',
    standaloneRoute: true,
    pageTitle: 'Operations',
    breadcrumbLabel: 'Operations',
    analyticsName: 'hub_operations',
    rootPath: '/operations',
    navLabel: 'Operations',
    activePathPrefixes: [
      '/operations',
      '/ops',
      '/staff/attendance',
      '/admin/staff-attendance',
      '/admin/integrated-resource-calendar',
      '/room-management',
      '/admin/exception-center',
      '/compliance',
    ],
    primaryEntries: [
      {
        id: 'operations-metrics',
        title: '運用メトリクス',
        description: '運営状態を俯瞰',
        to: '/ops',
        status: 'primary',
        kpiWeight: 95,
        usagePriority: 1,
        rolePriority: { admin: 1 },
      },
      {
        id: 'operations-attendance',
        title: '職員勤怠',
        description: '当日の勤怠入力',
        to: '/staff/attendance',
        requiredRole: 'reception',
        kpiWeight: 94,
        usagePriority: 2,
        rolePriority: { reception: 1, admin: 2 },
      },
      {
        id: 'operations-attendance-admin',
        title: '職員勤怠管理',
        description: '勤怠の確定・管理',
        to: '/admin/staff-attendance',
        requiredRole: 'reception',
        kpiWeight: 92,
        usagePriority: 3,
        rolePriority: { reception: 2, admin: 3 },
      },
      {
        id: 'operations-calendar',
        title: '統合リソースカレンダー',
        description: 'リソース単位で予定を管理',
        to: '/admin/integrated-resource-calendar',
        requiredRole: 'admin',
        kpiWeight: 86,
        usagePriority: 4,
      },
    ],
    secondaryEntries: [
      {
        id: 'operations-room',
        title: 'お部屋管理',
        description: '部屋割と運用設定',
        to: '/room-management',
        requiredRole: 'admin',
        kpiWeight: 72,
        usagePriority: 5,
      },
      {
        id: 'operations-exception',
        title: '例外センター',
        description: '例外対応を集約',
        to: '/admin/exception-center',
        requiredRole: 'admin',
        kpiWeight: 70,
        usagePriority: 6,
      },
      {
        id: 'operations-compliance',
        title: 'コンプラ報告',
        description: 'コンプライアンス報告',
        to: '/compliance',
        kpiWeight: 68,
        usagePriority: 7,
      },
    ],
  },
  billing: {
    id: 'billing',
    title: 'Billing',
    subtitle: '請求と精算',
    purpose: '請求・精算を行う',
    emptyStateTitle: '請求関連の導線がありません',
    emptyStateDescription: '請求機能は受付または管理者ロールで利用できます。',
    primaryCtaLabel: '請求画面を開く',
    telemetryName: 'hub_billing_view',
    helpLink:
      'https://github.com/yasutakesougo/audit-management-system-mvp/blob/main/docs/authorization/reception-migration-plan.md',
    requiredRole: 'reception',
    pageTitle: 'Billing',
    breadcrumbLabel: 'Billing',
    analyticsName: 'hub_billing',
    rootPath: '/billing',
    navLabel: '請求処理',
    showComingSoonEntries: true,
    activePathPrefixes: ['/billing'],
    primaryEntries: [
      {
        id: 'billing-main',
        title: '請求処理',
        description: '請求業務の実行画面',
        to: '/billing',
        requiredRole: 'reception',
        status: 'primary',
        kpiWeight: 98,
        usagePriority: 1,
        rolePriority: { reception: 1, admin: 2 },
      },
    ],
    secondaryEntries: [
      {
        id: 'billing-service-record',
        title: 'サービス提供実績記録',
        description: '請求根拠となる実績を確認',
        to: '/records/service-provision',
        requiredRole: 'reception',
        kpiWeight: 82,
        usagePriority: 2,
      },
      {
        id: 'billing-reconciliation',
        title: '精算ダッシュボード',
        description: '請求後の精算状況を確認',
        requiredRole: 'reception',
        status: 'comingSoon',
        badge: '準備中',
        kpiWeight: 40,
        usagePriority: 3,
      },
    ],
  },
  master: {
    id: 'master',
    title: 'Master',
    subtitle: '利用者・職員データ管理',
    purpose: 'マスタ情報を管理する',
    emptyStateTitle: '表示できる導線がありません',
    emptyStateDescription: 'マスタ機能の権限設定を確認してください。',
    primaryCtaLabel: 'マスタを開く',
    telemetryName: 'hub_master_view',
    requiredRole: 'reception',
    standaloneRoute: true,
    pageTitle: 'Master',
    breadcrumbLabel: 'Master',
    analyticsName: 'hub_master',
    rootPath: '/master',
    navLabel: 'Master',
    activePathPrefixes: ['/master', '/users', '/staff'],
    inactivePathPrefixes: ['/staff/attendance'],
    primaryEntries: [
      {
        id: 'master-users',
        title: '利用者',
        description: '利用者マスタを管理',
        to: '/users',
        status: 'primary',
        kpiWeight: 96,
        usagePriority: 1,
      },
      {
        id: 'master-staff',
        title: '職員',
        description: '職員マスタを管理',
        to: '/staff',
        kpiWeight: 93,
        usagePriority: 2,
      },
    ],
    secondaryEntries: [
      {
        id: 'master-templates',
        title: '支援活動テンプレート',
        description: '活動テンプレートを編集',
        to: '/admin/templates',
        requiredRole: 'admin',
        kpiWeight: 70,
        usagePriority: 3,
      },
    ],
  },
  platform: {
    id: 'platform',
    title: 'Platform',
    subtitle: 'システム運用基盤',
    purpose: 'システム設定と運用基盤を扱う',
    emptyStateTitle: '管理導線がありません',
    emptyStateDescription: '管理者権限でアクセスすると利用可能な導線が表示されます。',
    primaryCtaLabel: '管理画面を開く',
    telemetryName: 'hub_platform_view',
    requiredRole: 'admin',
    standaloneRoute: true,
    pageTitle: 'Platform',
    breadcrumbLabel: 'Platform',
    analyticsName: 'hub_platform',
    rootPath: '/platform',
    navLabel: 'Platform',
    activePathPrefixes: ['/platform', '/admin', '/checklist', '/audit', '/settings'],
    inactivePathPrefixes: [
      '/admin/exception-center',
      '/admin/staff-attendance',
      '/admin/integrated-resource-calendar',
    ],
    primaryEntries: [
      {
        id: 'platform-admin-hub',
        title: '管理ツール',
        description: '管理機能のハブ',
        to: '/admin',
        requiredRole: 'admin',
        status: 'primary',
        kpiWeight: 98,
        usagePriority: 1,
      },
      {
        id: 'platform-checklist',
        title: '自己点検',
        description: '運用チェックを実施',
        to: '/checklist',
        requiredRole: 'admin',
        kpiWeight: 90,
        usagePriority: 2,
      },
      {
        id: 'platform-audit',
        title: '監査ログ',
        description: '監査履歴を確認',
        to: '/audit',
        requiredRole: 'admin',
        kpiWeight: 88,
        usagePriority: 3,
      },
    ],
    secondaryEntries: [
      {
        id: 'platform-flow',
        title: '1日の流れ設定',
        description: '運用フロー設定',
        to: '/settings/operation-flow',
        requiredRole: 'admin',
        kpiWeight: 76,
        usagePriority: 4,
      },
      {
        id: 'platform-nav-diagnostics',
        title: 'ナビ診断',
        description: 'ナビゲーション診断',
        to: '/admin/navigation-diagnostics',
        requiredRole: 'admin',
        kpiWeight: 72,
        usagePriority: 5,
      },
      {
        id: 'platform-telemetry',
        title: 'テレメトリ',
        description: '運用計測を確認',
        to: '/admin/telemetry',
        requiredRole: 'admin',
        kpiWeight: 71,
        usagePriority: 6,
      },
    ],
  },
  severe: {
    id: 'severe',
    title: 'Intensive Support',
    subtitle: '強度行動障害支援',
    purpose: '強度行動障害支援の計画と分析',
    emptyStateTitle: '表示できる導線がありません',
    emptyStateDescription: '強度行動障害支援の権限設定を確認してください。',
    primaryCtaLabel: '支援画面を開く',
    telemetryName: 'hub_severe_view',
    requiredRole: 'viewer',
    standaloneRoute: true,
    pageTitle: 'Severe Support',
    breadcrumbLabel: 'Severe Support',
    analyticsName: 'hub_severe',
    rootPath: '/severe',
    navLabel: '重度支援',
    activePathPrefixes: [
      '/planning-sheet-list',
      '/support-planning-sheet',
      '/analysis/dashboard',
    ],
    primaryEntries: [
      {
        id: 'severe-sheet-list',
        title: '支援計画シート',
        description: '計画シートの一覧と詳細',
        to: '/planning-sheet-list',
        status: 'primary',
        kpiWeight: 95,
        usagePriority: 1,
      },
      {
        id: 'severe-analysis',
        title: '行動分析',
        description: '支援情報の分析',
        to: '/analysis/dashboard',
        kpiWeight: 90,
        usagePriority: 2,
      },
    ],
    secondaryEntries: [],
  },
};

export const getHubRequiredRole = (hubId: HubId): Role =>
  HUB_DEFINITIONS[hubId].requiredRole ?? 'viewer';

export const getHubRootPath = (hubId: HubId): string =>
  HUB_DEFINITIONS[hubId].rootPath;

export const getHubNavLabel = (hubId: HubId): string =>
  HUB_DEFINITIONS[hubId].navLabel ?? HUB_DEFINITIONS[hubId].title;

export const getHubPageTitle = (hubId: HubId): string =>
  HUB_DEFINITIONS[hubId].pageTitle;

export const getHubBreadcrumbLabel = (hubId: HubId): string =>
  HUB_DEFINITIONS[hubId].breadcrumbLabel;

export const getHubTelemetryName = (hubId: HubId): string =>
  HUB_DEFINITIONS[hubId].telemetryName;

export const getHubAnalyticsName = (hubId: HubId): string =>
  HUB_DEFINITIONS[hubId].analyticsName;

export const getHubSubtitle = (hubId: HubId): string =>
  HUB_DEFINITIONS[hubId].subtitle;

export const HUB_ID_ORDER: HubId[] = [
  'today',
  'records',
  'planning',
  'severe',
  'operations',
  'billing',
  'master',
  'platform',
];

export const getStandaloneHubIds = (): HubId[] =>
  HUB_ID_ORDER.filter((hubId) => Boolean(HUB_DEFINITIONS[hubId].standaloneRoute));

type HubEntrySection = 'primary' | 'secondary' | 'comingSoon';

export type HubVisibleEntries = Record<HubEntrySection, HubEntryCard[]>;

type OrderedHubEntry = {
  entry: HubEntryCard;
  order: number;
};

const entryPriority = (entry: HubEntryCard): number =>
  entry.priority ?? Number.MAX_SAFE_INTEGER;

const entryKpiWeight = (entry: HubEntryCard): number =>
  entry.kpiWeight ?? 0;

const entryUsagePriority = (entry: HubEntryCard): number =>
  entry.usagePriority ?? Number.MAX_SAFE_INTEGER;

const entryRolePriority = (entry: HubEntryCard, role: Role): number =>
  entry.rolePriority?.[role] ?? Number.MAX_SAFE_INTEGER;

const sortEntries = (entries: OrderedHubEntry[], role: Role): HubEntryCard[] =>
  entries
    .sort((a, b) =>
      entryKpiWeight(b.entry) - entryKpiWeight(a.entry) ||
      entryUsagePriority(a.entry) - entryUsagePriority(b.entry) ||
      entryRolePriority(a.entry, role) - entryRolePriority(b.entry, role) ||
      entryPriority(a.entry) - entryPriority(b.entry) ||
      a.order - b.order,
    )
    .map(({ entry }) => entry);

/**
 * Hub card ordering rule (A-phase):
 * 1. Section: primary -> secondary -> comingSoon
 * 2. Within section: kpiWeight desc
 * 3. Then usagePriority asc, rolePriority asc
 * 4. Then explicit priority asc
 * 5. Tie-breaker: declaration order in hubDefinitions
 */
export const resolveHubVisibleEntries = (hubId: HubId, role: Role): HubVisibleEntries => {
  const definition = HUB_DEFINITIONS[hubId];
  const buckets: Record<HubEntrySection, OrderedHubEntry[]> = {
    primary: [],
    secondary: [],
    comingSoon: [],
  };

  let sequence = 0;
  const collect = (entries: HubEntryCard[], defaultStatus: HubEntryStatus) => {
    for (const entry of entries) {
      if (entry.requiredRole && !canAccess(role, entry.requiredRole)) {
        sequence += 1;
        continue;
      }

      const normalizedStatus: HubEntryStatus = entry.status ?? defaultStatus;
      const isComingSoon = normalizedStatus === 'comingSoon' || !entry.to;
      if (isComingSoon) {
        if (definition.showComingSoonEntries) {
          buckets.comingSoon.push({
            entry: { ...entry, status: 'comingSoon' },
            order: sequence,
          });
        }
        sequence += 1;
        continue;
      }

      const section: HubEntrySection = normalizedStatus === 'secondary' ? 'secondary' : 'primary';
      buckets[section].push({
        entry: { ...entry, status: normalizedStatus },
        order: sequence,
      });
      sequence += 1;
    }
  };

  collect(definition.primaryEntries, 'primary');
  collect(definition.secondaryEntries ?? [], 'secondary');

  return {
    primary: sortEntries(buckets.primary, role),
    secondary: sortEntries(buckets.secondary, role),
    comingSoon: sortEntries(buckets.comingSoon, role),
  };
};

const pathMatchesPrefix = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isHubPathActive = (hubId: HubId, pathname: string): boolean => {
  const definition = HUB_DEFINITIONS[hubId];
  const activePrefixes = definition.activePathPrefixes ?? [definition.rootPath];
  const inactivePrefixes = definition.inactivePathPrefixes ?? [];
  if (inactivePrefixes.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
    return false;
  }
  return activePrefixes.some((prefix) => pathMatchesPrefix(pathname, prefix));
};

export type HubRouteMetadata = {
  hubId: HubId;
  pageTitle: string;
  breadcrumbLabel: string;
  telemetryName: string;
  analyticsName: string;
};

export const resolveHubRouteMetadata = (pathname: string): HubRouteMetadata | null => {
  const hubId = HUB_ID_ORDER.find((candidate) => isHubPathActive(candidate, pathname));
  if (!hubId) return null;
  return {
    hubId,
    pageTitle: getHubPageTitle(hubId),
    breadcrumbLabel: getHubBreadcrumbLabel(hubId),
    telemetryName: getHubTelemetryName(hubId),
    analyticsName: getHubAnalyticsName(hubId),
  };
};

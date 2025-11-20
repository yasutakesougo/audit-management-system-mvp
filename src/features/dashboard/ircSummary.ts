import { DashboardAlert, ModuleSummary } from './dashboardSummary.types';

// IRC関連の型定義（必要最小限）
export interface UnifiedResourceEvent {
  id: string;
  title: string;
  extendedProps?: {
    status?: string;
    resourceId?: string;
  };
}

export interface ResourceWarning {
  totalHours: number;
  isOver: boolean;
}

export interface IrcSummaryResult {
  module: ModuleSummary;
  alerts: DashboardAlert[];
}

/**
 * IRC（統合リソースカレンダー）のサマリーを生成する
 */
export function buildIrcSummary(
  events: UnifiedResourceEvent[],
  resourceWarnings: Record<string, ResourceWarning>
): IrcSummaryResult {
  const todayEvents = events; // 既に日次固定の前提

  const total = todayEvents.length;
  const completed = todayEvents.filter(e =>
    e.extendedProps?.status === 'completed'
  ).length;

  const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

  // 8時間超過リソースを抽出
  const overCapacityResources = Object.entries(resourceWarnings)
    .filter(([_, warning]) => warning.isOver)
    .map(([resourceId, warning]) => ({
      resourceId,
      hours: warning.totalHours
    }));

  const alerts: DashboardAlert[] = [];

  // 8時間超過アラート
  if (overCapacityResources.length > 0) {
    const severity = overCapacityResources.length > 2 ? 'error' : 'warning';
    const topResources = overCapacityResources
      .slice(0, 3)
      .map(r => `${r.resourceId}(${r.hours.toFixed(1)}h)`)
      .join('、');

    alerts.push({
      id: 'irc-over-capacity',
      module: 'irc',
      severity,
      title: `8時間超過リソース ${overCapacityResources.length}件`,
      message: `勤務時間が8hを超過: ${topResources}（シフト・休憩の見直しが必要）`,
      href: '/admin/integrated-resource-calendar',
    });
  }

  // 完了率が低い場合のアラート
  if (total > 0 && rate < 50) {
    alerts.push({
      id: 'irc-low-completion',
      module: 'irc',
      severity: 'warning',
      title: `イベント完了率 ${rate}%`,
      message: 'イベントの完了率が低い状態です',
      href: '/admin/integrated-resource-calendar',
    });
  }

  return {
    module: {
      name: 'irc',
      label: '統合リソース',
      total,
      done: completed,
      rate,
    },
    alerts,
  };
}
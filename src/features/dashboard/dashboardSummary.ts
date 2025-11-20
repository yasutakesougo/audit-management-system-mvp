import { PersonDaily } from '../../domain/daily/types';
import type { DailyUserSnapshot } from '../cross-module/types';
import { buildActivitySummary } from './activitySummary';
import { AttendanceSummaryInput, buildAttendanceSummary } from './attendanceSummary';
import { buildCrossModuleDashboardAlerts } from './crossModuleAlerts';
import { DashboardAlert, DashboardSummary, ModuleSummary, Severity } from './dashboardSummary.types';
import { buildIrcSummary, ResourceWarning, UnifiedResourceEvent } from './ircSummary';

export interface DashboardSummaryParams {
  attendance?: AttendanceSummaryInput | null;
  activity?: {
    records: PersonDaily[];
    expectedCount: number;
  } | null;
  irc?: {
    events: UnifiedResourceEvent[];
    resourceWarnings: Record<string, ResourceWarning>;
  } | null;
  snapshots?: DailyUserSnapshot[]; // ★ 追加
}

/**
 * 全モジュールのサマリーを統合する
 */
export function buildDashboardSummary(
  params: DashboardSummaryParams
): DashboardSummary {
  const modules: ModuleSummary[] = [];
  const alerts: DashboardAlert[] = [];

  // 通所管理サマリー
  if (params.attendance) {
    const result = buildAttendanceSummary(params.attendance);
    modules.push(result.module);
    alerts.push(...result.alerts);
  }

  // 支援記録（ケース記録）サマリー
  if (params.activity) {
    const result = buildActivitySummary(
      params.activity.records,
      params.activity.expectedCount
    );
    modules.push(result.module);
    alerts.push(...result.alerts);
  }

  // IRCサマリー
  if (params.irc) {
    const result = buildIrcSummary(
      params.irc.events,
      params.irc.resourceWarnings
    );
    modules.push(result.module);
    alerts.push(...result.alerts);
  }

  // ★ 追加：クロスモジュールのアラート
  if (params.snapshots) {
    const crossModuleAlerts = buildCrossModuleDashboardAlerts(params.snapshots);
    alerts.push(...crossModuleAlerts);
  }

  // アラートを重要度でソート（error → warning → info）
  const severityOrder: Record<Severity, number> = {
    error: 0,
    warning: 1,
    info: 2
  };

  alerts.sort((a, b) =>
    severityOrder[a.severity] - severityOrder[b.severity]
  );

  return {
    modules,
    alerts,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * アラートの総数をカテゴリ別に取得
 */
export function getAlertCounts(alerts: DashboardAlert[]) {
  return {
    error: alerts.filter(a => a.severity === 'error').length,
    warning: alerts.filter(a => a.severity === 'warning').length,
    info: alerts.filter(a => a.severity === 'info').length,
    total: alerts.length,
  };
}

/**
 * 最も重要なアラートを取得（上位N件）
 */
export function getTopAlerts(alerts: DashboardAlert[], limit: number = 3): DashboardAlert[] {
  return alerts.slice(0, limit);
}
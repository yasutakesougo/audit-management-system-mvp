import { resolveDashboardPath } from '@/features/dashboard/dashboardRouting';
import type { CrossModuleIssue, DailyUserSnapshot } from '../cross-module/types';
import type { DashboardAlert } from './dashboardSummary.types';

const ISSUE_PRIORITY: Record<CrossModuleIssue['severity'], number> = {
  error: 3,
  warning: 2,
  info: 1,
};

const ISSUE_TITLES: Partial<Record<CrossModuleIssue['id'], string>> = {
  'absence-activity-completed': '当日欠席なのに活動完了',
  'attending-no-service-time': '通所中だが提供時間未記録',
  'service-discrepancy-no-behavior-record': '乖離ありだが問題行動記録なし',
  'completed-attendance-missing-activity': '退所済みだが活動未作成',
};

/**
 * 1件のCrossModuleIssue → 1件のDashboardAlertに変換
 */
export function mapIssueToDashboardAlert(
  snapshot: DailyUserSnapshot,
  issue: CrossModuleIssue,
): DashboardAlert {
  const title =
    ISSUE_TITLES[issue.id] ??
    issue.message ??
    'クロスモジュール不整合';

  // どこに飛ばすか：IDごとに代表モジュールを決める
  const dashboardHref = resolveDashboardPath();
  let href = dashboardHref;
  switch (issue.id) {
    case 'absence-activity-completed':
    case 'completed-attendance-missing-activity':
      href = `/daily/activity?userId=${snapshot.userId}&date=${snapshot.date}`;
      break;
    case 'attending-no-service-time':
      href = `/daily/attendance?userId=${snapshot.userId}&date=${snapshot.date}`;
      break;
    case 'service-discrepancy-no-behavior-record':
      href = `/daily/activity?userId=${snapshot.userId}&date=${snapshot.date}`;
      break;
    default:
      href = dashboardHref;
  }

  return {
    id: `cm-${snapshot.date}-${snapshot.userId}-${issue.id}`,
    module: 'cross',
    severity: issue.severity,
    title,
    message: `${issue.message} - ${snapshot.userName}（${snapshot.date}）`,
    href,
  };
}

/**
 * DailyUserSnapshot[]全体からCrossModuleのアラート一覧を生成
 */
export function buildCrossModuleDashboardAlerts(
  snapshots: DailyUserSnapshot[],
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  for (const snapshot of snapshots) {
    const issues = snapshot.crossModuleIssues ?? [];
    for (const issue of issues) {
      alerts.push(mapIssueToDashboardAlert(snapshot, issue));
    }
  }

  // 重要度順 + 同じIDはユニーク化（念のため）
  const uniqueMap = new Map<string, DashboardAlert>();
  for (const alert of alerts) {
    const existing = uniqueMap.get(alert.id);
    if (!existing || ISSUE_PRIORITY[existing.severity] < ISSUE_PRIORITY[alert.severity]) {
      uniqueMap.set(alert.id, alert);
    }
  }

  return Array.from(uniqueMap.values()).sort((a, b) => {
    const pa = ISSUE_PRIORITY[a.severity];
    const pb = ISSUE_PRIORITY[b.severity];
    if (pa !== pb) return pb - pa; // 重要度降順
    return a.id.localeCompare(b.id);
  });
}
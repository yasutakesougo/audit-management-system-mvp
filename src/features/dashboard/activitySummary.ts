import { PersonDaily } from '../../domain/daily/types';
import { DashboardAlert, ModuleSummary } from './dashboardSummary.types';

export interface ActivitySummaryResult {
  module: ModuleSummary;
  alerts: DashboardAlert[];
}

/**
 * 支援記録（ケース記録）のサマリーを生成する
 */
export function buildActivitySummary(
  records: PersonDaily[],
  expectedCount: number
): ActivitySummaryResult {
  const today = new Date().toISOString().slice(0, 10);
  const todayRecords = records.filter(r => r.date === today);

  const done = todayRecords.filter(r => r.status === '完了').length;
  const inProgress = todayRecords.filter(r => r.status === '作成中').length;
  const notStarted = todayRecords.filter(r => r.status === '未作成').length;

  const total = expectedCount || todayRecords.length || 0;
  const rate = total === 0 ? 0 : Math.round((done / total) * 100);

  // 未作成者の上位5名を取得
  const topMissing = todayRecords
    .filter(r => r.status === '未作成')
    .slice(0, 5)
    .map(r => `${r.personName}（${r.personId}）`);

  const alerts: DashboardAlert[] = [];

  // 未作成アラート
  if (notStarted > 0) {
    const severity = notStarted > 5 ? 'error' : 'warning';
    alerts.push({
      id: 'activity-missing',
      module: 'activity',
      severity,
      title: `支援記録（ケース記録） 未作成 ${notStarted}件`,
      message: `未作成の方${topMissing.length > 0 ? `（一部）: ${topMissing.join('、')}` : 'がいます'}`,
      href: '/daily/activity',
    });
  }

  // 作成中アラート
  if (inProgress > 0) {
    alerts.push({
      id: 'activity-in-progress',
      module: 'activity',
      severity: 'info',
      title: `作成中 ${inProgress}件`,
      message: '作成中の支援記録（ケース記録）があります',
      href: '/daily/activity',
    });
  }

  return {
    module: {
      name: 'activity',
      label: '支援記録（ケース記録）',
      total,
      done,
      rate,
    },
    alerts,
  };
}
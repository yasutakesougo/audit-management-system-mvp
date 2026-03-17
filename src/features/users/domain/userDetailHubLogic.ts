/**
 * @fileoverview UserDetailHub のビジネスロジック（純粋関数）
 * @description
 * MVP-003: UserDetailPage を「利用者起点ハブ」に変換するためのロジック。
 *
 * Quick Actions: 利用者に対して実行できる主要導線
 * Summary Stats: 利用者の現在の状況サマリ
 */

// ─── Quick Actions 定義 ───────────────────────────────────────

export type QuickAction = {
  key: string;
  label: string;
  description: string;
  icon: string;         // emoji
  path: string;         // 遷移先URL
  color: 'primary' | 'secondary' | 'warning' | 'success' | 'info';
};

/**
 * 利用者IDに基づくクイックアクション一覧を生成
 */
export function buildQuickActions(userId: string): QuickAction[] {
  return [
    {
      key: 'today-record',
      label: '今日の記録',
      description: '本日の日次記録を入力・編集する',
      icon: '📝',
      path: `/daily/activity?userId=${encodeURIComponent(userId)}`,
      color: 'primary',
    },
    {
      key: 'handoff',
      label: '申し送り',
      description: '引き継ぎ情報を確認・追加する',
      icon: '📨',
      path: `/handoff/timeline?userId=${encodeURIComponent(userId)}`,
      color: 'warning',
    },
    {
      key: 'support-plan',
      label: '支援計画',
      description: '個別支援計画書を参照する',
      icon: '📋',
      path: `/users?tab=list&selected=${encodeURIComponent(userId)}`,
      color: 'secondary',
    },
    {
      key: 'record-history',
      label: '記録一覧',
      description: 'タイムラインで履歴を確認する',
      icon: '📊',
      path: `/users?tab=list&selected=${encodeURIComponent(userId)}`,
      color: 'info',
    },
  ];
}

// ─── Summary Stats 定義 ──────────────────────────────────────

export type SummaryStat = {
  key: string;
  label: string;
  value: string | number;
  icon: string;
  severity: 'normal' | 'attention' | 'good';
};

export type DailyRecordInfo = {
  date: string;
  status: string;
};

export type HandoffInfo = {
  total: number;
  criticalCount: number;
};

/**
 * 利用者のサマリー統計を計算する純粋関数
 */
export function buildSummaryStats(params: {
  latestDailyRecord?: DailyRecordInfo | null;
  todayRecordExists: boolean;
  handoffInfo?: HandoffInfo | null;
  isHighIntensity: boolean;
}): SummaryStat[] {
  const { latestDailyRecord, todayRecordExists, handoffInfo, isHighIntensity } = params;

  const stats: SummaryStat[] = [];

  // 今日の記録ステータス
  stats.push({
    key: 'today-record',
    label: '今日の記録',
    value: todayRecordExists ? '入力済み' : '未入力',
    icon: todayRecordExists ? '✅' : '⚠️',
    severity: todayRecordExists ? 'good' : 'attention',
  });

  // 最新記録日
  stats.push({
    key: 'latest-record',
    label: '最新記録日',
    value: latestDailyRecord?.date ?? '—',
    icon: '📅',
    severity: latestDailyRecord ? 'normal' : 'attention',
  });

  // 申し送り件数
  if (handoffInfo) {
    const critical = handoffInfo.criticalCount > 0;
    stats.push({
      key: 'handoff',
      label: '申し送り',
      value: `${handoffInfo.total}件${critical ? ` (重要${handoffInfo.criticalCount}件)` : ''}`,
      icon: critical ? '🔴' : '📨',
      severity: critical ? 'attention' : 'normal',
    });
  }

  // 支援区分
  stats.push({
    key: 'support-level',
    label: '支援区分',
    value: isHighIntensity ? '強度行動障害対象' : '通常支援',
    icon: isHighIntensity ? '🟠' : '🟢',
    severity: isHighIntensity ? 'attention' : 'normal',
  });

  return stats;
}

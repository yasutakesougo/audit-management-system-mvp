import { DashboardAlert, ModuleSummary } from './dashboardSummary.types';

// 通所管理のデータ型（必要最小限を定義）
export interface AttendanceUser {
  userCode: string;
  fullName: string;
  standardMinutes: number;
}

export interface AttendanceVisit {
  userCode: string;
  status: string; // '通所中' | '退所済' | etc.
  providedMinutes?: number;
  isEarlyLeave?: boolean;
}

export interface AttendanceSummaryInput {
  users: AttendanceUser[];
  visits: Record<string, AttendanceVisit>;
}

export interface AttendanceSummaryResult {
  module: ModuleSummary;
  alerts: DashboardAlert[];
}

/**
 * 通所管理のサマリーを生成する
 */
export function buildAttendanceSummary(
  input: AttendanceSummaryInput
): AttendanceSummaryResult {
  const todayVisits = Object.values(input.visits);

  const totalToday = input.users.length;
  const checkedOut = todayVisits.filter(v => v.status === '退所済').length;

  // 乖離チェック（提供時間が算定基準の80%を下回る）
  const DISCREPANCY_THRESHOLD = 0.8;
  const discrepancies = todayVisits.filter(v => {
    const provided = v.providedMinutes ?? 0;
    const user = input.users.find(u => u.userCode === v.userCode);
    if (!user || provided === 0) return false;
    return provided < user.standardMinutes * DISCREPANCY_THRESHOLD;
  });

  const earlyLeaves = todayVisits.filter(v => v.isEarlyLeave).length;

  const rate = totalToday === 0 ? 0 : Math.round((checkedOut / totalToday) * 100);

  const alerts: DashboardAlert[] = [];

  // 乖離アラート
  if (discrepancies.length > 0) {
    alerts.push({
      id: 'attendance-discrepancies',
      module: 'attendance',
      severity: discrepancies.length > 3 ? 'error' : 'warning',
      title: `乖離あり ${discrepancies.length}件`,
      message: '提供時間が算定基準を下回る利用者がいます（備考の記載を推奨）',
      href: '/daily/attendance',
    });
  }

  // 早退アラート
  if (earlyLeaves > 0) {
    alerts.push({
      id: 'attendance-early-leave',
      module: 'attendance',
      severity: 'info',
      title: `早退 ${earlyLeaves}件`,
      message: '早退の利用者がいます（理由の記録を確認してください）',
      href: '/daily/attendance',
    });
  }

  return {
    module: {
      name: 'attendance',
      label: '通所管理',
      total: totalToday,
      done: checkedOut,
      rate,
    },
    alerts,
  };
}
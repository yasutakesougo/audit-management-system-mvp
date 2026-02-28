import type { PersonDaily } from '@/features/daily';
// Note: Dashboard is another feature, but it seems to be used as a public API here if available.
// If not, we might need a barrel for dashboard too.
import type { AttendanceUser, AttendanceVisit } from '@/features/dashboard';
import {
    ActivityStatus,
    AttendanceStatus,
    CrossModuleIssue,
    DailySnapshotCollection,
    DailyUserSnapshot,
    DailyUserSnapshotInput
} from './types';

/**
 * DailyUserSnapshotInput から DailyUserSnapshot を構築
 */
export function buildDailyUserSnapshot(input: DailyUserSnapshotInput): DailyUserSnapshot {
  const snapshot: DailyUserSnapshot = {
    userId: input.userId,
    userName: input.userName,
    date: input.date,
    lastUpdated: new Date().toISOString(),
  };

  // ========================================
  // Attendance Data Population
  // ========================================
  if (input.attendanceData) {
    snapshot.attendanceStatus = input.attendanceData.status;
    snapshot.providedMinutes = input.attendanceData.providedMinutes;
    snapshot.standardMinutes = input.attendanceData.standardMinutes;
    snapshot.isEarlyLeave = input.attendanceData.isEarlyLeave;

    // 乖離チェック
    if (snapshot.providedMinutes && snapshot.standardMinutes) {
      const discrepancyThreshold = snapshot.standardMinutes * 0.8;
      snapshot.hasServiceDiscrepancy = snapshot.providedMinutes < discrepancyThreshold;
    }
  }

  // ========================================
  // Activity Data Population
  // ========================================
  if (input.activityData) {
    snapshot.activityStatus = input.activityData.status;
    snapshot.hasProblemBehavior = input.activityData.hasProblemBehavior;
    snapshot.hasSeizureRecord = input.activityData.hasSeizureRecord;
    snapshot.mealAmount = input.activityData.mealAmount;
  }

  // ========================================
  // IRC Data Population
  // ========================================
  if (input.ircData) {
    snapshot.ircStatus = input.ircData.status;
    snapshot.hasIndividualSupport = input.ircData.hasIndividualSupport;
    snapshot.hasRehabilitation = input.ircData.hasRehabilitation;
  }

  // ========================================
  // Service Provision Data Population
  // ========================================
  if (input.serviceProvisionData) {
    snapshot.serviceProvision = input.serviceProvisionData;
  }

  // ========================================
  // Cross-Module Issue Detection
  // ========================================
  snapshot.crossModuleIssues = detectCrossModuleIssues(snapshot);

  return snapshot;
}

/**
 * 既存のデモデータからDailyUserSnapshotを生成
 */
export function buildDailyUserSnapshotFromExistingData(
  userId: string,
  userName: string,
  date: string,
  personDaily?: PersonDaily,
  attendanceUser?: AttendanceUser,
  attendanceVisit?: AttendanceVisit
): DailyUserSnapshot {
  const input: DailyUserSnapshotInput = {
    userId,
    userName,
    date,
  };

  // PersonDaily から Activity データを抽出
  if (personDaily && personDaily.date === date) {
    // problemBehaviorは複数のboolean値の組み合わせ
    const problemBehavior = personDaily.data.problemBehavior;
    const hasProblemBehavior = problemBehavior ?
      (problemBehavior.selfHarm || problemBehavior.violence || problemBehavior.loudVoice || problemBehavior.pica || problemBehavior.other) : false;

    input.activityData = {
      status: personDaily.status as ActivityStatus,
      hasProblemBehavior,
      hasSeizureRecord: personDaily.data.seizureRecord?.occurred || false,
      mealAmount: personDaily.data.mealAmount,
    };
  }

  // Attendance データを抽出
  if (attendanceUser && attendanceVisit) {
    let attendanceStatus: AttendanceStatus = '未確認';

    if (attendanceVisit.status === '通所中') {
      attendanceStatus = '通所中';
    } else if (attendanceVisit.status === '退所済') {
      attendanceStatus = '退所済';
    }

    input.attendanceData = {
      status: attendanceStatus,
      providedMinutes: attendanceVisit.providedMinutes,
      standardMinutes: attendanceUser.standardMinutes,
      isEarlyLeave: attendanceVisit.isEarlyLeave,
    };
  }

  return buildDailyUserSnapshot(input);
}

/**
 * モジュール間の不整合を検出
 */
export function detectCrossModuleIssues(snapshot: DailyUserSnapshot): CrossModuleIssue[] {
  const issues: CrossModuleIssue[] = [];

  // ========================================
  // Attendance x Activity 不整合チェック
  // ========================================

  // 1. 欠席なのに活動完了
  if (snapshot.attendanceStatus === '当日欠席' && snapshot.activityStatus === '完了') {
    issues.push({
      id: 'absence-activity-completed',
      type: 'attendance_activity_mismatch',
      severity: 'error',
      message: '通所欠席にも関わらず支援記録（ケース記録）が完了になっています',
      involvedModules: ['attendance', 'activity'],
      suggestedAction: '支援記録（ケース記録）の記録状況を確認し、必要に応じて「未作成」に変更してください',
    });
  }

  // 2. 退所済みなのに活動未作成
  if (snapshot.attendanceStatus === '退所済' && snapshot.activityStatus === '未作成') {
    issues.push({
      id: 'completed-attendance-missing-activity',
      type: 'attendance_activity_mismatch',
      severity: 'warning',
      message: '退所済みですが支援記録（ケース記録）が未作成です',
      involvedModules: ['attendance', 'activity'],
      suggestedAction: '支援記録（ケース記録）の記録を完了してください',
    });
  }

  // 3. 乖離があるが問題行動記録なし
  if (snapshot.hasServiceDiscrepancy && !snapshot.hasProblemBehavior) {
    issues.push({
      id: 'service-discrepancy-no-behavior-record',
      type: 'attendance_activity_mismatch',
      severity: 'info',
      message: 'サービス提供時間に乖離がありますが、問題行動の記録がありません',
      involvedModules: ['attendance', 'activity'],
      suggestedAction: '早退等の理由があるかサービス提供記録を確認してください',
    });
  }

  // ========================================
  // データ不整合チェック
  // ========================================

  // 4. 通所中だが提供時間データなし
  if (snapshot.attendanceStatus === '通所中' && !snapshot.providedMinutes) {
    issues.push({
      id: 'attending-no-service-time',
      type: 'data_missing',
      severity: 'warning',
      message: '通所中ですが提供時間が記録されていません',
      involvedModules: ['attendance'],
      suggestedAction: '通所管理画面で提供時間を入力してください',
    });
  }

  // ========================================
  // Attendance x ServiceProvision 不整合チェック
  // ========================================

  // 5. 欠席なのに提供実績が「提供」
  if (
    snapshot.attendanceStatus === '当日欠席' &&
    snapshot.serviceProvision?.hasRecord === true &&
    snapshot.serviceProvision.status === '提供'
  ) {
    issues.push({
      id: 'absence-provision-provided',
      type: 'attendance_provision_mismatch',
      severity: 'error',
      message: '通所欠席にも関わらずサービス提供実績が「提供」になっています',
      involvedModules: ['attendance', 'provision'],
      suggestedAction: 'サービス提供実績のステータスを「欠席」に変更してください',
    });
  }

  // 6. 通所中/退所済なのに提供実績未入力
  if (
    (snapshot.attendanceStatus === '通所中' || snapshot.attendanceStatus === '退所済') &&
    (!snapshot.serviceProvision || snapshot.serviceProvision.hasRecord === false)
  ) {
    issues.push({
      id: 'attended-no-provision-record',
      type: 'attendance_provision_mismatch',
      severity: 'warning',
      message: `${snapshot.attendanceStatus}ですがサービス提供実績が未入力です`,
      involvedModules: ['attendance', 'provision'],
      suggestedAction: 'サービス提供実績を入力してください',
    });
  }

  return issues;
}

/**
 * 複数ユーザーの日次スナップショットコレクションを生成
 */
export function buildDailySnapshotCollection(
  date: string,
  snapshots: DailyUserSnapshot[]
): DailySnapshotCollection {
  const snapshotMap: Record<string, DailyUserSnapshot> = {};

  snapshots.forEach(snapshot => {
    snapshotMap[snapshot.userId] = snapshot;
  });

  const attendanceComplete = snapshots.filter(s =>
    s.attendanceStatus === '退所済' || s.attendanceStatus === '通所中'
  ).length;

  const activityComplete = snapshots.filter(s =>
    s.activityStatus === '完了'
  ).length;

  const crossModuleIssues = snapshots.reduce((total, snapshot) =>
    total + (snapshot.crossModuleIssues?.length || 0), 0
  );

  return {
    date,
    snapshots: snapshotMap,
    generatedAt: new Date().toISOString(),
    summary: {
      totalUsers: snapshots.length,
      attendanceComplete,
      activityComplete,
      crossModuleIssues,
    }
  };
}

/**
 * DailyUserSnapshotからDashboardAlerts用のクロスモジュールアラートを生成
 */
export function generateCrossModuleAlerts(snapshots: DailyUserSnapshot[]) {
  type AlertItem = {
    id: string;
    module: 'cross';
    severity: 'error' | 'warning' | 'info';
    title: string;
    message: string;
    href: string;
  };

  const alerts: AlertItem[] = [];

  // 各スナップショットの不整合を集約
  const allIssues = snapshots.flatMap(snapshot =>
    snapshot.crossModuleIssues?.map(issue => ({ ...issue, snapshot })) || []
  );

  // エラーレベルの不整合をアラート化
  const errorIssues = allIssues.filter(issue => issue.severity === 'error');
  if (errorIssues.length > 0) {
    const topUsers = errorIssues.slice(0, 3).map(issue => issue.snapshot.userName);
    alerts.push({
      id: 'cross-module-error-issues',
      module: 'cross',
      severity: 'error',
      title: `モジュール間データ不整合 ${errorIssues.length}件`,
      message: `データ整合性エラー: ${topUsers.join('、')}（制度上の問題が発生している可能性があります）`,
      href: '/daily/activity', // 支援記録（ケース記録）から確認開始
    });
  }

  // 警告レベルの不整合をアラート化
  const warningIssues = allIssues.filter(issue => issue.severity === 'warning');
  if (warningIssues.length > 0) {
    const topUsers = warningIssues.slice(0, 3).map(issue => issue.snapshot.userName);
    alerts.push({
      id: 'cross-module-warning-issues',
      module: 'cross',
      severity: 'warning',
      title: `記録未完了 ${warningIssues.length}件`,
      message: `記録作業の完了推奨: ${topUsers.join('、')}`,
      href: '/daily/activity',
    });
  }

  return alerts;
}

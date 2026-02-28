import type { PersonDaily } from '../../domain/daily/types';
import type { AttendanceUser, AttendanceVisit } from '../dashboard/attendanceSummary';
import { buildDailyUserSnapshotFromExistingData } from './dailyUserSnapshot';
import { DailyUserSnapshot } from './types';

/**
 * テストとデモ用のモックDailyUserSnapshot生成
 */
export function createMockDailyUserSnapshot(
  userId: string,
  userName: string,
  date: string,
  scenario: 'normal' | 'absence-activity-mismatch' | 'service-discrepancy' | 'complete' | 'incomplete'
): DailyUserSnapshot {
  const baseSnapshot: Partial<DailyUserSnapshot> = {
    userId,
    userName,
    date,
    lastUpdated: new Date().toISOString(),
    crossModuleIssues: [],
  };

  switch (scenario) {
    case 'normal':
      return {
        ...baseSnapshot,
        attendanceStatus: '通所中',
        activityStatus: '作成中',
        ircStatus: '実行中',
        providedMinutes: 240,
        standardMinutes: 240,
        isEarlyLeave: false,
        hasServiceDiscrepancy: false,
        hasProblemBehavior: false,
        hasSeizureRecord: false,
        hasIndividualSupport: true,
        hasRehabilitation: false,
        mealAmount: '完食',
        serviceProvision: { hasRecord: true, status: '提供', startHHMM: 930, endHHMM: 1600, additions: { transport: false, meal: true, bath: false, extended: false, absentSupport: false } },
      } as DailyUserSnapshot;

    case 'absence-activity-mismatch':
      return {
        ...baseSnapshot,
        attendanceStatus: '当日欠席',
        activityStatus: '完了', // 不整合：欠席なのに活動完了
        ircStatus: '未定',
        providedMinutes: 0,
        standardMinutes: 240,
        isEarlyLeave: false,
        hasServiceDiscrepancy: false, // 乖離フラグをfalseに修正
        hasProblemBehavior: false,
        hasSeizureRecord: false,
        hasIndividualSupport: false,
        hasRehabilitation: false,
        crossModuleIssues: [
          {
            id: 'absence-activity-completed',
            type: 'attendance_activity_mismatch',
            severity: 'error',
            message: '通所欠席にも関わらず支援記録（ケース記録）が完了になっています',
            involvedModules: ['attendance', 'activity'],
            suggestedAction: '支援記録（ケース記録）の記録状況を確認し、必要に応じて「未作成」に変更してください',
          },
        ],
      } as DailyUserSnapshot;

    case 'service-discrepancy':
      return {
        ...baseSnapshot,
        attendanceStatus: '退所済',
        activityStatus: '完了',
        ircStatus: '完了',
        providedMinutes: 120, // 乖離：標準240分に対して120分
        standardMinutes: 240,
        isEarlyLeave: true,
        hasServiceDiscrepancy: true,
        hasProblemBehavior: true, // 問題行動ありで早退説明つく
        hasSeizureRecord: false,
        hasIndividualSupport: true,
        hasRehabilitation: true,
        mealAmount: '半分',
        serviceProvision: { hasRecord: true, status: '提供', startHHMM: 930, endHHMM: 1600, additions: { transport: false, meal: true, bath: false, extended: false, absentSupport: false } },
      } as DailyUserSnapshot;

    case 'complete':
      return {
        ...baseSnapshot,
        attendanceStatus: '退所済',
        activityStatus: '完了',
        ircStatus: '完了',
        providedMinutes: 240,
        standardMinutes: 240,
        isEarlyLeave: false,
        hasServiceDiscrepancy: false,
        hasProblemBehavior: false,
        hasSeizureRecord: false,
        hasIndividualSupport: true,
        hasRehabilitation: false,
        mealAmount: '完食',
        serviceProvision: { hasRecord: true, status: '提供', startHHMM: 930, endHHMM: 1600, additions: { transport: false, meal: true, bath: false, extended: false, absentSupport: false } },
      } as DailyUserSnapshot;

    case 'incomplete':
      return {
        ...baseSnapshot,
        attendanceStatus: '通所中',
        activityStatus: '未作成',
        ircStatus: '未定',
        providedMinutes: undefined, // データ不足
        standardMinutes: 240,
        isEarlyLeave: false,
        hasServiceDiscrepancy: false,
        hasProblemBehavior: false,
        hasSeizureRecord: false,
        hasIndividualSupport: false,
        hasRehabilitation: false,
        crossModuleIssues: [
          {
            id: 'attending-no-service-time',
            type: 'data_missing',
            severity: 'warning',
            message: '通所中ですが提供時間が記録されていません',
            involvedModules: ['attendance'],
            suggestedAction: '通所管理画面で提供時間を入力してください',
          },
        ],
      } as DailyUserSnapshot;

    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
}

/**
 * 既存デモデータから複数ユーザーのDailyUserSnapshotを生成
 */
export function createMockDailySnapshotsFromExistingData(
  date: string,
  personDailies: PersonDaily[],
  attendanceUsers: AttendanceUser[],
  attendanceVisits: AttendanceVisit[]
): DailyUserSnapshot[] {
  const snapshots: DailyUserSnapshot[] = [];

  // 全ユーザーのベースリストを作成（attendance基準）
  const allUserIds = new Set([
    ...attendanceUsers.map(u => u.userCode),
    ...personDailies.map(p => p.personId),
  ]);

  allUserIds.forEach(userId => {
    // 対応するデータを検索
    const attendanceUser = attendanceUsers.find(u => u.userCode === userId);
    const attendanceVisit = attendanceVisits.find(v => v.userCode === userId);
    const personDaily = personDailies.find(p => p.personId === userId && p.date === date);

    const userName = attendanceUser?.fullName || personDaily?.personName || `利用者${userId}`;

    const snapshot = buildDailyUserSnapshotFromExistingData(
      userId,
      userName,
      date,
      personDaily,
      attendanceUser,
      attendanceVisit
    );

    snapshots.push(snapshot);
  });

  return snapshots;
}

/**
 * テスト用の代表的なシナリオセットを生成
 */
export function createMockDailySnapshotScenarios(date: string): DailyUserSnapshot[] {
  return [
    createMockDailyUserSnapshot('user001', '田中太郎', date, 'complete'),
    createMockDailyUserSnapshot('user002', '鈴木花子', date, 'normal'),
    createMockDailyUserSnapshot('user003', '佐藤次郎', date, 'absence-activity-mismatch'),
    createMockDailyUserSnapshot('user004', '高橋美咲', date, 'service-discrepancy'),
    createMockDailyUserSnapshot('user005', '伊藤健一', date, 'incomplete'),
  ];
}

/**
 * Cross-Module Integration用のアラート検証シナリオ
 */
export function createCrossModuleAlertScenarios(date: string): {
  snapshots: DailyUserSnapshot[];
  expectedErrorCount: number;
  expectedWarningCount: number;
} {
  const snapshots = [
    // エラーケース x2
    createMockDailyUserSnapshot('error01', 'エラー太郎', date, 'absence-activity-mismatch'),
    createMockDailyUserSnapshot('error02', 'エラー花子', date, 'absence-activity-mismatch'),

    // 警告ケース x3
    createMockDailyUserSnapshot('warn01', '警告次郎', date, 'incomplete'),
    createMockDailyUserSnapshot('warn02', '警告美咲', date, 'incomplete'),
    createMockDailyUserSnapshot('warn03', '警告健一', date, 'incomplete'),

    // 正常ケース x2
    createMockDailyUserSnapshot('normal01', '正常太郎', date, 'complete'),
    createMockDailyUserSnapshot('normal02', '正常花子', date, 'normal'),
  ];

  return {
    snapshots,
    expectedErrorCount: 2, // absence-activity-mismatchのエラー
    expectedWarningCount: 3, // incompleteの警告
  };
}

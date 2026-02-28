import { describe, expect, it } from 'vitest';
import { buildDailySnapshotCollection, buildDailyUserSnapshot, detectCrossModuleIssues, generateCrossModuleAlerts } from '../dailyUserSnapshot';
import { createCrossModuleAlertScenarios, createMockDailyUserSnapshot } from '../mockData';
import type { DailyUserSnapshotInput } from '../types';

describe('Cross-Module Integration: DailyUserSnapshot', () => {
  describe('buildDailyUserSnapshot', () => {
    it('通常ケース：全データが正常で不整合なし', () => {
      const input: DailyUserSnapshotInput = {
        userId: 'user001',
        userName: '田中太郎',
        date: '2024-01-15',
        attendanceData: {
          status: '通所中',
          providedMinutes: 240,
          standardMinutes: 240,
          isEarlyLeave: false,
        },
        activityData: {
          status: '作成中',
          hasProblemBehavior: false,
          hasSeizureRecord: false,
          mealAmount: '完食',
        },
        ircData: {
          status: '実行中',
          hasIndividualSupport: true,
          hasRehabilitation: false,
        },
        serviceProvisionData: {
          hasRecord: true,
          status: '提供',
          startHHMM: 930,
          endHHMM: 1600,
          additions: { transport: false, meal: true, bath: false, extended: false, absentSupport: false },
        },
      };

      const snapshot = buildDailyUserSnapshot(input);

      expect(snapshot.userId).toBe('user001');
      expect(snapshot.userName).toBe('田中太郎');
      expect(snapshot.date).toBe('2024-01-15');
      expect(snapshot.attendanceStatus).toBe('通所中');
      expect(snapshot.activityStatus).toBe('作成中');
      expect(snapshot.ircStatus).toBe('実行中');
      expect(snapshot.hasServiceDiscrepancy).toBe(false);
      expect(snapshot.crossModuleIssues).toHaveLength(0);
    });

    it('乖離チェック：提供時間が基準の80%未満', () => {
      const input: DailyUserSnapshotInput = {
        userId: 'user002',
        userName: '鈴木花子',
        date: '2024-01-15',
        attendanceData: {
          status: '退所済',
          providedMinutes: 150, // 240分の62.5%（80%未満）
          standardMinutes: 240,
          isEarlyLeave: true,
        },
      };

      const snapshot = buildDailyUserSnapshot(input);

      expect(snapshot.hasServiceDiscrepancy).toBe(true);
      expect(snapshot.providedMinutes).toBe(150);
      expect(snapshot.standardMinutes).toBe(240);
    });
  });

  describe('detectCrossModuleIssues', () => {
    it('エラーケース：当日欠席なのに活動完了', () => {
      const snapshot = createMockDailyUserSnapshot('user001', '田中太郎', '2024-01-15', 'absence-activity-mismatch');

      const issues = detectCrossModuleIssues(snapshot);

      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('absence-activity-completed');
      expect(issues[0].severity).toBe('error');
      expect(issues[0].type).toBe('attendance_activity_mismatch');
      expect(issues[0].involvedModules).toEqual(['attendance', 'activity']);
    });

    it('警告ケース：通所中だが提供時間未記録', () => {
      const snapshot = createMockDailyUserSnapshot('user002', '鈴木花子', '2024-01-15', 'incomplete');

      const issues = detectCrossModuleIssues(snapshot);

      expect(issues.length).toBeGreaterThan(0);
      const timeIssue = issues.find(issue => issue.id === 'attending-no-service-time');
      expect(timeIssue).toBeDefined();
      expect(timeIssue?.severity).toBe('warning');
      expect(timeIssue?.type).toBe('data_missing');
    });

    it('情報ケース：乖離ありだが問題行動記録なし', () => {
      const snapshot = buildDailyUserSnapshot({
        userId: 'user003',
        userName: '佐藤次郎',
        date: '2024-01-15',
        attendanceData: {
          status: '退所済',
          providedMinutes: 150, // 乖離あり
          standardMinutes: 240,
          isEarlyLeave: true,
        },
        activityData: {
          status: '完了',
          hasProblemBehavior: false, // 問題行動なし
          hasSeizureRecord: false,
        },
      });

      const issues = detectCrossModuleIssues(snapshot);

      const discrepancyIssue = issues.find(issue => issue.id === 'service-discrepancy-no-behavior-record');
      expect(discrepancyIssue).toBeDefined();
      expect(discrepancyIssue?.severity).toBe('info');
    });

    it('正常ケース：データ完了済みで不整合なし', () => {
      const snapshot = createMockDailyUserSnapshot('user004', '高橋美咲', '2024-01-15', 'complete');

      const issues = detectCrossModuleIssues(snapshot);

      expect(issues).toHaveLength(0);
    });
  });

  describe('buildDailySnapshotCollection', () => {
    it('複数ユーザーのスナップショットコレクション生成', () => {
      const snapshots = [
        createMockDailyUserSnapshot('user001', '田中太郎', '2024-01-15', 'complete'),
        createMockDailyUserSnapshot('user002', '鈴木花子', '2024-01-15', 'normal'),
        createMockDailyUserSnapshot('user003', '佐藤次郎', '2024-01-15', 'incomplete'),
      ];

      const collection = buildDailySnapshotCollection('2024-01-15', snapshots);

      expect(collection.date).toBe('2024-01-15');
      expect(collection.summary.totalUsers).toBe(3);
      expect(collection.summary.attendanceComplete).toBe(3); // complete(退所済) + normal(通所中) + incomplete(通所中)
      expect(collection.summary.activityComplete).toBe(1); // completeのみ
      expect(collection.snapshots['user001']).toBeDefined();
      expect(collection.snapshots['user002']).toBeDefined();
      expect(collection.snapshots['user003']).toBeDefined();
    });

    it('不整合issues数の集計', () => {
      const snapshots = [
        createMockDailyUserSnapshot('user001', '田中太郎', '2024-01-15', 'absence-activity-mismatch'),
        createMockDailyUserSnapshot('user002', '鈴木花子', '2024-01-15', 'incomplete'),
        createMockDailyUserSnapshot('user003', '佐藤次郎', '2024-01-15', 'complete'),
      ];

      const collection = buildDailySnapshotCollection('2024-01-15', snapshots);

      expect(collection.summary.crossModuleIssues).toBeGreaterThan(0); // 不整合が検出される
    });
  });

  describe('generateCrossModuleAlerts', () => {
    it('エラーレベルの不整合からアラート生成', () => {
      const { snapshots, expectedErrorCount } = createCrossModuleAlertScenarios('2024-01-15');

      const alerts = generateCrossModuleAlerts(snapshots);

      const errorAlert = alerts.find(alert => alert.severity === 'error');
      expect(errorAlert).toBeDefined();
      expect(errorAlert?.title).toContain(`モジュール間データ不整合 ${expectedErrorCount}件`);
      expect(errorAlert?.module).toBe('cross');
      expect(errorAlert?.href).toBe('/daily/activity');
    });

    it('警告レベルの不整合からアラート生成', () => {
      const { snapshots, expectedWarningCount } = createCrossModuleAlertScenarios('2024-01-15');

      const alerts = generateCrossModuleAlerts(snapshots);

      const warningAlert = alerts.find(alert => alert.severity === 'warning');
      expect(warningAlert).toBeDefined();
      expect(warningAlert?.title).toContain(`記録未完了 ${expectedWarningCount}件`);
    });

    it('正常ケース：不整合なしでアラート生成されない', () => {
      const snapshots = [
        createMockDailyUserSnapshot('user001', '田中太郎', '2024-01-15', 'complete'),
        createMockDailyUserSnapshot('user002', '鈴木花子', '2024-01-15', 'normal'),
      ];

      const alerts = generateCrossModuleAlerts(snapshots);

      expect(alerts).toHaveLength(0);
    });

    it('複数ユーザーアラートでのトップ3表示', () => {
      const snapshots = [
        createMockDailyUserSnapshot('error01', 'エラー太郎', '2024-01-15', 'absence-activity-mismatch'),
        createMockDailyUserSnapshot('error02', 'エラー花子', '2024-01-15', 'absence-activity-mismatch'),
        createMockDailyUserSnapshot('error03', 'エラー次郎', '2024-01-15', 'absence-activity-mismatch'),
        createMockDailyUserSnapshot('error04', 'エラー美咲', '2024-01-15', 'absence-activity-mismatch'),
      ];

      const alerts = generateCrossModuleAlerts(snapshots);
      const errorAlert = alerts.find(alert => alert.severity === 'error');

      expect(errorAlert?.message).toContain('エラー太郎');
      expect(errorAlert?.message).toContain('エラー花子');
      expect(errorAlert?.message).toContain('エラー次郎');
      expect(errorAlert?.message).not.toContain('エラー美咲'); // 4番目は表示されない
    });
  });

  describe('Integration Test: End-to-End Scenarios', () => {
    it('E2E：欠席なのに活動完了 → エラーアラート → Safety HUD統合', () => {
      // 1. 問題のあるスナップショット作成
      const snapshot = createMockDailyUserSnapshot('user001', '田中太郎', '2024-01-15', 'absence-activity-mismatch');

      // 2. 不整合検出
      const issues = detectCrossModuleIssues(snapshot);
      expect(issues).toHaveLength(1);
      expect(issues[0].severity).toBe('error');

      // 3. アラート生成
      const alerts = generateCrossModuleAlerts([snapshot]);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('error');
      expect(alerts[0].module).toBe('cross');

      // 4. Safety HUD統合確認
      expect(alerts[0].href).toBe('/daily/activity'); // 修正対応へのナビゲーション
    });

    it('E2E：複数モジュール統合でのデータ一貫性チェック', () => {
      // 混在シナリオ
      const snapshots = [
        createMockDailyUserSnapshot('complete_user', '完了太郎', '2024-01-15', 'complete'),
        createMockDailyUserSnapshot('error_user', 'エラー花子', '2024-01-15', 'absence-activity-mismatch'),
        createMockDailyUserSnapshot('warning_user', '警告次郎', '2024-01-15', 'incomplete'),
      ];

      // コレクション生成
      const collection = buildDailySnapshotCollection('2024-01-15', snapshots);
      expect(collection.summary.totalUsers).toBe(3);
      expect(collection.summary.crossModuleIssues).toBeGreaterThan(0);

      // アラート統合
      const alerts = generateCrossModuleAlerts(snapshots);
      expect(alerts.length).toBeGreaterThan(0);

      // エラー・警告の分離確認
      const errorAlerts = alerts.filter(a => a.severity === 'error');
      const warningAlerts = alerts.filter(a => a.severity === 'warning');

      expect(errorAlerts.length + warningAlerts.length).toBeGreaterThan(0);
    });
  });
});

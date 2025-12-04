import { resolveDashboardPath } from '@/features/dashboard/dashboardRouting';
import { describe, expect, it } from 'vitest';
import { createCrossModuleAlertScenarios, createMockDailyUserSnapshot } from '../../cross-module/mockData';
import type { DailyUserSnapshot } from '../../cross-module/types';
import { buildCrossModuleDashboardAlerts, mapIssueToDashboardAlert } from '../crossModuleAlerts';

describe('C-3 Cross-Module Alert Integration', () => {
  describe('mapIssueToDashboardAlert', () => {
    it('attendance_activity_mismatch → error severity, activity href', () => {
      const snapshot = createMockDailyUserSnapshot('user001', '田中太郎', '2024-01-15', 'absence-activity-mismatch');
      const issue = snapshot.crossModuleIssues![0]; // absence-activity-completed

      const alert = mapIssueToDashboardAlert(snapshot, issue);

      expect(alert.id).toBe('cm-2024-01-15-user001-absence-activity-completed');
      expect(alert.module).toBe('cross');
      expect(alert.severity).toBe('error');
      expect(alert.title).toBe('当日欠席なのに活動完了');
      expect(alert.message).toContain('田中太郎（2024-01-15）');
      expect(alert.href).toBe('/daily/activity?userId=user001&date=2024-01-15');
    });

    it('data_missing → warning severity, attendance href', () => {
      const snapshot: DailyUserSnapshot = {
        userId: 'user002',
        userName: '鈴木花子',
        date: '2024-01-15',
        lastUpdated: new Date().toISOString(),
        attendanceStatus: '通所中',
        activityStatus: '未作成',
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
      };

      const alert = mapIssueToDashboardAlert(snapshot, snapshot.crossModuleIssues![0]);

      expect(alert.severity).toBe('warning');
      expect(alert.title).toBe('通所中だが提供時間未記録');
      expect(alert.href).toBe('/daily/attendance?userId=user002&date=2024-01-15');
    });

    it('unknown issue → fallback to dashboard', () => {
      const snapshot: DailyUserSnapshot = {
        userId: 'user003',
        userName: '佐藤次郎',
        date: '2024-01-15',
        lastUpdated: new Date().toISOString(),
        crossModuleIssues: [
          {
            id: 'unknown-issue-id',
            type: 'data_missing',
            severity: 'info',
            message: '未知の不整合パターン',
            involvedModules: ['attendance', 'activity'],
            suggestedAction: 'データを確認してください',
          },
        ],
      };

      const alert = mapIssueToDashboardAlert(snapshot, snapshot.crossModuleIssues![0]);

      expect(alert.title).toBe('未知の不整合パターン'); // 実装に合わせてissue.messageが使われる
      expect(alert.href).toBe(resolveDashboardPath());
    });
  });

  describe('buildCrossModuleDashboardAlerts', () => {
    it('複数スナップショットから重要度順のアラート生成', () => {
      const snapshots = [
        createMockDailyUserSnapshot('user001', '田中太郎', '2024-01-15', 'complete'),      // issues: 0
        createMockDailyUserSnapshot('user002', '鈴木花子', '2024-01-15', 'absence-activity-mismatch'), // issues: 1 error
        createMockDailyUserSnapshot('user003', '佐藤次郎', '2024-01-15', 'incomplete'),     // issues: 1 warning
      ];

      const alerts = buildCrossModuleDashboardAlerts(snapshots);

      expect(alerts.length).toBe(2); // complete以外の2件

      // 重要度順（error → warning）でソートされていること
      expect(alerts[0].severity).toBe('error');
      expect(alerts[0].message).toContain('鈴木花子');

      expect(alerts[1].severity).toBe('warning');
      expect(alerts[1].message).toContain('佐藤次郎');
    });

    it('同一IDのアラートはより重要度の高いもので上書き', () => {
      // 同じユーザー・日付・IssueIDを持つスナップショット
      const snapshot1: DailyUserSnapshot = {
        userId: 'user001',
        userName: '田中太郎',
        date: '2024-01-15',
        lastUpdated: new Date().toISOString(),
        crossModuleIssues: [
          {
            id: 'test-issue',
            type: 'data_missing',
            severity: 'info',
            message: '情報レベル',
            involvedModules: ['attendance'],
            suggestedAction: 'テスト用',
          },
        ],
      };

      const snapshot2: DailyUserSnapshot = {
        userId: 'user001',
        userName: '田中太郎',
        date: '2024-01-15',
        lastUpdated: new Date().toISOString(),
        crossModuleIssues: [
          {
            id: 'test-issue', // 同じID
            type: 'attendance_activity_mismatch',
            severity: 'error', // より高い重要度
            message: 'エラーレベル',
            involvedModules: ['attendance', 'activity'],
            suggestedAction: 'テスト用',
          },
        ],
      };

      const alerts = buildCrossModuleDashboardAlerts([snapshot1, snapshot2]);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe('error'); // より重要な方が残る
      expect(alerts[0].message).toContain('エラーレベル');
    });

    it('アラートシナリオの統合テスト', () => {
      const { snapshots, expectedErrorCount, expectedWarningCount } = createCrossModuleAlertScenarios('2024-01-15');

      const alerts = buildCrossModuleDashboardAlerts(snapshots);

      const errorAlerts = alerts.filter(a => a.severity === 'error');
      const warningAlerts = alerts.filter(a => a.severity === 'warning');

      expect(errorAlerts.length).toBe(expectedErrorCount);
      expect(warningAlerts.length).toBe(expectedWarningCount);

      // エラーアラートが最初に来ること
      if (errorAlerts.length > 0 && warningAlerts.length > 0) {
        const firstErrorIndex = alerts.findIndex(a => a.severity === 'error');
        const firstWarningIndex = alerts.findIndex(a => a.severity === 'warning');
        expect(firstErrorIndex).toBeLessThan(firstWarningIndex);
      }
    });
  });

  describe('Integration Test: Safety HUD連携', () => {
    it('E2E: DailyUserSnapshot → CrossModuleAlert → DashboardSummary → Safety HUD', () => {
      // 1. 問題のあるスナップショット作成
      const snapshots = [
        createMockDailyUserSnapshot('critical_user', '緊急太郎', '2024-01-15', 'absence-activity-mismatch'),
      ];

      // 2. CrossModuleアラート生成
      const crossModuleAlerts = buildCrossModuleDashboardAlerts(snapshots);
      expect(crossModuleAlerts).toHaveLength(1);
      expect(crossModuleAlerts[0].severity).toBe('error');
      expect(crossModuleAlerts[0].module).toBe('cross');

      // 3. DashboardAlert形式確認（Safety HUD互換性）
      const alert = crossModuleAlerts[0];
      expect(alert).toHaveProperty('id');
      expect(alert).toHaveProperty('module');
      expect(alert).toHaveProperty('severity');
      expect(alert).toHaveProperty('title');
      expect(alert).toHaveProperty('message');
      expect(alert).toHaveProperty('href');

      // 4. C-2ナビゲーション統合確認
      expect(alert.href).toMatch(/\/daily\/(activity|attendance)\?userId=.*&date=.*/);
      expect(alert.href).toContain('userId=critical_user');
      expect(alert.href).toContain('date=2024-01-15');
    });

    it('Cross-Module Alert特徴確認', () => {
      const snapshot = createMockDailyUserSnapshot('test_user', 'テストユーザー', '2024-01-15', 'absence-activity-mismatch');
      const alerts = buildCrossModuleDashboardAlerts([snapshot]);

      expect(alerts[0].module).toBe('cross');
      expect(alerts[0].id).toMatch(/^cm-/); // Cross-Module prefix
      expect(alerts[0].message).toContain('テストユーザー'); // ユーザー名含む
      expect(alerts[0].message).toContain('2024-01-15'); // 日付含む
    });
  });
});
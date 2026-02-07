import { describe, expect, it } from 'vitest';
import { PersonDaily } from '../../../domain/daily/types';
import {
    convertDashboardAlertsToSafetyHUD
} from '../../../lib/safetyHUDLogic';
import { AttendanceUser, AttendanceVisit } from '../attendanceSummary';
import {
    buildDashboardSummary,
    DashboardSummaryParams,
    getAlertCounts,
    getTopAlerts
} from '../dashboardSummary';
import { DashboardAlert } from '../dashboardSummary.types';
import { ResourceWarning, UnifiedResourceEvent } from '../ircSummary';

// Test constants and helper functions
const FIXED_DATE = '2025-01-01';

function createMockPersonDaily(status: '未作成' | '作成中' | '完了' = '未作成', id = 1): PersonDaily {
  return {
    id,
    personId: 'P001',
    personName: 'Mock Person',
    date: FIXED_DATE,
    status,
    reporter: { name: 'Reporter' },
    draft: { isDraft: false },
    kind: 'A',
    data: {
      amActivities: [],
      pmActivities: []
    },
  };
}

function createMockAttendanceUser(userCode = 'USER-001'): AttendanceUser {
  return {
    userCode,
    fullName: 'Mock User',
    standardMinutes: 300,
  };
}

function createMockAttendanceVisit(userCode: string, providedMinutes = 200): AttendanceVisit {
  return {
    userCode,
    status: '退所済',
    providedMinutes,
    isEarlyLeave: providedMinutes < 240,
  };
}

function createMockResourceEvent(status = 'pending', id = 'event-1'): UnifiedResourceEvent {
  return {
    id,
    title: 'Mock Event',
    extendedProps: { status },
  };
}

function createMockResourceWarning(totalHours: number): ResourceWarning {
  return {
    totalHours,
    isOver: totalHours > 8,
  };
}

function makeAlert(
  severity: DashboardAlert['severity'],
  id: string,
  module: DashboardAlert['module'] = 'cross',
  overrides: Partial<DashboardAlert> = {},
): DashboardAlert {
  return {
    severity,
    id,
    module,
    title: id,
    message: 'Test',
    href: '/',
    ...overrides,
  };
}

describe('buildDashboardSummary', () => {
  describe('基本的な統合機能', () => {
    it('全モジュールなしの場合は空のサマリーを生成する', () => {
      const params: DashboardSummaryParams = {};
      const result = buildDashboardSummary(params);

      expect(result.modules).toEqual([]);
      expect(result.alerts).toEqual([]);
      expect(result).toEqual(
        expect.objectContaining({
          modules: expect.any(Array),
          alerts: expect.any(Array),
          generatedAt: expect.any(String),
        })
      );
      expect(result.generatedAt).toBeDefined();
      expect(new Date(result.generatedAt)).toBeInstanceOf(Date);
    });

    it('単一モジュール（支援記録（ケース記録））のサマリーを生成する', () => {
      const params: DashboardSummaryParams = {
        activity: {
          records: [
            createMockPersonDaily('未作成', 1),
            createMockPersonDaily('完了', 2),
          ],
          expectedCount: 2,
        },
      };

      const result = buildDashboardSummary(params);

      expect(result.modules).toHaveLength(1);
      expect(result.modules[0].name).toBe('activity');
      expect(result.alerts).toEqual(expect.any(Array)); // アラート配列が存在することを確認
    });

    it('全モジュールのサマリーを統合生成する', () => {
      const user1 = createMockAttendanceUser('USER-001');
      const params: DashboardSummaryParams = {
        attendance: {
          users: [user1],
          visits: {
            'USER-001': createMockAttendanceVisit('USER-001', 200), // 乖離あり
          },
        },
        activity: {
          records: [
            createMockPersonDaily('未作成', 1),
            createMockPersonDaily('未作成', 2),
          ],
          expectedCount: 2,
        },
        irc: {
          events: [createMockResourceEvent('pending', 'event-1')],
          resourceWarnings: {
            'resource-1': createMockResourceWarning(9.5),
          },
        },
      };

      const result = buildDashboardSummary(params);

      expect(result.modules).toHaveLength(3);
      const moduleNames = result.modules.map(m => m.name);
      expect(moduleNames).toEqual(expect.arrayContaining(['attendance', 'activity', 'irc']));
      expect(result.alerts.length).toBeGreaterThan(0);
    });
  });

  describe('アラート優先度ソート機能', () => {
    it('error → warning → info の順序でアラートをソートする', () => {
      const users = Array.from({ length: 5 }, (_, i) =>
        createMockAttendanceUser(`USER-${i.toString().padStart(3, '0')}`)
      );
      const visits: Record<string, AttendanceVisit> = {};
      users.forEach(u => {
        visits[u.userCode] = createMockAttendanceVisit(u.userCode, 200);
      });

      const params: DashboardSummaryParams = {
        attendance: {
          users,
          visits, // 乖離5件でerror
        },
        activity: {
          records: [
            createMockPersonDaily('未作成', 1),
          ],
          expectedCount: 1,
        },
        irc: {
          events: [
            createMockResourceEvent('completed', 'event-1'),
            createMockResourceEvent('pending', 'event-2'),
            createMockResourceEvent('pending', 'event-3'),
          ],
          resourceWarnings: {},
        },
      };

      const result = buildDashboardSummary(params);

      // error（乖離5件）が最初に来ることを確認
      expect(result.alerts[0].severity).toBe('error');
      expect(result.alerts[0].module).toBe('attendance');

      // その後にwarning（活動未作成）が来ることを確認
      const warningAlerts = result.alerts.filter(a => a.severity === 'warning');
      expect(warningAlerts.length).toBeGreaterThan(0);
    });
  });

  describe('SafetyHUD統合テスト', () => {
    it('DashboardAlert[]からSafetyHUDAlert[]への変換が正常動作する', () => {
      const users = Array.from({ length: 5 }, (_, i) =>
        createMockAttendanceUser(`USER-${i.toString().padStart(3, '0')}`)
      );
      const visits: Record<string, AttendanceVisit> = {};
      users.forEach(u => {
        visits[u.userCode] = createMockAttendanceVisit(u.userCode, 200);
      });

      const params: DashboardSummaryParams = {
        attendance: {
          users,
          visits,
        },
        activity: {
          records: [
            createMockPersonDaily('未作成', 1),
          ],
          expectedCount: 1,
        },
      };

      const dashboardSummary = buildDashboardSummary(params);
      const safetyHUDAlerts = convertDashboardAlertsToSafetyHUD(dashboardSummary.alerts);

      expect(safetyHUDAlerts.length).toBeGreaterThanOrEqual(1); // 最低1件のアラート

      // error alertの確認
      const errorAlert = safetyHUDAlerts.find(a => a.severity === 'error');
      expect(errorAlert).toBeDefined();
      expect(errorAlert?.href).toBe('/daily/attendance');

      // warning alertの確認 (存在する場合)
      const warningAlert = safetyHUDAlerts.find(a => a.severity === 'warning');
      if (warningAlert) {
        expect(warningAlert?.href).toBe('/daily/activity');
      }
    });

    it('アラート上位3件制限が正常動作する', () => {
      const users = Array.from({ length: 5 }, (_, i) =>
        createMockAttendanceUser(`USER-${i.toString().padStart(3, '0')}`)
      );
      const visits: Record<string, AttendanceVisit> = {};
      users.forEach(u => {
        visits[u.userCode] = createMockAttendanceVisit(u.userCode, 200);
      });

      const params: DashboardSummaryParams = {
        attendance: {
          users,
          visits,
        },
        activity: {
          records: [
            createMockPersonDaily('未作成', 1),
            createMockPersonDaily('未作成', 2),
          ],
          expectedCount: 2,
        },
        irc: {
          events: Array.from({ length: 5 }, (_, i) => createMockResourceEvent('pending', `event-${i+1}`)),
          resourceWarnings: {
            'resource-1': createMockResourceWarning(9.0),
            'resource-2': createMockResourceWarning(9.5),
            'resource-3': createMockResourceWarning(10.0),
          },
        },
      };

      const dashboardSummary = buildDashboardSummary(params);
      const safetyHUDAlerts = convertDashboardAlertsToSafetyHUD(dashboardSummary.alerts);

      // 最大3件に制限されることを確認
      expect(safetyHUDAlerts).toHaveLength(3);

      // error が含まれることを確認
      const errorAlerts = safetyHUDAlerts.filter(a => a.severity === 'error');
      expect(errorAlerts.length).toBeGreaterThanOrEqual(1);

      // warning も含まれることを確認
      const warningAlerts = safetyHUDAlerts.filter(a => a.severity === 'warning');
      expect(warningAlerts.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('getAlertCounts', () => {
  it('アラートをカテゴリ別に正しくカウントする', () => {
    const alerts: DashboardAlert[] = [
      makeAlert('error', 'test-1', 'attendance'),
      makeAlert('error', 'test-2', 'activity'),
      makeAlert('warning', 'test-3', 'irc'),
      makeAlert('info', 'test-4', 'cross'),
    ];

    const counts = getAlertCounts(alerts);

    expect(counts).toEqual({
      error: 2,
      warning: 1,
      info: 1,
      total: 4,
    });
  });

  it('空のアラート配列を正しく処理する', () => {
    const counts = getAlertCounts([]);

    expect(counts).toEqual({
      error: 0,
      warning: 0,
      info: 0,
      total: 0,
    });
  });
});

describe('getTopAlerts', () => {
  it('上位N件のアラートを取得する', () => {
    const alerts: DashboardAlert[] = [
      makeAlert('error', 'test-1', 'attendance'),
      makeAlert('warning', 'test-2', 'activity'),
      makeAlert('info', 'test-3', 'irc'),
      makeAlert('info', 'test-4', 'cross'),
    ];

    const topAlerts = getTopAlerts(alerts, 2);

    expect(topAlerts).toHaveLength(2);
    expect(topAlerts[0].id).toBe('test-1');
    expect(topAlerts[1].id).toBe('test-2');
  });

  it('デフォルトで3件取得する', () => {
    const alerts: DashboardAlert[] = Array.from({ length: 5 }, (_, i) =>
      makeAlert('info', `test-${i}`, 'cross')
    );

    const topAlerts = getTopAlerts(alerts);

    expect(topAlerts).toHaveLength(3);
  });

  it('配列サイズがlimit未満の場合は全件返す', () => {
    const alerts: DashboardAlert[] = [
      makeAlert('error', 'test-1', 'attendance'),
    ];

    const topAlerts = getTopAlerts(alerts, 3);

    expect(topAlerts).toHaveLength(1);
    expect(topAlerts[0].id).toBe('test-1');
  });
});
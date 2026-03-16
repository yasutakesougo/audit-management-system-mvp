import { describe, it, expect } from 'vitest';
import {
  evaluateAlertRules,
  countConsecutiveDays,
  countInPeriod,
  findStaleHandoffs,
  DEFAULT_ALERT_RULES,
} from '../alertRules';
import type { HandoffRecord } from '../../handoffTypes';

// ── テストヘルパー ──

let idCounter = 0;
function resetIds() { idCounter = 0; }

function makeRecord(
  overrides: Partial<HandoffRecord> & { createdAt: string },
): HandoffRecord {
  idCounter++;
  return {
    id: idCounter,
    title: 'テスト',
    message: 'テストメッセージ',
    userCode: 'U001',
    userDisplayName: 'テスト太郎',
    category: '体調',
    severity: '通常',
    status: '未対応',
    timeBand: '午前',
    createdByName: '職員A',
    isDraft: false,
    ...overrides,
  };
}

const BASE = new Date('2026-03-16T12:00:00Z');

// ────────────────────────────────────────────────────────────
// countConsecutiveDays
// ────────────────────────────────────────────────────────────

describe('countConsecutiveDays', () => {
  it('counts consecutive days from baseDate', () => {
    resetIds();
    const records = [
      makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
      makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
      makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
    ];

    const result = countConsecutiveDays(records, '体調', BASE);

    expect(result.consecutiveDays).toBe(3);
    expect(result.handoffIds).toHaveLength(3);
  });

  it('breaks on gap', () => {
    resetIds();
    const records = [
      makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
      // 15日なし（ギャップ）
      makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
    ];

    const result = countConsecutiveDays(records, '体調', BASE);

    expect(result.consecutiveDays).toBe(1); // 16日のみ
  });

  it('filters by category', () => {
    resetIds();
    const records = [
      makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '行動面' }),
      makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '行動面' }),
    ];

    const result = countConsecutiveDays(records, '体調', BASE);

    expect(result.consecutiveDays).toBe(0);
  });

  it('returns 0 for empty records', () => {
    const result = countConsecutiveDays([], '体調', BASE);
    expect(result.consecutiveDays).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
// countInPeriod
// ────────────────────────────────────────────────────────────

describe('countInPeriod', () => {
  it('counts records in period', () => {
    resetIds();
    const records = [
      makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '行動面' }),
      makeRecord({ createdAt: '2026-03-13T10:00:00Z', category: '行動面' }),
      makeRecord({ createdAt: '2026-03-11T10:00:00Z', category: '行動面' }),
      makeRecord({ createdAt: '2026-03-01T10:00:00Z', category: '行動面' }), // 期間外
    ];

    const result = countInPeriod(records, '行動面', 7, BASE);

    expect(result.count).toBe(3);
    expect(result.handoffIds).toHaveLength(3);
  });

  it('filters by category', () => {
    resetIds();
    const records = [
      makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
      makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '行動面' }),
    ];

    const result = countInPeriod(records, '行動面', 7, BASE);

    expect(result.count).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────
// findStaleHandoffs
// ────────────────────────────────────────────────────────────

describe('findStaleHandoffs', () => {
  it('detects stale handoffs', () => {
    resetIds();
    const records = [
      makeRecord({
        createdAt: '2026-03-10T10:00:00Z',
        category: '家族連絡',
        status: '未対応',
      }),
    ];

    const result = findStaleHandoffs(records, '家族連絡', 3, BASE);

    expect(result.hasStale).toBe(true);
    expect(result.handoffIds).toHaveLength(1);
  });

  it('ignores completed handoffs', () => {
    resetIds();
    const records = [
      makeRecord({
        createdAt: '2026-03-10T10:00:00Z',
        category: '家族連絡',
        status: '対応済',
      }),
    ];

    const result = findStaleHandoffs(records, '家族連絡', 3, BASE);

    expect(result.hasStale).toBe(false);
  });

  it('ignores recent handoffs', () => {
    resetIds();
    const records = [
      makeRecord({
        createdAt: '2026-03-15T10:00:00Z',
        category: '家族連絡',
        status: '未対応',
      }),
    ];

    const result = findStaleHandoffs(records, '家族連絡', 3, BASE);

    expect(result.hasStale).toBe(false); // まだ3日経っていない
  });
});

// ────────────────────────────────────────────────────────────
// evaluateAlertRules
// ────────────────────────────────────────────────────────────

describe('evaluateAlertRules', () => {
  describe('基本動作', () => {
    it('returns empty result for empty records', () => {
      const result = evaluateAlertRules([], { baseDate: BASE });

      expect(result.alerts).toEqual([]);
      expect(result.affectedUserCount).toBe(0);
      expect(result.totalUsersEvaluated).toBe(0);
    });

    it('returns empty when no rules fire', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: 'その他' }),
      ];

      const result = evaluateAlertRules(records, { baseDate: BASE });

      expect(result.alerts).toEqual([]);
    });
  });

  describe('consecutive-health-3d rule', () => {
    it('fires when health reported 3+ consecutive days', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
      ];

      const result = evaluateAlertRules(records, { baseDate: BASE });
      const healthAlert = result.alerts.find(a => a.ruleId === 'consecutive-health-3d');

      expect(healthAlert).toBeDefined();
      expect(healthAlert!.userCode).toBe('U001');
      expect(healthAlert!.evidenceHandoffIds).toHaveLength(3);
    });

    it('does NOT fire with only 2 consecutive days', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
      ];

      const result = evaluateAlertRules(records, { baseDate: BASE });
      const healthAlert = result.alerts.find(a => a.ruleId === 'consecutive-health-3d');

      expect(healthAlert).toBeUndefined();
    });
  });

  describe('behavior-3-in-7d rule', () => {
    it('fires when behavior reported 3+ times in 7 days', () => {
      resetIds();
      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-14T10:00:00Z', category: '行動面' }),
        makeRecord({ createdAt: '2026-03-12T10:00:00Z', category: '行動面' }),
      ];

      const result = evaluateAlertRules(records, { baseDate: BASE });
      const behaviorAlert = result.alerts.find(a => a.ruleId === 'behavior-3-in-7d');

      expect(behaviorAlert).toBeDefined();
      expect(behaviorAlert!.suggestion).toContain('ABC分析');
    });
  });

  describe('family-stale-3d rule', () => {
    it('fires when family contact is stale 3+ days', () => {
      resetIds();
      const records = [
        makeRecord({
          createdAt: '2026-03-10T10:00:00Z',
          category: '家族連絡',
          status: '未対応',
        }),
      ];

      const result = evaluateAlertRules(records, { baseDate: BASE });
      const familyAlert = result.alerts.find(a => a.ruleId === 'family-stale-3d');

      expect(familyAlert).toBeDefined();
      expect(familyAlert!.severity).toBe('critical');
    });
  });

  describe('多利用者・複数ルール', () => {
    it('evaluates each user independently', () => {
      resetIds();
      const records = [
        // U001: 3日連続体調
        makeRecord({ userCode: 'U001', createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
        // U002: 行動面2回（発火しない）
        makeRecord({ userCode: 'U002', createdAt: '2026-03-16T10:00:00Z', category: '行動面' }),
        makeRecord({ userCode: 'U002', createdAt: '2026-03-14T10:00:00Z', category: '行動面' }),
      ];

      const result = evaluateAlertRules(records, { baseDate: BASE });

      // U001 のみアラートあり
      const u001Alerts = result.alerts.filter(a => a.userCode === 'U001');
      const u002Alerts = result.alerts.filter(a => a.userCode === 'U002');

      expect(u001Alerts.length).toBeGreaterThan(0);
      // U002 は行動面2回なので behavior-3-in-7d は未発火
      expect(u002Alerts.filter(a => a.ruleId === 'behavior-3-in-7d')).toHaveLength(0);
    });

    it('counts affected users correctly', () => {
      resetIds();
      const records = [
        // U001: 体調3日
        makeRecord({ userCode: 'U001', createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
        // U002: 家族連絡未対応
        makeRecord({ userCode: 'U002', createdAt: '2026-03-10T10:00:00Z', category: '家族連絡', status: '未対応' }),
      ];

      const result = evaluateAlertRules(records, { baseDate: BASE });

      expect(result.affectedUserCount).toBe(2);
      expect(result.totalUsersEvaluated).toBe(2);
    });
  });

  describe('ソート順', () => {
    it('sorts by severity descending, then userCode ascending', () => {
      resetIds();
      const records = [
        // U002: 家族連絡未対応 → critical
        makeRecord({ userCode: 'U002', createdAt: '2026-03-10T10:00:00Z', category: '家族連絡', status: '未対応' }),
        // U001: 体調3日 → warning
        makeRecord({ userCode: 'U001', createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
      ];

      const result = evaluateAlertRules(records, { baseDate: BASE });

      // critical が先
      expect(result.alerts[0].severity).toBe('critical');
    });
  });

  describe('bySeverity カウント', () => {
    it('counts alerts per severity level', () => {
      resetIds();
      const records = [
        // U001: 体調3日 → warning
        makeRecord({ userCode: 'U001', createdAt: '2026-03-16T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-15T10:00:00Z', category: '体調' }),
        makeRecord({ userCode: 'U001', createdAt: '2026-03-14T10:00:00Z', category: '体調' }),
        // U001: 家族連絡未対応 → critical
        makeRecord({ userCode: 'U001', createdAt: '2026-03-10T10:00:00Z', category: '家族連絡', status: '未対応' }),
      ];

      const result = evaluateAlertRules(records, { baseDate: BASE });

      expect(result.bySeverity.critical).toBeGreaterThan(0);
      expect(result.bySeverity.warning).toBeGreaterThan(0);
    });
  });

  describe('カスタムルール', () => {
    it('accepts custom rules via options', () => {
      resetIds();
      const customRule = {
        id: 'custom-test',
        label: 'テストルール',
        description: 'テスト用',
        severity: 'info' as const,
        suggestion: 'テスト提案',
        evaluate: (records: HandoffRecord[]) =>
          records.length >= 1 ? [records[0].id] : null,
      };

      const records = [
        makeRecord({ createdAt: '2026-03-16T10:00:00Z' }),
      ];

      const result = evaluateAlertRules(records, {
        rules: [customRule],
        baseDate: BASE,
      });

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].ruleId).toBe('custom-test');
    });
  });

  it('exports DEFAULT_ALERT_RULES with expected count', () => {
    expect(DEFAULT_ALERT_RULES.length).toBe(5);
    expect(DEFAULT_ALERT_RULES.map(r => r.id)).toEqual([
      'consecutive-health-3d',
      'behavior-3-in-7d',
      'family-stale-3d',
      'risk-any-7d',
      'severity-high-consecutive-2d',
    ]);
  });
});

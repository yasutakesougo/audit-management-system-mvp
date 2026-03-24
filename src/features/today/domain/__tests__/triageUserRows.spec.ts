import { describe, expect, it } from 'vitest';
import { computeTriageScore, triageUserRows, buildTriageReasons } from '../triageUserRows';
import type { UserRow } from '../../widgets/UserCompactList';

// ─── Helper ──────────────────────────────────────────────────

function row(overrides: Partial<UserRow> & { userId: string }): UserRow {
  return {
    name: overrides.userId,
    status: 'present',
    recordFilled: true,
    ...overrides,
  };
}

// ─── computeTriageScore ──────────────────────────────────────

describe('computeTriageScore', () => {
  it('scores 0 for a normal completed user', () => {
    expect(computeTriageScore(row({ userId: 'u1' }))).toBe(0);
  });

  it('adds 100 for absent user', () => {
    expect(computeTriageScore(row({ userId: 'u1', status: 'absent' }))).toBe(100);
  });

  it('adds 80 for warning alert', () => {
    expect(computeTriageScore(row({
      userId: 'u1',
      alerts: [{ type: 'high-intensity', label: '自傷 ↑', severity: 'warning' }],
    }))).toBe(80);
  });

  it('adds 30 for info alert only', () => {
    expect(computeTriageScore(row({
      userId: 'u1',
      alerts: [{ type: 'active-strategy', label: '見通しカード 実施中', severity: 'info' }],
    }))).toBe(30);
  });

  it('adds 50 for unfilled record (not absent)', () => {
    expect(computeTriageScore(row({
      userId: 'u1',
      recordFilled: false,
    }))).toBe(50);
  });

  it('does NOT add unfilled score for absent user', () => {
    expect(computeTriageScore(row({
      userId: 'u1',
      status: 'absent',
      recordFilled: false,
    }))).toBe(100); // only absent, not unfilled
  });

  it('adds 20 for userStatusType', () => {
    expect(computeTriageScore(row({
      userId: 'u1',
      userStatusType: 'late',
    }))).toBe(20);
  });

  it('combines multiple factors', () => {
    const score = computeTriageScore(row({
      userId: 'u1',
      status: 'present',
      recordFilled: false,
      alerts: [{ type: 'high-intensity', label: '自傷 ↑', severity: 'warning' }],
      userStatusType: 'late',
    }));
    // unfilled(50) + warningAlert(80) + hasStatus(20) = 150
    expect(score).toBe(150);
  });
});

// ─── triageUserRows ──────────────────────────────────────────

describe('triageUserRows', () => {
  it('sorts by score descending', () => {
    const users = [
      row({ userId: 'normal' }),                                    // score: 0
      row({ userId: 'unfilled', recordFilled: false }),             // score: 50
      row({ userId: 'absent', status: 'absent' }),                  // score: 100
      row({ userId: 'alert', alerts: [{ type: 'high-intensity', label: 'x', severity: 'warning' }] }), // score: 80
    ];

    const result = triageUserRows(users);
    expect(result.map(u => u.userId)).toEqual([
      'absent',    // 100
      'alert',     // 80
      'unfilled',  // 50
      'normal',    // 0
    ]);
  });

  it('preserves order within same score', () => {
    const users = [
      row({ userId: 'a', recordFilled: false }),  // score: 50
      row({ userId: 'b', recordFilled: false }),  // score: 50
      row({ userId: 'c', recordFilled: false }),  // score: 50
    ];

    const result = triageUserRows(users);
    expect(result.map(u => u.userId)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the original array', () => {
    const users = [
      row({ userId: 'unfilled', recordFilled: false }),
      row({ userId: 'normal' }),
    ];
    const original = [...users];
    triageUserRows(users);
    expect(users).toEqual(original);
  });

  it('handles empty array', () => {
    expect(triageUserRows([])).toEqual([]);
  });

  it('sorts complex multi-factor scenario correctly', () => {
    const users = [
      row({ userId: 'completed' }),                                   // 0
      row({ userId: 'unfilled', recordFilled: false }),               // 50
      row({ userId: 'absent-alert', status: 'absent',
        alerts: [{ type: 'high-intensity', label: 'x', severity: 'warning' }] }), // 100+80 = 180
      row({ userId: 'unfilled-alert', recordFilled: false,
        alerts: [{ type: 'high-intensity', label: 'x', severity: 'warning' }] }), // 50+80 = 130
      row({ userId: 'status-only', userStatusType: 'late' }),         // 20
    ];

    const result = triageUserRows(users);
    expect(result.map(u => u.userId)).toEqual([
      'absent-alert',     // 180
      'unfilled-alert',   // 130
      'unfilled',         // 50
      'status-only',      // 20
      'completed',        // 0
    ]);
  });
});

// ─── buildTriageReasons ──────────────────────────────────────

describe('buildTriageReasons', () => {
  it('returns empty array for normal completed user', () => {
    expect(buildTriageReasons(row({ userId: 'u1' }))).toEqual([]);
  });

  it('includes "欠席" with critical severity for absent user', () => {
    const reasons = buildTriageReasons(row({ userId: 'u1', status: 'absent' }));
    expect(reasons).toContainEqual({ label: '欠席', severity: 'critical' });
  });

  it('includes actual alert label for warning alert', () => {
    const reasons = buildTriageReasons(row({
      userId: 'u1',
      alerts: [{ type: 'high-intensity', label: '自傷 ↑', severity: 'warning' }],
    }));
    expect(reasons).toContainEqual({ label: '自傷 ↑', severity: 'warning' });
  });

  it('includes actual alert label for info alert', () => {
    const reasons = buildTriageReasons(row({
      userId: 'u1',
      alerts: [{ type: 'active-strategy', label: '見通しカード 実施中', severity: 'info' }],
    }));
    expect(reasons).toContainEqual({ label: '見通しカード 実施中', severity: 'info' });
  });

  it('includes "未記録" for unfilled non-absent user', () => {
    const reasons = buildTriageReasons(row({
      userId: 'u1',
      recordFilled: false,
    }));
    expect(reasons).toContainEqual({ label: '未記録', severity: 'warning' });
  });

  it('does NOT include "未記録" for absent user', () => {
    const reasons = buildTriageReasons(row({
      userId: 'u1',
      status: 'absent',
      recordFilled: false,
    }));
    const labels = reasons.map(r => r.label);
    expect(labels).toContain('欠席');
    expect(labels).not.toContain('未記録');
  });

  it('includes status label for userStatusType', () => {
    const reasons = buildTriageReasons(row({
      userId: 'u1',
      userStatusType: 'late',
    }));
    expect(reasons).toContainEqual({ label: '遅刻', severity: 'info' });
  });

  it('produces reasons in priority order for complex user', () => {
    const reasons = buildTriageReasons(row({
      userId: 'u1',
      status: 'absent',
      alerts: [{ type: 'high-intensity', label: '他害 ↑', severity: 'warning' }],
      userStatusType: 'earlyLeave',
    }));
    const labels = reasons.map(r => r.label);
    // 欠席 → アラート → ステータス の順
    expect(labels[0]).toBe('欠席');
    expect(labels[1]).toBe('他害 ↑');
    expect(labels[2]).toBe('早退');
  });

  it('prefers warning alert over info alert', () => {
    const reasons = buildTriageReasons(row({
      userId: 'u1',
      alerts: [
        { type: 'active-strategy', label: '戦略A', severity: 'info' },
        { type: 'high-intensity', label: '自傷 ↑', severity: 'warning' },
      ],
    }));
    // warning が選ばれるべき
    expect(reasons).toContainEqual({ label: '自傷 ↑', severity: 'warning' });
    expect(reasons.map(r => r.label)).not.toContain('戦略A');
  });
});

// ---------------------------------------------------------------------------
// proactiveSPSAlerts.spec.ts — 純関数のユニットテスト
// ---------------------------------------------------------------------------
import { describe, expect, it } from 'vitest';

import {
    DEFAULT_THRESHOLDS,
    buildAlertMessage,
    evaluateAlertLevel,
    generateProactiveAlerts,
    type IncidentSummary,
} from '../proactiveSPSAlerts';

import { countRecentIncidents } from '../useProactiveSPSAlerts';

// ---------------------------------------------------------------------------
// evaluateAlertLevel
// ---------------------------------------------------------------------------

describe('evaluateAlertLevel', () => {
  it('returns "ok" when no incidents', () => {
    expect(evaluateAlertLevel(0, 0)).toBe('ok');
  });

  it('returns "ok" when below watch threshold', () => {
    expect(evaluateAlertLevel(1, 0)).toBe('ok');
  });

  it('returns "watch" when incidents >= watchCount', () => {
    expect(evaluateAlertLevel(2, 0)).toBe('watch');
    expect(evaluateAlertLevel(3, 0)).toBe('watch');
    expect(evaluateAlertLevel(4, 0)).toBe('watch');
  });

  it('returns "urgent" when incidents >= urgentCount', () => {
    expect(evaluateAlertLevel(5, 0)).toBe('urgent');
    expect(evaluateAlertLevel(10, 0)).toBe('urgent');
  });

  it('returns "urgent" when highIntensity >= urgentHighIntensityCount', () => {
    expect(evaluateAlertLevel(3, 3)).toBe('urgent');
  });

  it('respects custom thresholds', () => {
    const custom = { ...DEFAULT_THRESHOLDS, watchCount: 10, urgentCount: 20 };
    expect(evaluateAlertLevel(5, 0, custom)).toBe('ok');
    expect(evaluateAlertLevel(10, 0, custom)).toBe('watch');
    expect(evaluateAlertLevel(20, 0, custom)).toBe('urgent');
  });
});

// ---------------------------------------------------------------------------
// buildAlertMessage
// ---------------------------------------------------------------------------

describe('buildAlertMessage', () => {
  it('returns empty string for "ok" level', () => {
    expect(buildAlertMessage('田中', 'ok', 0, 0, 30)).toBe('');
  });

  it('generates urgent message with planning sheet info', () => {
    const msg = buildAlertMessage('田中太郎', 'urgent', 6, 4, 45);
    expect(msg).toContain('田中太郎');
    expect(msg).toContain('6件');
    expect(msg).toContain('高強度4件');
    expect(msg).toContain('支援計画シート更新まで45日');
    expect(msg).toContain('🔴');
  });

  it('generates watch message with planning sheet null', () => {
    const msg = buildAlertMessage('鈴木', 'watch', 3, 1, null);
    expect(msg).toContain('鈴木');
    expect(msg).toContain('3件');
    expect(msg).toContain('支援計画シート未登録');
    expect(msg).toContain('🟠');
  });
});

// ---------------------------------------------------------------------------
// generateProactiveAlerts
// ---------------------------------------------------------------------------

describe('generateProactiveAlerts', () => {
  const summaries: IncidentSummary[] = [
    { userId: 'U001', userName: '田中', incidentCount: 6, highIntensityCount: 4, daysUntilSPSReview: 30 },
    { userId: 'U002', userName: '鈴木', incidentCount: 0, highIntensityCount: 0, daysUntilSPSReview: 60 },
    { userId: 'U003', userName: '佐藤', incidentCount: 3, highIntensityCount: 1, daysUntilSPSReview: null },
  ];

  it('filters out ok-level users', () => {
    const alerts = generateProactiveAlerts(summaries);
    expect(alerts.map((a) => a.userId)).not.toContain('U002');
  });

  it('includes urgent and watch users', () => {
    const alerts = generateProactiveAlerts(summaries);
    expect(alerts).toHaveLength(2);
    expect(alerts[0].userId).toBe('U001'); // urgent first
    expect(alerts[0].level).toBe('urgent');
    expect(alerts[1].userId).toBe('U003'); // watch second
    expect(alerts[1].level).toBe('watch');
  });

  it('sorts urgent before watch, then by incident count desc', () => {
    const mixed: IncidentSummary[] = [
      { userId: 'A', userName: 'A', incidentCount: 3, highIntensityCount: 0, daysUntilSPSReview: null },
      { userId: 'B', userName: 'B', incidentCount: 7, highIntensityCount: 0, daysUntilSPSReview: null },
      { userId: 'C', userName: 'C', incidentCount: 5, highIntensityCount: 3, daysUntilSPSReview: null },
    ];
    const alerts = generateProactiveAlerts(mixed);
    expect(alerts[0].level).toBe('urgent'); // B (7) or C (5 but highIntensity)
    // B and C are both urgent; B has more incidents
    expect(alerts[0].userId).toBe('B');
    expect(alerts[1].userId).toBe('C');
    expect(alerts[2].level).toBe('watch');
    expect(alerts[2].userId).toBe('A');
  });

  it('returns empty array when no alerts', () => {
    const noop: IncidentSummary[] = [
      { userId: 'X', userName: 'X', incidentCount: 0, highIntensityCount: 0, daysUntilSPSReview: 90 },
    ];
    expect(generateProactiveAlerts(noop)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// countRecentIncidents
// ---------------------------------------------------------------------------

describe('countRecentIncidents', () => {
  const today = new Date('2026-03-02T12:00:00Z');

  it('counts incidents within lookback window', () => {
    const records = [
      { intensity: 3, recordedAt: '2026-03-01T10:00:00Z' }, // 1日前 — in
      { intensity: 5, recordedAt: '2026-02-28T10:00:00Z' }, // 2日前 — in
      { intensity: 2, recordedAt: '2026-02-20T10:00:00Z' }, // 10日前 — out
    ];
    const result = countRecentIncidents(records, 7, 4, today);
    expect(result.incidentCount).toBe(2);
    expect(result.highIntensityCount).toBe(1); // intensity 5
  });

  it('returns zero for empty records', () => {
    const result = countRecentIncidents([], 7, 4, today);
    expect(result.incidentCount).toBe(0);
    expect(result.highIntensityCount).toBe(0);
  });

  it('considers intensity threshold correctly', () => {
    const records = [
      { intensity: 4, recordedAt: '2026-03-01T10:00:00Z' },
      { intensity: 3, recordedAt: '2026-03-01T11:00:00Z' },
    ];
    const result = countRecentIncidents(records, 7, 4, today);
    expect(result.highIntensityCount).toBe(1); // only intensity 4
  });
});

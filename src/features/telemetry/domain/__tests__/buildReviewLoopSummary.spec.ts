import { describe, it, expect } from 'vitest';
import { buildReviewLoopSummary } from '../buildReviewLoopSummary';
import type { KpiAlert } from '../computeCtaKpiDiff';
import type { AlertPersistence } from '../computeAlertPersistence';

const makeAlert = (
  id: string,
  value: number,
  severity: 'warning' | 'critical' = 'warning',
  label?: string,
): KpiAlert => ({
  id,
  severity,
  label: label ?? `テスト: ${id}`,
  message: `テスト alert ${id}`,
  value,
  threshold: 70,
});

const makePersistence = (
  alertKey: string,
  status: AlertPersistence['status'],
  overrides?: Partial<AlertPersistence>,
): AlertPersistence => ({
  alertKey,
  firstSeenAt: '2026-03-13',
  lastSeenAt: '2026-03-20',
  consecutivePeriods: status === 'new' ? 1 : 2,
  worseningStreak: status === 'worsening' ? 1 : 0,
  status,
  previousValue: status === 'new' ? null : 60,
  delta: status === 'new' ? null : -5,
  ...overrides,
});

describe('buildReviewLoopSummary', () => {
  it('件数を正しく集計する', () => {
    const alerts = [
      makeAlert('a', 50),
      makeAlert('b', 60),
      makeAlert('c', 40, 'critical'),
    ];
    const persistence = [
      makePersistence('a', 'new'),
      makePersistence('b', 'ongoing'),
      makePersistence('c', 'worsening'),
    ];

    const result = buildReviewLoopSummary({ alerts, persistence });

    expect(result.totalCurrentAlerts).toBe(3);
    expect(result.newAlerts).toBe(1);
    expect(result.ongoingAlerts).toBe(1);
    expect(result.worseningAlerts).toBe(1);
    expect(result.improvingAlerts).toBe(0);
  });

  it('critical / warning を分ける', () => {
    const alerts = [
      makeAlert('a', 50, 'critical'),
      makeAlert('b', 60, 'warning'),
      makeAlert('c', 40, 'critical'),
    ];
    const persistence = [
      makePersistence('a', 'new'),
      makePersistence('b', 'ongoing'),
      makePersistence('c', 'worsening'),
    ];

    const result = buildReviewLoopSummary({ alerts, persistence });
    expect(result.criticalAlerts).toBe(2);
    expect(result.warningAlerts).toBe(1);
  });

  it('topConcerns を優先順で返す（worsening > ongoing > new critical）', () => {
    const alerts = [
      makeAlert('hero-rate-low', 50, 'warning', 'Hero利用率低下'),
      makeAlert('queue-rate-high', 80, 'critical', 'Queue偏重'),
      makeAlert('completion-low', 40, 'critical', '完了率低下'),
    ];
    const persistence = [
      makePersistence('hero-rate-low', 'ongoing', { consecutivePeriods: 3 }),
      makePersistence('queue-rate-high', 'worsening', { worseningStreak: 2 }),
      makePersistence('completion-low', 'new'),
    ];

    const result = buildReviewLoopSummary({ alerts, persistence });

    // worsening が最優先
    expect(result.topConcerns[0]).toContain('Queue偏重');
    expect(result.topConcerns[0]).toContain('連続悪化');
    // ongoing が次
    expect(result.topConcerns[1]).toContain('Hero利用率低下');
    expect(result.topConcerns[1]).toContain('3期間継続');
    // new critical が最後
    expect(result.topConcerns[2]).toContain('完了率低下');
    expect(result.topConcerns[2]).toContain('新規 critical');
  });

  it('persistence にない alert は new として集計される', () => {
    const alerts = [makeAlert('a', 50), makeAlert('b', 60)];
    const persistence = [makePersistence('a', 'ongoing')];

    const result = buildReviewLoopSummary({ alerts, persistence });
    expect(result.newAlerts).toBe(1); // b は persistence にない → new
    expect(result.ongoingAlerts).toBe(1);
  });

  it('空の入力でも安全に動く', () => {
    const result = buildReviewLoopSummary({ alerts: [], persistence: [] });
    expect(result.totalCurrentAlerts).toBe(0);
    expect(result.newAlerts).toBe(0);
    expect(result.topConcerns).toEqual([]);
  });

  it('topConcerns は最大5件に制限される', () => {
    const alerts = Array.from({ length: 10 }, (_, i) =>
      makeAlert(`alert-${i}`, 50, 'critical', `アラート${i}`),
    );
    const persistence = alerts.map((a) =>
      makePersistence(a.id, 'worsening', { worseningStreak: 1 }),
    );

    const result = buildReviewLoopSummary({ alerts, persistence });
    expect(result.topConcerns).toHaveLength(5);
  });

  it('improving のアラートは topConcerns に入らない', () => {
    const alerts = [makeAlert('a', 65, 'warning', '改善中アラート')];
    const persistence = [makePersistence('a', 'improving')];

    const result = buildReviewLoopSummary({ alerts, persistence });
    expect(result.improvingAlerts).toBe(1);
    expect(result.topConcerns).toEqual([]);
  });
});

/**
 * computeTransportAlerts.spec.ts — Transport アラート生成のユニットテスト
 */
import { describe, it, expect } from 'vitest';
import {
  computeTransportAlerts,
  DEFAULT_TRANSPORT_THRESHOLDS,
} from '../computeTransportAlerts';
import type { TransportKpis } from '../computeTransportKpis';
import { EMPTY_TRANSPORT_KPIS } from '../computeTransportKpis';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeKpis(overrides: Partial<TransportKpis>): TransportKpis {
  return { ...EMPTY_TRANSPORT_KPIS, ...overrides };
}

function makeDate(hour: number): Date {
  return new Date(2026, 2, 25, hour, 0, 0);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('computeTransportAlerts', () => {
  // ── No Alerts ─────────────────────────────────────────────────────────

  it('returns no alerts for clean KPIs', () => {
    const alerts = computeTransportAlerts({
      kpis: EMPTY_TRANSPORT_KPIS,
      now: makeDate(10),
    });
    expect(alerts).toEqual([]);
  });

  it('returns no alerts when values are below thresholds', () => {
    const kpis = makeKpis({
      syncFailedCount: 2,  // below 3
      fallbackActive: false,
      staleCount: 0,
      arrivalCompletionRate: 80,  // above 50
    });
    const alerts = computeTransportAlerts({
      kpis,
      now: makeDate(17),
    });
    expect(alerts).toEqual([]);
  });

  // ── sync-fail-count ───────────────────────────────────────────────────

  it('generates critical alert when syncFailedCount >= 3', () => {
    const kpis = makeKpis({ syncFailedCount: 3 });
    const alerts = computeTransportAlerts({
      kpis,
      now: makeDate(10),
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('transport-sync-fail-count');
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].value).toBe(3);
    expect(alerts[0].threshold).toBe(DEFAULT_TRANSPORT_THRESHOLDS.syncFailedMax);
  });

  it('generates critical alert when syncFailedCount > 3', () => {
    const kpis = makeKpis({ syncFailedCount: 10 });
    const alerts = computeTransportAlerts({ kpis, now: makeDate(10) });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('transport-sync-fail-count');
    expect(alerts[0].value).toBe(10);
  });

  // ── fallback-active ───────────────────────────────────────────────────

  it('generates warning when fallback is active', () => {
    const kpis = makeKpis({ fallbackActive: true, fallbackCount: 2 });
    const alerts = computeTransportAlerts({ kpis, now: makeDate(10) });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('transport-fallback-active');
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].value).toBe(2);
  });

  // ── stale-count ───────────────────────────────────────────────────────

  it('generates warning when staleCount >= 1', () => {
    const kpis = makeKpis({ staleCount: 1 });
    const alerts = computeTransportAlerts({ kpis, now: makeDate(10) });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('transport-stale-count');
    expect(alerts[0].severity).toBe('warning');
  });

  it('shows stale count in alert value', () => {
    const kpis = makeKpis({ staleCount: 5 });
    const alerts = computeTransportAlerts({ kpis, now: makeDate(10) });
    expect(alerts[0].value).toBe(5);
  });

  // ── low-completion (time-gated) ───────────────────────────────────────

  it('does NOT generate low-completion before completionCheckHour', () => {
    const kpis = makeKpis({ arrivalCompletionRate: 20 });
    const alerts = computeTransportAlerts({
      kpis,
      now: makeDate(15), // 15:00 < 16:00
    });
    expect(alerts).toEqual([]);
  });

  it('generates warning at completionCheckHour with low rate', () => {
    const kpis = makeKpis({ arrivalCompletionRate: 30 });
    const alerts = computeTransportAlerts({
      kpis,
      now: makeDate(16), // exactly 16:00
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('transport-low-completion');
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].value).toBe(30);
  });

  it('generates warning after completionCheckHour with low rate', () => {
    const kpis = makeKpis({ arrivalCompletionRate: 49 });
    const alerts = computeTransportAlerts({
      kpis,
      now: makeDate(17),
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('transport-low-completion');
  });

  it('does NOT generate low-completion when rate >= threshold', () => {
    const kpis = makeKpis({ arrivalCompletionRate: 50 });
    const alerts = computeTransportAlerts({
      kpis,
      now: makeDate(17),
    });
    expect(alerts).toEqual([]);
  });

  it('does NOT generate low-completion when rate is null', () => {
    const kpis = makeKpis({ arrivalCompletionRate: null });
    const alerts = computeTransportAlerts({
      kpis,
      now: makeDate(17),
    });
    expect(alerts).toEqual([]);
  });

  // ── Multiple Alerts ───────────────────────────────────────────────────

  it('generates multiple alerts simultaneously', () => {
    const kpis = makeKpis({
      syncFailedCount: 5,
      fallbackActive: true,
      fallbackCount: 1,
      staleCount: 3,
      arrivalCompletionRate: 10,
    });
    const alerts = computeTransportAlerts({
      kpis,
      now: makeDate(17),
    });

    const ids = alerts.map((a) => a.id);
    expect(ids).toContain('transport-sync-fail-count');
    expect(ids).toContain('transport-fallback-active');
    expect(ids).toContain('transport-stale-count');
    expect(ids).toContain('transport-low-completion');
    expect(alerts).toHaveLength(4);
  });

  // ── Custom Thresholds ─────────────────────────────────────────────────

  it('respects custom thresholds', () => {
    const kpis = makeKpis({
      syncFailedCount: 1,
      arrivalCompletionRate: 70,
    });
    const alerts = computeTransportAlerts({
      kpis,
      now: makeDate(14),
      thresholds: {
        syncFailedMax: 1,          // lower threshold
        completionCheckHour: 14,   // earlier check
        completionRateMin: 80,     // higher bar
      },
    });

    const ids = alerts.map((a) => a.id);
    expect(ids).toContain('transport-sync-fail-count');
    expect(ids).toContain('transport-low-completion');
  });
});

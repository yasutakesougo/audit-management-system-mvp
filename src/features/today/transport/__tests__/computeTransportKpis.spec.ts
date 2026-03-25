/**
 * computeTransportKpis.spec.ts — Transport KPI 集計のユニットテスト
 */
import { describe, it, expect } from 'vitest';
import {
  computeTransportKpis,
  EMPTY_TRANSPORT_KPIS,
} from '../computeTransportKpis';
import type { TransportTelemetryEvent } from '../transportTelemetry';

// ── Helpers ─────────────────────────────────────────────────────────────────

const base = {
  eventVersion: 1 as const,
  source: 'useTransportStatus' as const,
  clientTs: '2026-03-25T09:00:00Z',
};

function transition(
  direction: 'to' | 'from',
  fromStatus: 'pending' | 'in-progress' | 'arrived' | 'absent' | 'self',
  toStatus: 'pending' | 'in-progress' | 'arrived' | 'absent' | 'self',
): TransportTelemetryEvent {
  return {
    ...base,
    type: 'transport:status-transition',
    userCode: 'U001',
    direction,
    fromStatus,
    toStatus,
  };
}

function syncFailed(): TransportTelemetryEvent {
  return {
    ...base,
    type: 'transport:sync-failed',
    userCode: 'U001',
    recordDate: '2026-03-25',
    direction: 'to',
    errorMessage: 'Server error',
    errorStatus: 500,
  };
}

function fallback(): TransportTelemetryEvent {
  return {
    ...base,
    type: 'transport:fallback-all-users',
    reason: 'fetch-error',
    totalUsersShown: 10,
  };
}

function stale(): TransportTelemetryEvent {
  return {
    ...base,
    type: 'transport:stale-in-progress',
    source: 'transportTimer',
    userCode: 'U001',
    direction: 'to',
    minutesElapsed: 35,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('computeTransportKpis', () => {
  it('returns empty KPIs for empty events', () => {
    const result = computeTransportKpis([]);
    expect(result).toEqual(EMPTY_TRANSPORT_KPIS);
  });

  it('counts transitions by direction', () => {
    const events: TransportTelemetryEvent[] = [
      transition('to', 'pending', 'in-progress'),
      transition('to', 'in-progress', 'arrived'),
      transition('from', 'pending', 'in-progress'),
    ];

    const result = computeTransportKpis(events);

    expect(result.transitionCount).toBe(3);
    expect(result.transitionCountTo).toBe(2);
    expect(result.transitionCountFrom).toBe(1);
  });

  it('counts arrived from toStatus', () => {
    const events: TransportTelemetryEvent[] = [
      transition('to', 'in-progress', 'arrived'),
      transition('from', 'in-progress', 'arrived'),
      transition('to', 'pending', 'in-progress'),
    ];

    const result = computeTransportKpis(events);
    expect(result.arrivedCount).toBe(2);
  });

  it('counts syncFailed events', () => {
    const events = [syncFailed(), syncFailed(), syncFailed()];
    const result = computeTransportKpis(events);
    expect(result.syncFailedCount).toBe(3);
  });

  it('counts fallback events and sets active', () => {
    const events = [fallback()];
    const result = computeTransportKpis(events);
    expect(result.fallbackCount).toBe(1);
    expect(result.fallbackActive).toBe(true);
  });

  it('sets fallbackActive false when no fallback', () => {
    const events = [stale()];
    const result = computeTransportKpis(events);
    expect(result.fallbackActive).toBe(false);
  });

  it('counts stale events', () => {
    const events = [stale(), stale()];
    const result = computeTransportKpis(events);
    expect(result.staleCount).toBe(2);
  });

  it('computes arrivalCompletionRate with totalTransportUsers', () => {
    const events: TransportTelemetryEvent[] = [
      transition('to', 'in-progress', 'arrived'),
      transition('to', 'in-progress', 'arrived'),
      transition('to', 'pending', 'in-progress'),
    ];

    const result = computeTransportKpis(events, 4);
    // 2 arrived / 4 total = 50%
    expect(result.arrivalCompletionRate).toBe(50);
  });

  it('returns null arrivalCompletionRate when totalTransportUsers is 0', () => {
    const events: TransportTelemetryEvent[] = [
      transition('to', 'in-progress', 'arrived'),
    ];
    const result = computeTransportKpis(events, 0);
    expect(result.arrivalCompletionRate).toBeNull();
  });

  it('returns null arrivalCompletionRate when totalTransportUsers is undefined', () => {
    const events: TransportTelemetryEvent[] = [
      transition('to', 'in-progress', 'arrived'),
    ];
    const result = computeTransportKpis(events);
    expect(result.arrivalCompletionRate).toBeNull();
  });

  it('rounds arrivalCompletionRate to nearest integer', () => {
    const events: TransportTelemetryEvent[] = [
      transition('to', 'in-progress', 'arrived'),
    ];
    // 1/3 = 33.33...%  → 33
    const result = computeTransportKpis(events, 3);
    expect(result.arrivalCompletionRate).toBe(33);
  });

  it('handles mixed event types correctly', () => {
    const events: TransportTelemetryEvent[] = [
      transition('to', 'pending', 'in-progress'),
      transition('to', 'in-progress', 'arrived'),
      syncFailed(),
      fallback(),
      stale(),
    ];

    const result = computeTransportKpis(events, 10);

    expect(result.transitionCount).toBe(2);
    expect(result.arrivedCount).toBe(1);
    expect(result.syncFailedCount).toBe(1);
    expect(result.fallbackCount).toBe(1);
    expect(result.fallbackActive).toBe(true);
    expect(result.staleCount).toBe(1);
    expect(result.arrivalCompletionRate).toBe(10);
  });
});

/**
 * transportTelemetry.spec.ts — Transport telemetry event recording tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Firebase ───────────────────────────────────────────────────────────
const mockAddDoc = vi.fn().mockResolvedValue({ id: 'mock-doc-id' });
vi.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  collection: vi.fn((_db: unknown, name: string) => `mock-collection:${name}`),
  serverTimestamp: vi.fn(() => 'MOCK_SERVER_TS'),
}));

vi.mock('@/infra/firestore/client', () => ({
  db: 'mock-db',
}));

import {
  getTransportStaleDedupKey,
  trackTransportEvent,
  type TransportTelemetryEvent,
} from '../transportTelemetry';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('trackTransportEvent', () => {
  beforeEach(() => {
    mockAddDoc.mockClear();
  });

  it('writes sync-failed event to telemetry collection', () => {
    const event: TransportTelemetryEvent = {
      type: 'transport:sync-failed',
      eventVersion: 1,
      source: 'useTransportStatus',
      userCode: 'U001',
      recordDate: '2026-03-25',
      direction: 'to',
      errorMessage: 'Request failed',
      errorStatus: 500,
      clientTs: '2026-03-25T09:00:00.000Z',
    };

    trackTransportEvent(event);

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [col, payload] = mockAddDoc.mock.calls[0];
    expect(col).toBe('mock-collection:telemetry');
    expect(payload.type).toBe('transport:sync-failed');
    expect(payload.eventVersion).toBe(1);
    expect(payload.source).toBe('useTransportStatus');
    expect(payload.userCode).toBe('U001');
    expect(payload.ts).toBe('MOCK_SERVER_TS');
  });

  it('writes fallback-all-users event', () => {
    const event: TransportTelemetryEvent = {
      type: 'transport:fallback-all-users',
      eventVersion: 1,
      source: 'useTransportStatus',
      reason: 'fetch-error',
      totalUsersShown: 10,
      clientTs: '2026-03-25T09:00:00.000Z',
    };

    trackTransportEvent(event);

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.type).toBe('transport:fallback-all-users');
    expect(payload.reason).toBe('fetch-error');
    expect(payload.totalUsersShown).toBe(10);
  });

  it('writes status-transition event', () => {
    const event: TransportTelemetryEvent = {
      type: 'transport:status-transition',
      eventVersion: 1,
      source: 'useTransportStatus',
      userCode: 'U002',
      direction: 'from',
      fromStatus: 'pending',
      toStatus: 'in-progress',
      clientTs: '2026-03-25T13:00:00.000Z',
    };

    trackTransportEvent(event);

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.type).toBe('transport:status-transition');
    expect(payload.fromStatus).toBe('pending');
    expect(payload.toStatus).toBe('in-progress');
  });

  it('writes stale-in-progress event', () => {
    const event: TransportTelemetryEvent = {
      type: 'transport:stale-in-progress',
      eventVersion: 1,
      source: 'transportTimer',
      userCode: 'U003',
      direction: 'to',
      minutesElapsed: 35,
      clientTs: '2026-03-25T10:30:00.000Z',
    };

    trackTransportEvent(event);

    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    const [, payload] = mockAddDoc.mock.calls[0];
    expect(payload.type).toBe('transport:stale-in-progress');
    expect(payload.minutesElapsed).toBe(35);
  });

  it('does not throw when addDoc rejects', () => {
    mockAddDoc.mockRejectedValueOnce(new Error('Network error'));

    expect(() => {
      trackTransportEvent({
        type: 'transport:sync-failed',
        eventVersion: 1,
        source: 'useTransportStatus',
        userCode: 'U001',
        recordDate: '2026-03-25',
        direction: 'to',
        errorMessage: 'test',
        clientTs: '2026-03-25T09:00:00.000Z',
      });
    }).not.toThrow();
  });
});

describe('getTransportStaleDedupKey', () => {
  it('generates key with 15-minute bucket', () => {
    // 30 minutes → bucket 2
    const key30 = getTransportStaleDedupKey('U001', '2026-03-25', 'to', 30);
    expect(key30).toBe('U001_2026-03-25_to_2');

    // 44 minutes → still bucket 2
    const key44 = getTransportStaleDedupKey('U001', '2026-03-25', 'to', 44);
    expect(key44).toBe('U001_2026-03-25_to_2');

    // 45 minutes → bucket 3 (re-notify)
    const key45 = getTransportStaleDedupKey('U001', '2026-03-25', 'to', 45);
    expect(key45).toBe('U001_2026-03-25_to_3');
  });

  it('differentiates by direction', () => {
    const keyTo = getTransportStaleDedupKey('U001', '2026-03-25', 'to', 30);
    const keyFrom = getTransportStaleDedupKey('U001', '2026-03-25', 'from', 30);
    expect(keyTo).not.toBe(keyFrom);
  });

  it('differentiates by userCode', () => {
    const key1 = getTransportStaleDedupKey('U001', '2026-03-25', 'to', 30);
    const key2 = getTransportStaleDedupKey('U002', '2026-03-25', 'to', 30);
    expect(key1).not.toBe(key2);
  });
});

/**
 * extractTransportDetails — Unit Tests
 *
 * Transport イベントから per-user 詳細を抽出する仕様をテストで固定する。
 */
import { describe, expect, it } from 'vitest';
import { extractTransportDetails } from '../domain/extractTransportDetails';
import type { TransportTelemetryEvent } from '@/features/today/transport/transportTelemetry';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeStaleEvent(
  userCode: string,
  direction: 'to' | 'from',
  minutesElapsed: number,
): TransportTelemetryEvent {
  return {
    type: 'transport:stale-in-progress',
    eventVersion: 1,
    source: 'useTransportStatus',
    userCode,
    direction,
    minutesElapsed,
  } as TransportTelemetryEvent;
}

function makeSyncFailedEvent(
  userCode: string,
  direction: 'to' | 'from',
  errorMessage: string,
): TransportTelemetryEvent {
  return {
    type: 'transport:sync-failed',
    eventVersion: 1,
    source: 'transportRepo',
    userCode,
    recordDate: '2026-03-24',
    direction,
    errorMessage,
  } as TransportTelemetryEvent;
}

function makeTransitionEvent(): TransportTelemetryEvent {
  return {
    type: 'transport:status-transition',
    eventVersion: 1,
    source: 'useTransportStatus',
    userCode: 'U999',
    direction: 'to',
    fromStatus: 'pending',
    toStatus: 'in-progress',
  } as TransportTelemetryEvent;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('extractTransportDetails', () => {
  it('空のイベント配列から空の結果を返す', () => {
    const result = extractTransportDetails([]);
    expect(result.staleUsers).toEqual([]);
    expect(result.syncFailedUsers).toEqual([]);
  });

  it('stale イベントをユーザー別に抽出する', () => {
    const events = [
      makeStaleEvent('U001', 'to', 35),
      makeStaleEvent('U002', 'from', 45),
    ];
    const result = extractTransportDetails(events);

    expect(result.staleUsers).toHaveLength(2);
    expect(result.staleUsers[0]).toMatchObject({
      userCode: 'U002',
      direction: 'from',
      minutesElapsed: 45,
    });
    expect(result.staleUsers[1]).toMatchObject({
      userCode: 'U001',
      minutesElapsed: 35,
    });
  });

  it('同一ユーザー×方向の stale は最大 minutesElapsed のものだけ残す', () => {
    const events = [
      makeStaleEvent('U001', 'to', 30), // oldest
      makeStaleEvent('U001', 'to', 45), // latest → should win
      makeStaleEvent('U001', 'to', 40), // intermediate
    ];
    const result = extractTransportDetails(events);

    expect(result.staleUsers).toHaveLength(1);
    expect(result.staleUsers[0].minutesElapsed).toBe(45);
  });

  it('stale は minutesElapsed 降順でソートされる', () => {
    const events = [
      makeStaleEvent('U001', 'to', 30),
      makeStaleEvent('U002', 'to', 60),
      makeStaleEvent('U003', 'from', 45),
    ];
    const result = extractTransportDetails(events);

    expect(result.staleUsers.map((s) => s.minutesElapsed)).toEqual([60, 45, 30]);
  });

  it('sync-failed イベントを抽出する', () => {
    const events = [
      makeSyncFailedEvent('U001', 'to', 'Network error'),
      makeSyncFailedEvent('U002', 'from', 'Timeout'),
    ];
    const result = extractTransportDetails(events);

    expect(result.syncFailedUsers).toHaveLength(2);
    expect(result.syncFailedUsers[0]).toMatchObject({
      userCode: 'U001',
      errorMessage: 'Network error',
    });
  });

  it('同一ユーザー×方向の sync-failed は重複除去される', () => {
    const events = [
      makeSyncFailedEvent('U001', 'to', 'First error'),
      makeSyncFailedEvent('U001', 'to', 'Second error'), // duplicate → skipped
    ];
    const result = extractTransportDetails(events);

    expect(result.syncFailedUsers).toHaveLength(1);
    expect(result.syncFailedUsers[0].errorMessage).toBe('First error');
  });

  it('transition / fallback イベントは無視される', () => {
    const events = [
      makeTransitionEvent(),
      {
        type: 'transport:fallback-all-users',
        eventVersion: 1,
        source: 'useTransportStatus',
        reason: 'list-not-found',
        totalUsersShown: 20,
      } as TransportTelemetryEvent,
    ];
    const result = extractTransportDetails(events);

    expect(result.staleUsers).toEqual([]);
    expect(result.syncFailedUsers).toEqual([]);
  });
});

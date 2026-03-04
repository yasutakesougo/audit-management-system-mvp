/**
 * Transport Status Logic — Unit Tests
 *
 * Tests for pure domain logic: derivation, state transitions,
 * direction summaries, overdue detection, and time utilities.
 */

import { describe, expect, it } from 'vitest';
import {
    applyTransition,
    canTransition,
    computeDirectionSummary,
    deriveTransportLegs,
    formatHHmm,
    getDefaultDirection,
    parseHHmmToMinutes,
    type TransportLogEntry,
    type TransportUserInfo,
    type TransportVisitInfo,
} from '../transportStatusLogic';
import { isTerminalStatus, TRANSPORT_TRANSITIONS, type TransportLeg } from '../transportTypes';

// ─── Factories ──────────────────────────────────────────────────────────────

const mkUser = (overrides: Partial<TransportUserInfo> = {}): TransportUserInfo => ({
  userId: 'U001',
  fullName: '田中太郎',
  isTransportTarget: true,
  ...overrides,
});

const mkVisit = (overrides: Partial<TransportVisitInfo> = {}): TransportVisitInfo => ({
  transportTo: true,
  transportFrom: true,
  ...overrides,
});

const mkLeg = (overrides: Partial<TransportLeg> = {}): TransportLeg => ({
  userId: 'U001',
  userName: '田中太郎',
  direction: 'to',
  method: 'office_shuttle',
  status: 'pending',
  ...overrides,
});

// ─── deriveTransportLegs ────────────────────────────────────────────────────

describe('deriveTransportLegs', () => {
  it('creates pending legs for shuttle users', () => {
    const users = [mkUser()];
    const visits: Record<string, TransportVisitInfo> = {
      U001: mkVisit({ scheduledArrivalTime: '09:00' }),
    };

    const legs = deriveTransportLegs(users, visits, [], 'to');

    expect(legs).toHaveLength(1);
    expect(legs[0]).toEqual(
      expect.objectContaining({
        userId: 'U001',
        userName: '田中太郎',
        direction: 'to',
        method: 'office_shuttle',
        status: 'pending',
        scheduledTime: '09:00',
      }),
    );
  });

  it('creates self leg for self-transport users', () => {
    const users = [mkUser({ isTransportTarget: false })];
    const visits: Record<string, TransportVisitInfo> = {
      U001: mkVisit({ transportTo: false }),
    };

    const legs = deriveTransportLegs(users, visits, [], 'to');

    expect(legs).toHaveLength(1);
    expect(legs[0].status).toBe('self');
    expect(legs[0].method).toBe('self');
  });

  it('restores status from existing log entries', () => {
    const users = [mkUser()];
    const visits: Record<string, TransportVisitInfo> = { U001: mkVisit() };
    const logs: TransportLogEntry[] = [
      { userId: 'U001', direction: 'to', status: 'arrived', actualTime: '09:05' },
    ];

    const legs = deriveTransportLegs(users, visits, logs, 'to');

    expect(legs[0].status).toBe('arrived');
    expect(legs[0].actualTime).toBe('09:05');
  });

  it('uses scheduled departure time for from direction', () => {
    const users = [mkUser()];
    const visits: Record<string, TransportVisitInfo> = {
      U001: mkVisit({ scheduledDepartureTime: '16:30' }),
    };

    const legs = deriveTransportLegs(users, visits, [], 'from');

    expect(legs[0].scheduledTime).toBe('16:30');
    expect(legs[0].direction).toBe('from');
  });

  it('handles missing visit data gracefully', () => {
    const users = [mkUser()];
    const visits: Record<string, TransportVisitInfo> = {};

    const legs = deriveTransportLegs(users, visits, [], 'to');

    expect(legs).toHaveLength(1);
    // Without visit data, resolveToMethod falls back to user.isTransportTarget
    expect(legs[0].method).toBe('office_shuttle');
    expect(legs[0].scheduledTime).toBeUndefined();
  });

  it('handles multiple users correctly', () => {
    const users = [
      mkUser({ userId: 'U001', fullName: '田中太郎' }),
      mkUser({ userId: 'U002', fullName: '佐藤花子', isTransportTarget: false }),
      mkUser({ userId: 'U003', fullName: '鈴木次郎' }),
    ];
    const visits: Record<string, TransportVisitInfo> = {
      U001: mkVisit(),
      U002: mkVisit({ transportTo: false }),
      U003: mkVisit(),
    };

    const legs = deriveTransportLegs(users, visits, [], 'to');

    expect(legs).toHaveLength(3);
    expect(legs[0].method).toBe('office_shuttle');
    expect(legs[1].status).toBe('self');
    expect(legs[2].method).toBe('office_shuttle');
  });

  it('does not mix logs from different directions', () => {
    const users = [mkUser()];
    const visits: Record<string, TransportVisitInfo> = { U001: mkVisit() };
    const logs: TransportLogEntry[] = [
      { userId: 'U001', direction: 'from', status: 'arrived', actualTime: '16:30' },
    ];

    const toLegs = deriveTransportLegs(users, visits, logs, 'to');
    expect(toLegs[0].status).toBe('pending'); // from log should not affect 'to'

    const fromLegs = deriveTransportLegs(users, visits, logs, 'from');
    expect(fromLegs[0].status).toBe('arrived');
  });
});

// ─── State Transitions ──────────────────────────────────────────────────────

describe('canTransition', () => {
  it('allows pending → in-progress', () => {
    expect(canTransition('pending', 'in-progress')).toBe(true);
  });

  it('allows pending → absent', () => {
    expect(canTransition('pending', 'absent')).toBe(true);
  });

  it('allows in-progress → arrived', () => {
    expect(canTransition('in-progress', 'arrived')).toBe(true);
  });

  it('blocks arrived → any', () => {
    expect(canTransition('arrived', 'pending')).toBe(false);
    expect(canTransition('arrived', 'in-progress')).toBe(false);
    expect(canTransition('arrived', 'absent')).toBe(false);
  });

  it('blocks absent → any', () => {
    expect(canTransition('absent', 'pending')).toBe(false);
    expect(canTransition('absent', 'in-progress')).toBe(false);
  });

  it('blocks self → any', () => {
    expect(canTransition('self', 'pending')).toBe(false);
    expect(canTransition('self', 'in-progress')).toBe(false);
    expect(canTransition('self', 'arrived')).toBe(false);
  });

  it('blocks skip (pending → arrived)', () => {
    expect(canTransition('pending', 'arrived')).toBe(false);
  });
});

describe('applyTransition', () => {
  it('returns new leg with updated status', () => {
    const leg = mkLeg({ status: 'pending' });
    const result = applyTransition(leg, 'in-progress');

    expect(result).not.toBeNull();
    expect(result!.status).toBe('in-progress');
    // Original is unchanged (immutable)
    expect(leg.status).toBe('pending');
  });

  it('auto-sets actualTime on arrival', () => {
    const leg = mkLeg({ status: 'in-progress' });
    const now = new Date('2025-11-16T09:15:00');
    const result = applyTransition(leg, 'arrived', now);

    expect(result).not.toBeNull();
    expect(result!.status).toBe('arrived');
    expect(result!.actualTime).toBe('09:15');
  });

  it('returns null for invalid transition', () => {
    const leg = mkLeg({ status: 'arrived' });
    const result = applyTransition(leg, 'pending');

    expect(result).toBeNull();
  });

  it('returns null for self → any transition', () => {
    const leg = mkLeg({ status: 'self' });
    const result = applyTransition(leg, 'arrived');

    expect(result).toBeNull();
  });
});

// ─── isTerminalStatus ───────────────────────────────────────────────────────

describe('isTerminalStatus', () => {
  it.each<[string, boolean]>([
    ['pending', false],
    ['in-progress', false],
    ['arrived', true],
    ['absent', true],
    ['self', true],
  ])('%s → %s', (status, expected) => {
    expect(isTerminalStatus(status as any)).toBe(expected);
  });
});

// ─── TRANSPORT_TRANSITIONS completeness ─────────────────────────────────────

describe('TRANSPORT_TRANSITIONS', () => {
  it('defines transitions for all statuses', () => {
    const allStatuses = ['pending', 'in-progress', 'arrived', 'absent', 'self'] as const;
    for (const status of allStatuses) {
      expect(TRANSPORT_TRANSITIONS).toHaveProperty(status);
    }
  });
});

// ─── computeDirectionSummary ────────────────────────────────────────────────

describe('computeDirectionSummary', () => {
  it('counts statuses correctly', () => {
    const legs: TransportLeg[] = [
      mkLeg({ userId: 'U001', status: 'arrived' }),
      mkLeg({ userId: 'U002', status: 'pending' }),
      mkLeg({ userId: 'U003', status: 'in-progress' }),
      mkLeg({ userId: 'U004', status: 'absent' }),
      mkLeg({ userId: 'U005', status: 'self' }),
    ];

    const summary = computeDirectionSummary(legs, 'to');

    expect(summary.total).toBe(4);       // excluding self
    expect(summary.arrived).toBe(1);
    expect(summary.pending).toBe(1);
    expect(summary.inProgress).toBe(1);
    expect(summary.absent).toBe(1);
    expect(summary.selfCount).toBe(1);
  });

  it('detects overdue users (5min grace)', () => {
    const legs: TransportLeg[] = [
      mkLeg({ userId: 'U001', status: 'pending', scheduledTime: '09:00' }),
      mkLeg({ userId: 'U002', status: 'pending', scheduledTime: '09:10' }),
      mkLeg({ userId: 'U003', status: 'arrived', scheduledTime: '09:00' }), // already arrived, not overdue
    ];

    const summary = computeDirectionSummary(legs, 'to', '09:06');

    // U001: 09:00 + 5min = 09:05 < 09:06 → overdue
    // U002: 09:10 + 5min = 09:15 > 09:06 → NOT overdue
    expect(summary.overdueUserIds).toEqual(['U001']);
  });

  it('returns empty overdueUserIds when no currentTime provided', () => {
    const legs: TransportLeg[] = [
      mkLeg({ status: 'pending', scheduledTime: '09:00' }),
    ];

    const summary = computeDirectionSummary(legs, 'to');
    expect(summary.overdueUserIds).toEqual([]);
  });

  it('filters by direction', () => {
    const legs: TransportLeg[] = [
      mkLeg({ direction: 'to', status: 'arrived' }),
      mkLeg({ direction: 'from', status: 'pending' }),
    ];

    const toSummary = computeDirectionSummary(legs, 'to');
    expect(toSummary.total).toBe(1);
    expect(toSummary.arrived).toBe(1);

    const fromSummary = computeDirectionSummary(legs, 'from');
    expect(fromSummary.total).toBe(1);
    expect(fromSummary.pending).toBe(1);
  });

  it('handles empty legs array', () => {
    const summary = computeDirectionSummary([], 'to');
    expect(summary.total).toBe(0);
    expect(summary.arrived).toBe(0);
    expect(summary.selfCount).toBe(0);
    expect(summary.overdueUserIds).toEqual([]);
  });
});

// ─── getDefaultDirection ────────────────────────────────────────────────────

describe('getDefaultDirection', () => {
  it('returns "to" in the morning', () => {
    expect(getDefaultDirection(new Date('2025-11-16T08:00:00'))).toBe('to');
    expect(getDefaultDirection(new Date('2025-11-16T12:59:00'))).toBe('to');
  });

  it('returns "from" in the afternoon', () => {
    expect(getDefaultDirection(new Date('2025-11-16T13:00:00'))).toBe('from');
    expect(getDefaultDirection(new Date('2025-11-16T17:00:00'))).toBe('from');
  });
});

// ─── Utilities ──────────────────────────────────────────────────────────────

describe('formatHHmm', () => {
  it('formats single-digit hours/minutes with padding', () => {
    expect(formatHHmm(new Date('2025-11-16T09:05:00'))).toBe('09:05');
  });

  it('formats midnight', () => {
    expect(formatHHmm(new Date('2025-11-16T00:00:00'))).toBe('00:00');
  });

  it('formats noon', () => {
    expect(formatHHmm(new Date('2025-11-16T12:00:00'))).toBe('12:00');
  });
});

describe('parseHHmmToMinutes', () => {
  it('parses valid HH:mm', () => {
    expect(parseHHmmToMinutes('09:00')).toBe(540);
    expect(parseHHmmToMinutes('00:00')).toBe(0);
    expect(parseHHmmToMinutes('23:59')).toBe(1439);
  });

  it('parses single-digit hour', () => {
    expect(parseHHmmToMinutes('9:05')).toBe(545);
  });

  it('returns null for invalid formats', () => {
    expect(parseHHmmToMinutes('')).toBeNull();
    expect(parseHHmmToMinutes('abc')).toBeNull();
    expect(parseHHmmToMinutes('25:00')).toBeNull();
    expect(parseHHmmToMinutes('12:60')).toBeNull();
    expect(parseHHmmToMinutes('12')).toBeNull();
  });
});

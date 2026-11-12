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
    applyTransportLogs,
    buildLegsForScheduleAssignments,
    composeEffectiveLegs,
    deriveTransportLegs,
    filterScheduleRowsForJstDate,
    canOperateTransportBoard,
    enqueueTransportLogSave,
    isCurrentTransportDate,
    jstCalendarDateKey,
    msUntilNextJstMidnight,
    resolveScheduleFeedPhase,
    resolveTransportBoardPhase,
    restoreLegAfterFailedSave,
    selectTransportLogsForDate,
    transitionTransportLegs,
    transportLegHoldKey,
    formatHHmm,
    getDefaultDirection,
    parseHHmmToMinutes,
    type TransportLogEntry,
    type TransportUserInfo,
    type TransportVisitInfo,
} from '../transportStatusLogic';
import { isTerminalStatus, TRANSPORT_TRANSITIONS, type TransportLeg, type TransportLegStatus } from '../transportTypes';

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
    expect(isTerminalStatus(status as TransportLegStatus)).toBe(expected);
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

describe('buildLegsForScheduleAssignments', () => {
  const names = new Map([['U002', '鈴木 美子']]);

  it('adds a leg for a saved transport row when the user has no master profile', () => {
    const legs = buildLegsForScheduleAssignments(
      [{
        userId: 'U002',
        title: '送迎（往路）',
        serviceType: 'transport',
        start: '2026-03-25T08:00:00+09:00',
        vehicleId: '車両1',
        assignedStaffId: 'STF001',
        notes: '玄関前待機 [transport_attendant:STF002] [transport_course:isogo]',
      }],
      [],
      names,
    );

    expect(legs).toEqual([
      expect.objectContaining({
        userId: 'U002',
        userName: '鈴木 美子',
        direction: 'to',
        method: 'office_shuttle',
        status: 'pending',
      }),
    ]);
  });

  it('does not duplicate a user who is already a leg', () => {
    const existing = [{
      userId: 'U002',
      userName: '鈴木 美子',
      direction: 'to' as const,
      method: 'office_shuttle' as const,
      status: 'pending' as const,
    }];

    expect(buildLegsForScheduleAssignments(
      [{
        userId: 'U002',
        title: '送迎（往路）',
        serviceType: 'transport',
        start: '2026-03-25T08:00:00+09:00',
        vehicleId: '車両1',
      }],
      existing,
      names,
    )).toEqual([]);
  });
});

const JST_2359 = '2026-03-25T14:59:00.000Z';
const JST_0000_NEXT = '2026-03-25T15:00:00.000Z';

function scheduleRow(userId: string, start: string) {
  return {
    userId,
    title: '送迎（往路）',
    serviceType: 'transport',
    start,
    vehicleId: '車両1',
    assignedStaffId: 'STF001',
  };
}

describe('transport JST date boundary', () => {
  it('keeps JST 23:59 on the same calendar day and moves 00:00 to the next day', () => {
    expect(jstCalendarDateKey(JST_2359)).toBe('2026-03-25');
    expect(jstCalendarDateKey(JST_0000_NEXT)).toBe('2026-03-26');
  });

  it('updates the accepted schedule range to the new JST date', () => {
    const nextKey = jstCalendarDateKey(JST_0000_NEXT);
    expect(nextKey).toBe('2026-03-26');
    expect({
      from: `${nextKey}T00:00:00+09:00`,
      to: `${nextKey}T23:59:59+09:00`,
    }).toEqual({
      from: '2026-03-26T00:00:00+09:00',
      to: '2026-03-26T23:59:59+09:00',
    });
  });

  it('excludes the previous JST day from the rows used as today', () => {
    const rows = filterScheduleRowsForJstDate([
      scheduleRow('U001', '2026-03-25T08:00:00+09:00'),
      scheduleRow('U002', JST_0000_NEXT),
    ], '2026-03-26');

    expect(rows.map((row) => row.userId)).toEqual(['U002']);
  });

  it('does not let a previous day Transport_Log change the new day', () => {
    const selected = selectTransportLogsForDate([
      { userId: 'U002', direction: 'to', status: 'arrived', actualTime: '16:00', recordDate: '2026-03-25' },
      { userId: 'U002', direction: 'to', status: 'in-progress', actualTime: '08:40', recordDate: '2026-03-26' },
    ], '2026-03-26');

    expect(applyTransportLogs([
      mkLeg({ userId: 'U002', userName: '鈴木 美子', status: 'pending' }),
    ], selected, '2026-03-26')).toEqual([
      expect.objectContaining({ status: 'in-progress', actualTime: '08:40' }),
    ]);
  });

  it('rejects a snapshot that belongs to the previous date', () => {
    expect(isCurrentTransportDate('2026-03-25', '2026-03-26')).toBe(false);
    expect(isCurrentTransportDate('2026-03-26', '2026-03-26')).toBe(true);
  });
});

describe('schedule leg status', () => {
  const names = new Map([['U002', '鈴木 美子']]);
  const row = scheduleRow('U002', '2026-03-25T08:00:00+09:00');

  it('starts a schedule-only rider, then records departure, arrival, and absence', () => {
    const initial = buildLegsForScheduleAssignments([row], [], names, '2026-03-25');
    expect(initial).toHaveLength(1);
    expect(initial[0]).toMatchObject({ userId: 'U002', status: 'pending', direction: 'to' });

    const departed = transitionTransportLegs(initial, 'U002', 'to', 'in-progress');
    expect(departed?.updated.status).toBe('in-progress');

    const arrivedAt = new Date('2026-03-25T00:10:00.000Z');
    const arrived = transitionTransportLegs(departed?.legs ?? [], 'U002', 'to', 'arrived', arrivedAt);
    expect(arrived?.updated).toMatchObject({ status: 'arrived', actualTime: formatHHmm(arrivedAt) });

    const absent = transitionTransportLegs(initial, 'U002', 'to', 'absent');
    expect(absent?.updated.status).toBe('absent');
  });

  it('restores a saved Transport_Log status and actual time', () => {
    const [leg] = applyTransportLogs(
      buildLegsForScheduleAssignments([row], [], names, '2026-03-25'),
      [{ userId: 'U002', direction: 'to', status: 'in-progress', actualTime: '08:40', recordDate: '2026-03-25' }],
      '2026-03-25',
    );

    expect(leg).toMatchObject({ status: 'in-progress', actualTime: '08:40' });
  });

  it('does not create a second leg when the user already comes from the master profile', () => {
    const master = [mkLeg({ userId: 'U002', userName: '鈴木 美子', status: 'pending' })];
    const extras = buildLegsForScheduleAssignments([row], master, names, '2026-03-25');
    const effective = composeEffectiveLegs({
      previous: [],
      derived: [...master, ...extras],
      preserveLocalStatus: true,
    });

    expect(extras).toEqual([]);
    expect(effective).toHaveLength(1);
  });

  it('lets a persisted arrival replace a local departure that is no longer in flight', () => {
    const local = mkLeg({ userId: 'U002', userName: '鈴木 美子', status: 'in-progress', actualTime: '08:41' });
    const persisted = mkLeg({ userId: 'U002', userName: '鈴木 美子', status: 'arrived', actualTime: '09:10' });
    const refetched = composeEffectiveLegs({
      previous: [local],
      derived: [persisted],
      preserveLocalStatus: true,
    });

    expect(refetched[0]).toMatchObject({ status: 'arrived', actualTime: '09:10' });
  });

  it('keeps an optimistic departure only while that leg is held', () => {
    const local = mkLeg({ userId: 'U002', userName: '鈴木 美子', status: 'in-progress', actualTime: '08:41' });
    const refetched = composeEffectiveLegs({
      previous: [local],
      derived: [mkLeg({ userId: 'U002', userName: '鈴木 美子', status: 'pending' })],
      preserveLocalStatus: true,
      heldKeys: new Set([transportLegHoldKey('U002', 'to')]),
    });

    expect(refetched[0]).toMatchObject({ status: 'in-progress', actualTime: '08:41' });
  });

  it('drops the previous day even when a hold key is still set', () => {
    const local = mkLeg({ userId: 'U002', userName: '鈴木 美子', status: 'in-progress', actualTime: '08:41' });
    const refetched = composeEffectiveLegs({
      previous: [local],
      derived: [mkLeg({ userId: 'U002', userName: '鈴木 美子', status: 'pending' })],
      preserveLocalStatus: false,
      heldKeys: new Set([transportLegHoldKey('U002', 'to')]),
    });

    expect(refetched[0]).toMatchObject({ status: 'pending' });
    expect(refetched[0]?.actualTime).toBeUndefined();
  });
});

describe('JST midnight delay', () => {
  it('measures the boundary from the Asia/Tokyo calendar day', () => {
    expect(msUntilNextJstMidnight(new Date(JST_2359))).toBe(60_000);
    expect(msUntilNextJstMidnight(new Date('2026-03-25T14:59:30.000Z'))).toBe(30_000);
    expect(msUntilNextJstMidnight(new Date(JST_0000_NEXT))).toBe(24 * 60 * 60 * 1000);
  });
});

describe('transport feed readiness', () => {
  it('keeps a stale loading=false result closed until that date has been seen loading', () => {
    expect(resolveScheduleFeedPhase({
      sawLoadingForDate: false,
      loading: false,
      hasError: false,
    })).toBe('loading');
  });

  it('stays loading while the request is in flight and fails closed after an error', () => {
    expect(resolveScheduleFeedPhase({
      sawLoadingForDate: true,
      loading: true,
      hasError: false,
    })).toBe('loading');
    expect(resolveScheduleFeedPhase({
      sawLoadingForDate: true,
      loading: false,
      hasError: true,
    })).toBe('error');
  });

  it('becomes ready only after the request finishes without an error', () => {
    expect(resolveScheduleFeedPhase({
      sawLoadingForDate: true,
      loading: false,
      hasError: false,
    })).toBe('ready');
  });

  it('blocks operations unless both feeds succeeded for the active date', () => {
    expect(resolveTransportBoardPhase({ schedules: 'ready', logs: 'loading' })).toBe('loading');
    expect(resolveTransportBoardPhase({ schedules: 'error', logs: 'ready' })).toBe('error');
    expect(resolveTransportBoardPhase({ schedules: 'ready', logs: 'error' })).toBe('error');
    expect(resolveTransportBoardPhase({ schedules: 'ready', logs: 'ready' })).toBe('ready');
    expect(canOperateTransportBoard({
      activeDateKey: '2026-03-26',
      boardDateKey: '2026-03-26',
      phase: 'loading',
    })).toBe(false);
    expect(canOperateTransportBoard({
      activeDateKey: '2026-03-26',
      boardDateKey: '2026-03-25',
      phase: 'ready',
    })).toBe(false);
    expect(canOperateTransportBoard({
      activeDateKey: '2026-03-26',
      boardDateKey: '2026-03-26',
      phase: 'ready',
    })).toBe(true);
  });
});

describe('enqueueTransportLogSave', () => {
  it('starts the arrival write only after the departure write settles', async () => {
    const chains = new Map<string, Promise<void>>();
    const order: string[] = [];
    let releaseDeparture: (() => void) | undefined;
    const departure = enqueueTransportLogSave({
      chains,
      key: '2026-03-26\0to\0U002',
      save: () => new Promise<void>((resolve) => {
        order.push('depart');
        releaseDeparture = resolve;
      }),
    });
    const arrival = enqueueTransportLogSave({
      chains,
      key: '2026-03-26\0to\0U002',
      save: async () => {
        order.push('arrive');
      },
    });

    await Promise.resolve();
    expect(order).toEqual(['depart']);
    releaseDeparture?.();
    await departure;
    await arrival;
    expect(order).toEqual(['depart', 'arrive']);
  });

  it('still writes the later status when the earlier write fails', async () => {
    const chains = new Map<string, Promise<void>>();
    const order: string[] = [];
    const departure = enqueueTransportLogSave({
      chains,
      key: 'same',
      save: async () => {
        order.push('depart');
        throw new Error('depart failed');
      },
    });
    const arrival = enqueueTransportLogSave({
      chains,
      key: 'same',
      save: async () => {
        order.push('arrive');
      },
    });

    await expect(departure).rejects.toThrow('depart failed');
    await arrival;
    expect(order).toEqual(['depart', 'arrive']);
  });

  it('does not block a different leg', async () => {
    const chains = new Map<string, Promise<void>>();
    const started: string[] = [];
    let release: (() => void) | undefined;
    enqueueTransportLogSave({
      chains,
      key: 'U001',
      save: () => new Promise<void>((resolve) => {
        started.push('U001');
        release = resolve;
      }),
    });
    const other = enqueueTransportLogSave({
      chains,
      key: 'U002',
      save: async () => {
        started.push('U002');
      },
    });

    await other;
    expect(started).toEqual(['U001', 'U002']);
    release?.();
  });
});

describe('restoreLegAfterFailedSave', () => {
  const previous = mkLeg({ userId: 'U001', userName: '田中太郎', status: 'pending' });

  it('does not restore a failed save onto a different JST date', () => {
    expect(restoreLegAfterFailedSave({
      current: [mkLeg({ userId: 'U001', userName: '田中太郎', status: 'arrived', actualTime: '09:05' })],
      previous,
      userId: 'U001',
      direction: 'to',
      startedDateKey: '2026-03-25',
      activeDateKey: '2026-03-26',
      boardDateKey: '2026-03-26',
      operationRevision: 1,
      latestRevision: 1,
    })).toBeNull();
  });

  it('does not let an older failure replace a newer same-day operation', () => {
    expect(restoreLegAfterFailedSave({
      current: [mkLeg({ userId: 'U001', userName: '田中太郎', status: 'arrived', actualTime: '09:05' })],
      previous,
      userId: 'U001',
      direction: 'to',
      startedDateKey: '2026-03-25',
      activeDateKey: '2026-03-25',
      boardDateKey: '2026-03-25',
      operationRevision: 1,
      latestRevision: 2,
    })).toBeNull();
  });

  it('restores the previous leg when that save is still the latest operation on the same date', () => {
    const restored = restoreLegAfterFailedSave({
      current: [mkLeg({ userId: 'U001', userName: '田中太郎', status: 'in-progress', actualTime: '08:41' })],
      previous,
      userId: 'U001',
      direction: 'to',
      startedDateKey: '2026-03-25',
      activeDateKey: '2026-03-25',
      boardDateKey: '2026-03-25',
      operationRevision: 1,
      latestRevision: 1,
    });

    expect(restored?.[0]).toMatchObject({ status: 'pending' });
  });
});

/**
 * Transport Status — Pure domain logic
 *
 * All functions are pure (no React state, no side effects).
 * Tested in __tests__/transportStatusLogic.spec.ts
 *
 * Responsibilities:
 * 1. Derive TransportLeg[] from users + visits + existing logs
 * 2. State transitions (validate + apply)
 * 3. Compute direction summaries
 * 4. Overdue detection
 */

import { UserCore } from '@/features/users/schema';
import type { TransportMethod } from '@/features/attendance/transportMethod';
import { resolveFromMethod, resolveToMethod } from '@/features/attendance/transportMethod';
import { inferTransportDirections, isTransportScheduleRow } from './transportAssignments';
import {
    AUTO_SWITCH_HOUR,
    TRANSPORT_TRANSITIONS,
    type TransportDirection,
    type TransportDirectionSummary,
    type TransportLeg,
    type TransportLegStatus,
} from './transportTypes';

// ─── Input types (minimal interfaces for decoupling) ────────────────────────

/** Minimal user info needed for transport derivation */
export type TransportUserInfo = {
  userId: string;
  fullName: string;
  isTransportTarget: boolean;
  defaultTransportToMethod?: TransportMethod;
  defaultTransportFromMethod?: TransportMethod;
};

/** Minimal visit info from attendance */
export type TransportVisitInfo = {
  transportTo: boolean;
  transportFrom: boolean;
  transportToMethod?: TransportMethod;
  transportFromMethod?: TransportMethod;
  scheduledArrivalTime?: string;   // HH:mm
  scheduledDepartureTime?: string; // HH:mm
};

/** Existing log entry (from SP or local state) */
export type TransportLogEntry = {
  userId: string;
  direction: TransportDirection;
  status: TransportLegStatus;
  actualTime?: string;
  driverName?: string;
  notes?: string;
  recordDate?: string;
};

// ─── Core: Derive transport legs ────────────────────────────────────────────

/**
 * Derive TransportLeg[] for a single direction from raw data.
 *
 * Uses resolveToMethod/resolveFromMethod from transportMethod.ts
 * to determine each user's transport method, then creates legs
 * with status from existing logs (or defaults).
 */
export function deriveTransportLegs(
  users: TransportUserInfo[],
  visits: Record<string, TransportVisitInfo>,
  existingLogs: TransportLogEntry[],
  direction: TransportDirection,
): TransportLeg[] {
  return users.map((user) => {
    const visit = visits[user.userId];

    // Resolve method using existing utility (priority chain inside)
    const method = direction === 'to'
      ? resolveToMethod(user, visit)
      : resolveFromMethod(user, visit);

    // Self-transport = terminal status, no further tracking needed
    if (method === 'self') {
      return {
        userId: user.userId,
        userName: user.fullName,
        direction,
        method,
        status: 'self' as const,
        scheduledTime: undefined,
        actualTime: undefined,
      };
    }

    // Find existing log for this user + direction
    const existing = existingLogs.find(
      (log) => log.userId === user.userId && log.direction === direction,
    );

    const scheduledTime = direction === 'to'
      ? visit?.scheduledArrivalTime
      : visit?.scheduledDepartureTime;

    return {
      userId: user.userId,
      userName: user.fullName,
      direction,
      method,
      status: existing?.status ?? 'pending',
      scheduledTime,
      actualTime: existing?.actualTime,
      driverName: existing?.driverName,
      notes: existing?.notes,
    };
  });
}

// ─── State Transitions ──────────────────────────────────────────────────────

/**
 * Check if a transition from `current` to `next` is valid.
 */
export function canTransition(
  current: TransportLegStatus,
  next: TransportLegStatus,
): boolean {
  return TRANSPORT_TRANSITIONS[current].includes(next);
}

/**
 * Apply a status transition to a leg.
 * Returns a new TransportLeg (immutable) or null if transition is invalid.
 *
 * When transitioning to 'arrived', automatically sets actualTime.
 */
export function applyTransition(
  leg: TransportLeg,
  nextStatus: TransportLegStatus,
  now?: Date,
): TransportLeg | null {
  if (!canTransition(leg.status, nextStatus)) {
    return null;
  }

  const updatedLeg: TransportLeg = { ...leg, status: nextStatus };

  // Auto-set actualTime on arrival
  if (nextStatus === 'arrived') {
    const time = now ?? new Date();
    updatedLeg.actualTime = formatHHmm(time);
  }

  return updatedLeg;
}

// ─── Direction Summary ──────────────────────────────────────────────────────

/**
 * Compute aggregate summary for a direction.
 */
export function computeDirectionSummary(
  legs: TransportLeg[],
  direction: TransportDirection,
  currentTime?: string, // HH:mm — for overdue detection
): TransportDirectionSummary {
  const dirLegs = legs.filter((l) => l.direction === direction);

  // Self users are counted separately
  const selfLegs = dirLegs.filter((l) => l.status === 'self');
  const trackableLegs = dirLegs.filter((l) => l.status !== 'self');

  const arrived = trackableLegs.filter((l) => l.status === 'arrived').length;
  const inProgress = trackableLegs.filter((l) => l.status === 'in-progress').length;
  const pending = trackableLegs.filter((l) => l.status === 'pending').length;
  const absent = trackableLegs.filter((l) => l.status === 'absent').length;

  // Overdue detection: pending/in-progress legs past scheduled time + 5min
  const overdueUserIds: string[] = [];
  if (currentTime) {
    const currentMinutes = parseHHmmToMinutes(currentTime);
    if (currentMinutes !== null) {
      for (const leg of trackableLegs) {
        if (leg.status !== 'pending' && leg.status !== 'in-progress') continue;
        if (!leg.scheduledTime) continue;
        const scheduledMinutes = parseHHmmToMinutes(leg.scheduledTime);
        if (scheduledMinutes !== null && currentMinutes > scheduledMinutes + 5) {
          overdueUserIds.push(leg.userId);
        }
      }
    }
  }

  return {
    direction,
    total: trackableLegs.length,
    arrived,
    inProgress,
    pending,
    absent,
    selfCount: selfLegs.length,
    overdueUserIds,
  };
}

// ─── Default direction based on time ────────────────────────────────────────

/**
 * Determine which direction tab should be active by default.
 * Before 13:00 → 'to' (往路), after → 'from' (復路).
 */
export function getDefaultDirection(now?: Date): TransportDirection {
  const hour = (now ?? new Date()).getHours();
  return hour >= AUTO_SWITCH_HOUR ? 'from' : 'to';
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Format Date to HH:mm string */
export function formatHHmm(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Parse HH:mm to minutes since midnight (or null if invalid) */
export function parseHHmmToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/**
 * Check if a user has any transport configuration set in their master record.
 * This is used for filtering targets in both execution and assignment views.
 */
export function hasTransportInfo(u: UserCore): boolean {
  if (!u) return false;

  // 1. Check Fixed Course
  if (u.TransportCourse && u.TransportCourse.trim().length > 0) return true;

  // 2. Check Specific Days (Legacy)
  const toDays = u.TransportToDays;
  const fromDays = u.TransportFromDays;
  if (Array.isArray(toDays) && toDays.length > 0) return true;
  if (Array.isArray(fromDays) && fromDays.length > 0) return true;

  // 3. Check Weekly Schedule JSON
  if (u.TransportSchedule) {
    try {
      const schedule = typeof u.TransportSchedule === 'string'
        ? JSON.parse(u.TransportSchedule)
        : u.TransportSchedule;

      if (!schedule || typeof schedule !== 'object') return false;

      // If any day has a transport method other than 'none', they are a target
      return Object.values(schedule).some((day: unknown) => {
        const d = day as { to?: string; from?: string };
        return (d.to && d.to !== 'none') || (d.from && d.from !== 'none');
      });
    } catch (e) {
      console.warn('[transportStatusLogic] Failed to parse TransportSchedule', e);
    }
  }

  return false;
}

function hasSavedTransportAssignment(row: Record<string, unknown>): boolean {
  const vehicleId = typeof row.vehicleId === 'string' ? row.vehicleId.trim() : '';
  const staffId = typeof row.assignedStaffId === 'string' ? row.assignedStaffId.trim() : '';
  const notes = typeof row.notes === 'string' ? row.notes : '';
  return Boolean(
    vehicleId
    || staffId
    || notes.includes('[transport_attendant:')
    || notes.includes('[transport_course:'),
  );
}

/**
 * Users saved on today's transport schedule still belong on the board when
 * their master record has no transport profile.
 */
const TRANSPORT_CALENDAR_TIME_ZONE = 'Asia/Tokyo';

export function jstCalendarDateKey(value: string | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: TRANSPORT_CALENDAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function filterScheduleRowsForJstDate<T extends { start?: unknown }>(
  rows: readonly T[],
  dateKey: string,
): T[] {
  return rows.filter((row) => (
    jstCalendarDateKey(typeof row.start === 'string' ? row.start : undefined) === dateKey
  ));
}

export function selectTransportLogsForDate(
  logs: readonly TransportLogEntry[],
  dateKey: string,
): TransportLogEntry[] {
  return logs.filter((log) => !log.recordDate || log.recordDate === dateKey);
}

export function applyTransportLogs(
  legs: readonly TransportLeg[],
  logs: readonly TransportLogEntry[],
  dateKey: string,
): TransportLeg[] {
  const logsForDate = selectTransportLogsForDate(logs, dateKey);
  return legs.map((leg) => {
    const log = logsForDate.find((entry) => entry.userId === leg.userId && entry.direction === leg.direction);
    if (!log) return leg;
    return {
      ...leg,
      status: log.status,
      actualTime: log.actualTime ?? leg.actualTime,
      driverName: log.driverName ?? leg.driverName,
      notes: log.notes ?? leg.notes,
    };
  });
}

export function transportLegHoldKey(userId: string, direction: TransportDirection): string {
  return `${direction}\u0000${userId}`;
}

function transportLegKey(leg: Pick<TransportLeg, 'userId' | 'direction'>): string {
  return transportLegHoldKey(leg.userId, leg.direction);
}

/** Milliseconds until the next Asia/Tokyo midnight. Stable under any host time zone. */
export function msUntilNextJstMidnight(now = new Date()): number {
  const key = jstCalendarDateKey(now.toISOString());
  if (!key) return 60_000;
  const firstBoundary = new Date(`${key}T15:00:00.000Z`).getTime();
  const firstDelta = firstBoundary - now.getTime();
  if (firstDelta > 0) return firstDelta;
  const [year, month, day] = key.split('-').map(Number);
  const nextBoundary = Date.UTC(year, month - 1, day + 1, 15, 0, 0, 0);
  const nextDelta = nextBoundary - now.getTime();
  return nextDelta > 0 ? nextDelta : 60_000;
}

/**
 * One leg per user and direction.
 * A held key keeps an in-flight optimistic status, or a commit newer than the snapshot.
 * Every other leg takes the derived Transport_Log status.
 * A date change passes preserveLocalStatus false and drops the previous day.
 */
export function composeEffectiveLegs(input: {
  previous: readonly TransportLeg[];
  derived: readonly TransportLeg[];
  preserveLocalStatus: boolean;
  heldKeys?: ReadonlySet<string>;
}): TransportLeg[] {
  if (!input.preserveLocalStatus) return [...input.derived];
  const held = input.heldKeys;
  if (!held || held.size === 0) return [...input.derived];
  const previousByKey = new Map(input.previous.map((leg) => [transportLegKey(leg), leg]));
  return input.derived.map((leg) => {
    const key = transportLegKey(leg);
    const local = previousByKey.get(key);
    if (!local || !held.has(key)) return leg;
    return {
      ...leg,
      status: local.status,
      actualTime: local.actualTime ?? leg.actualTime,
      notes: local.notes ?? leg.notes,
      driverName: local.driverName ?? leg.driverName,
    };
  });
}

/**
 * Restore a leg after a failed save only when that save is still the latest
 * operation for the same user, direction, and JST date.
 * Returns null when the board must be left unchanged.
 */
export function restoreLegAfterFailedSave(input: {
  current: readonly TransportLeg[];
  previous: TransportLeg;
  userId: string;
  direction: TransportDirection;
  startedDateKey: string;
  activeDateKey: string;
  boardDateKey: string;
  operationRevision: number;
  latestRevision: number;
}): TransportLeg[] | null {
  if (!isCurrentTransportDate(input.startedDateKey, input.activeDateKey)) return null;
  if (!isCurrentTransportDate(input.startedDateKey, input.boardDateKey)) return null;
  if (input.operationRevision !== input.latestRevision) return null;
  const index = input.current.findIndex(
    (leg) => leg.userId === input.userId && leg.direction === input.direction,
  );
  if (index < 0) return null;
  const next = [...input.current];
  next[index] = input.previous;
  return next;
}

export function transitionTransportLegs(
  legs: readonly TransportLeg[],
  userId: string,
  direction: TransportDirection,
  nextStatus: TransportLegStatus,
  now?: Date,
): { legs: TransportLeg[]; updated: TransportLeg; previous: TransportLeg } | null {
  const index = legs.findIndex((leg) => leg.userId === userId && leg.direction === direction);
  if (index < 0) return null;
  const previous = legs[index];
  const updated = applyTransition(previous, nextStatus, now);
  if (!updated) return null;
  const next = [...legs];
  next[index] = updated;
  return { legs: next, updated, previous };
}

export function isCurrentTransportDate(snapshotDateKey: string, activeDateKey: string): boolean {
  return snapshotDateKey === activeDateKey;
}

export type TransportFeedPhase = 'loading' | 'ready' | 'error';

/**
 * loading=false is a completed fetch only after that date's request was seen loading.
 * A stale false left over from the previous range stays loading.
 */
export function resolveScheduleFeedPhase(input: {
  sawLoadingForDate: boolean;
  loading: boolean;
  hasError: boolean;
}): TransportFeedPhase {
  if (input.loading || !input.sawLoadingForDate) return 'loading';
  return input.hasError ? 'error' : 'ready';
}

export function resolveTransportBoardPhase(input: {
  schedules: TransportFeedPhase;
  logs: TransportFeedPhase;
}): TransportFeedPhase {
  if (input.schedules === 'error' || input.logs === 'error') return 'error';
  if (input.schedules === 'ready' && input.logs === 'ready') return 'ready';
  return 'loading';
}

export function canOperateTransportBoard(input: {
  activeDateKey: string;
  boardDateKey: string;
  phase: TransportFeedPhase;
}): boolean {
  return input.phase === 'ready' && isCurrentTransportDate(input.activeDateKey, input.boardDateKey);
}

/** Run Transport_Log writes for one leg in request order. A failed earlier write does not block the next. */
export function enqueueTransportLogSave(input: {
  chains: Map<string, Promise<void>>;
  key: string;
  save: () => Promise<void>;
}): Promise<void> {
  const previous = input.chains.get(input.key);
  let run: Promise<void>;
  if (!previous) {
    try {
      run = Promise.resolve(input.save());
    } catch (error) {
      run = Promise.reject(error);
    }
  } else {
    run = previous.then(() => input.save(), () => input.save());
  }
  input.chains.set(input.key, run.then(() => undefined, () => undefined));
  return run;
}

export function buildLegsForScheduleAssignments(
  scheduleRows: readonly Record<string, unknown>[],
  existingLegs: readonly TransportLeg[],
  userNameById: ReadonlyMap<string, string>,
  dateKey?: string,
): TransportLeg[] {
  const present = new Set(existingLegs.map((leg) => transportLegKey(leg)));
  const extras: TransportLeg[] = [];

  for (const row of scheduleRows) {
    if (dateKey) {
      const rowDate = jstCalendarDateKey(typeof row.start === 'string' ? row.start : undefined);
      if (rowDate !== dateKey) continue;
    }
    if (!isTransportScheduleRow(row) || !hasSavedTransportAssignment(row)) continue;
    const userId = typeof row.userId === 'string' ? row.userId.trim() : '';
    if (!userId) continue;
    const rowName = typeof row.userName === 'string' ? row.userName.trim() : '';

    for (const direction of inferTransportDirections(row)) {
      const key = `${direction}\u0000${userId}`;
      if (present.has(key)) continue;
      present.add(key);
      extras.push({
        userId,
        userName: userNameById.get(userId) || rowName || userId,
        direction,
        method: 'office_shuttle',
        status: 'pending',
      });
    }
  }

  return extras;
}

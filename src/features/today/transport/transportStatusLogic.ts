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

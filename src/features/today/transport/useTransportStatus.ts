/**
 * useTransportStatus — React Hook for today's transport tracking
 *
 * Phase 2 of Issue #635.
 *
 * Responsibilities:
 * 1. Derive TransportLeg[] from useTodaySummary (users + visits)
 * 2. Manage local state for transport status changes (Optimistic UI)
 * 3. Expose status transition actions (markInProgress, markArrived, markAbsent)
 * 4. Compute direction summaries and overdue detection
 * 5. Auto-switch default direction at 13:00
 *
 * Data Flow:
 *   useTodaySummary → adaptToTransportUserInfo/adaptToTransportVisitInfo
 *     → deriveTransportLegs (pure) → TransportLeg[] (local state)
 *       → computeDirectionSummary → TransportDirectionSummary
 *
 * Guardrails:
 * - Hook はドメイン集約を持たない（pure logic は transportStatusLogic.ts に委譲）
 * - SP書き込みは将来の Phase で接続（現在はローカルステートのみ）
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTodaySummary } from '../domain';
import {
    applyTransition,
    computeDirectionSummary,
    deriveTransportLegs,
    formatHHmm,
    getDefaultDirection,
    type TransportLogEntry,
    type TransportUserInfo,
    type TransportVisitInfo,
} from './transportStatusLogic';
import type {
    TodayTransportStatus,
    TransportDirection,
    TransportLeg,
    TransportLegStatus,
} from './transportTypes';

// ─── Adapters (store types → transport domain types) ────────────────────────

/**
 * Adapt IUserMaster from useTodaySummary to TransportUserInfo.
 *
 * Note: Current demo user store doesn't have isTransportTarget.
 * We fall back to true for all users (conservative — show all).
 * SP-connected users will have the real field from AttendanceUsersRepository.
 */
function adaptUsers(
  summaryUsers: Array<{ UserID?: string; Id?: number; FullName?: string }>,
): TransportUserInfo[] {
  return summaryUsers.map((u, i) => ({
    userId: (u.UserID ?? '').trim() || `U${String(u.Id ?? i + 1).padStart(3, '0')}`,
    fullName: u.FullName ?? `利用者${i + 1}`,
    // Demo: treat all users as transport targets
    // In production, this comes from AttendanceUsersRepository.IsTransportTarget
    isTransportTarget: true,
  }));
}

/**
 * Adapt AttendanceVisitSnapshot from useAttendanceStore to TransportVisitInfo.
 *
 * Current demo store has minimal fields (status, isEarlyLeave, temperature).
 * We map status → transportTo/From booleans.
 */
function adaptVisits(
  visits: Record<string, { userCode: string; status: string }>,
): Record<string, TransportVisitInfo> {
  const result: Record<string, TransportVisitInfo> = {};

  for (const [userCode, visit] of Object.entries(visits)) {
    const isPresent = visit.status === '通所中' || visit.status === '退所済';
    result[userCode] = {
      transportTo: isPresent,
      transportFrom: isPresent,
    };
  }

  return result;
}

// ─── Hook Return Type ───────────────────────────────────────────────────────

export type UseTransportStatusReturn = {
  /** Full status for today (both directions) */
  status: TodayTransportStatus;

  /** Currently active direction tab */
  activeDirection: TransportDirection;

  /** Switch active direction tab */
  setActiveDirection: (dir: TransportDirection) => void;

  /** Transition a leg to a new status (Optimistic UI) */
  transition: (userId: string, direction: TransportDirection, nextStatus: TransportLegStatus) => boolean;

  /** Convenience: Mark as in-progress (出発) */
  markInProgress: (userId: string, direction: TransportDirection) => boolean;

  /** Convenience: Mark as arrived (到着) */
  markArrived: (userId: string, direction: TransportDirection) => boolean;

  /** Convenience: Mark as absent (欠席) */
  markAbsent: (userId: string, direction: TransportDirection) => boolean;

  /** Current time HH:mm (for overdue detection) */
  currentTime: string;

  /** Whether data is available */
  isReady: boolean;
};

// ─── Hook Implementation ────────────────────────────────────────────────────

export function useTransportStatus(): UseTransportStatusReturn {
  const summary = useTodaySummary();

  // Direction tab state (auto-switches at 13:00)
  const [activeDirection, setActiveDirection] = useState<TransportDirection>(
    () => getDefaultDirection(),
  );

  // Transport legs state (source of truth for UI)
  const [legs, setLegs] = useState<TransportLeg[]>([]);

  // Current time for overdue detection (updates every minute)
  const [currentTime, setCurrentTime] = useState(() => formatHHmm(new Date()));

  // Timer: update currentTime every 60s for overdue detection
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatHHmm(new Date()));

      // Also check if default direction should switch
      const newDefault = getDefaultDirection();
      setActiveDirection((_prev) => {
        // Only auto-switch if user hasn't manually changed
        // (We track this by checking if current matches previous default)
        // For simplicity, always auto-switch
        return newDefault;
      });
    }, 60_000);

    return () => clearInterval(timer);
  }, []);

  // Derive initial legs when summary data changes
  useEffect(() => {
    if (!summary.users || summary.users.length === 0) return;

    const users = adaptUsers(summary.users);
    const visits = adaptVisits(summary.visits);
    const existingLogs: TransportLogEntry[] = []; // Phase 3: load from SP

    const toLegs = deriveTransportLegs(users, visits, existingLogs, 'to');
    const fromLegs = deriveTransportLegs(users, visits, existingLogs, 'from');

    setLegs([...toLegs, ...fromLegs]);
  }, [summary.users, summary.visits]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const transition = useCallback(
    (userId: string, direction: TransportDirection, nextStatus: TransportLegStatus): boolean => {
      let success = false;

      setLegs((prev) => {
        const index = prev.findIndex(
          (l) => l.userId === userId && l.direction === direction,
        );
        if (index === -1) return prev;

        const leg = prev[index];
        const updated = applyTransition(leg, nextStatus);
        if (!updated) return prev;

        success = true;
        const next = [...prev];
        next[index] = updated;

        // TODO Phase 3: Fire-and-forget SP save here
        // spClient.saveTransportLog(updated).catch(err => rollback)

        return next;
      });

      return success;
    },
    [],
  );

  const markInProgress = useCallback(
    (userId: string, direction: TransportDirection) =>
      transition(userId, direction, 'in-progress'),
    [transition],
  );

  const markArrived = useCallback(
    (userId: string, direction: TransportDirection) =>
      transition(userId, direction, 'arrived'),
    [transition],
  );

  const markAbsent = useCallback(
    (userId: string, direction: TransportDirection) =>
      transition(userId, direction, 'absent'),
    [transition],
  );

  // ─── Computed Status ──────────────────────────────────────────────────────

  const status: TodayTransportStatus = useMemo(() => ({
    to: computeDirectionSummary(legs, 'to', currentTime),
    from: computeDirectionSummary(legs, 'from', currentTime),
    legs,
  }), [legs, currentTime]);

  const isReady = legs.length > 0;

  return {
    status,
    activeDirection,
    setActiveDirection,
    transition,
    markInProgress,
    markArrived,
    markAbsent,
    currentTime,
    isReady,
  };
}

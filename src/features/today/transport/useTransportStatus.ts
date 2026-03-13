/**
 * useTransportStatus — React Hook for today's transport tracking
 *
 * Phase 3 of Issue #635 — SharePoint Connected.
 *
 * Responsibilities:
 * 1. Derive TransportLeg[] from useTodaySummary (users + visits)
 * 2. Manage local state for transport status changes (Optimistic UI)
 * 3. Expose status transition actions (markInProgress, markArrived, markAbsent)
 * 4. Compute direction summaries and overdue detection
 * 5. Auto-switch default direction at 13:00
 * 6. Persist status changes to SharePoint Transport_Log (fire-and-forget)
 * 7. Load existing logs from SP on mount
 * 8. Filter by IsTransportTarget from AttendanceUsers
 *
 * Data Flow:
 *   useTodaySummary → adaptUsers/adaptVisits
 *     → deriveTransportLegs (pure) → TransportLeg[] (local state)
 *       → computeDirectionSummary → TransportDirectionSummary
 *   transition() → Optimistic UI update → saveTransportLog (async)
 *
 * Guardrails:
 * - Hook はドメイン集約を持たない（pure logic は transportStatusLogic.ts に委譲）
 * - SP 永続化は fire-and-forget + optimistic rollback
 * - SP リスト未作成の環境でもローカルで動作 (graceful degradation)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSP } from '@/lib/spClient';
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
import { loadTransportLogs, saveTransportLog } from './transportRepo';
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
  attendanceUsers?: Array<{ UserCode: string; IsTransportTarget?: boolean }>,
): TransportUserInfo[] {
  // Build a set of transport-target user codes from AttendanceUsers.
  // If attendanceUsers is not available (list not connected yet),
  // fall back to showing all users (conservative—show all).
  const transportTargetSet = new Set(
    (attendanceUsers ?? [])
      .filter((u) => u.IsTransportTarget === true)
      .map((u) => u.UserCode),
  );
  const hasFilter = transportTargetSet.size > 0;

  return summaryUsers
    .filter((u) => {
      if (!hasFilter) return true; // No filter data → show all
      const userCode = (u.UserID ?? '').trim();
      return transportTargetSet.has(userCode);
    })
    .map((u, i) => ({
      userId: (u.UserID ?? '').trim() || `U${String(u.Id ?? i + 1).padStart(3, '0')}`,
      fullName: u.FullName ?? `利用者${i + 1}`,
      isTransportTarget: !hasFilter || transportTargetSet.has((u.UserID ?? '').trim()),
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

/** Get today's date as yyyy-MM-dd in JST */
function getTodayKey(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function useTransportStatus(): UseTransportStatusReturn {
  const summary = useTodaySummary();
  const sp = useSP();

  // Direction tab state (auto-switches at 13:00)
  const [activeDirection, setActiveDirection] = useState<TransportDirection>(
    () => getDefaultDirection(),
  );

  // Track whether user has manually overridden the direction
  const userOverriddenRef = useRef(false);

  // Wrap setActiveDirection to detect manual changes
  const handleSetActiveDirection = useCallback((dir: TransportDirection) => {
    userOverriddenRef.current = true;
    setActiveDirection(dir);
  }, []);

  // Transport legs state (source of truth for UI)
  const [legs, setLegs] = useState<TransportLeg[]>([]);

  // SP client ref for use inside setLegs callback (avoids stale closure)
  const spRef = useRef(sp);
  useEffect(() => { spRef.current = sp; }, [sp]);

  // Current time for overdue detection (updates every minute)
  const [currentTime, setCurrentTime] = useState(() => formatHHmm(new Date()));

  // Timer: update currentTime every 60s for overdue detection
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatHHmm(new Date()));

      // Only auto-switch direction if user hasn't manually changed
      if (!userOverriddenRef.current) {
        const newDefault = getDefaultDirection();
        setActiveDirection(newDefault);
      }
    }, 60_000);

    return () => clearInterval(timer);
  }, []);

  // Derive initial legs when summary data changes (+ load from SP)
  useEffect(() => {
    if (!summary.users || summary.users.length === 0) return;

    let cancelled = false;
    const todayKey = getTodayKey();

    async function initLegs() {
      // Load existing logs from SharePoint (graceful: returns [] if list missing)
      let existingLogs: TransportLogEntry[] = [];
      try {
        existingLogs = await loadTransportLogs(sp, todayKey);
      } catch {
        // Graceful: SP unavailable → start with empty logs
        console.warn('[useTransportStatus] Failed to load SP logs, starting fresh');
      }

      if (cancelled) return;

      const users = adaptUsers(summary.users); // AttendanceUsers filtering: Phase 3.5
      const visits = adaptVisits(summary.visits);

      const toLegs = deriveTransportLegs(users, visits, existingLogs, 'to');
      const fromLegs = deriveTransportLegs(users, visits, existingLogs, 'from');

      setLegs([...toLegs, ...fromLegs]);
    }

    void initLegs();
    return () => { cancelled = true; };
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

        // Phase 3: Fire-and-forget SP save with optimistic rollback
        const todayKey = getTodayKey();
        saveTransportLog(spRef.current, {
          userCode: updated.userId,
          recordDate: todayKey,
          direction: updated.direction,
          status: updated.status,
          method: updated.method,
          actualTime: updated.actualTime,
          driverName: updated.driverName,
          notes: updated.notes,
        }).catch((err) => {
          console.error('[useTransportStatus] SP save failed, rolling back:', err);
          // Rollback: restore the previous leg state
          setLegs((current) => {
            const rollbackNext = [...current];
            const rollbackIndex = rollbackNext.findIndex(
              (l) => l.userId === userId && l.direction === direction,
            );
            if (rollbackIndex !== -1) {
              rollbackNext[rollbackIndex] = leg; // restore original
            }
            return rollbackNext;
          });
        });

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
    setActiveDirection: handleSetActiveDirection,
    transition,
    markInProgress,
    markArrived,
    markAbsent,
    currentTime,
    isReady,
  };
}

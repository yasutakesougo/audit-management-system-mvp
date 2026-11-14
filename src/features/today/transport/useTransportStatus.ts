/**
 * useTransportStatus — React Hook for today's transport tracking
 *
 * Phase 3.5 of Issue #635 — IsTransportTarget filtering + syncToAttendanceDaily.
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
 * 9. Report rollback / non-blocking sync failures with unified user feedback
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
import { useToast } from '@/hooks/useToast';
import { useSchedules } from '@/features/schedules/hooks/legacy/useSchedules';
import { useStaffStore } from '@/features/staff/store';
import { resolveOperationFailureFeedback } from '../feedback/operationFeedback';
import { useTodaySummary } from '../domain';
import {
    applyTransportLogs,
    buildLegsForScheduleAssignments,
    composeEffectiveLegs,
    computeDirectionSummary,
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
    type TransportFeedPhase,
    formatHHmm,
    getDefaultDirection,
    hasTransportInfo,
    type TransportLogEntry,
    type TransportUserInfo,
    type TransportVisitInfo,
} from './transportStatusLogic';
import { loadTransportLogs, saveTransportLog, syncToAttendanceDaily } from './transportRepo';
import { getActiveUsers, type AttendanceUserItem } from '@/features/attendance/infra/Legacy/attendanceUsersRepository';
import {
    getTransportStaleDedupKey,
    trackTransportEvent,
} from './transportTelemetry';
import {
  buildTransportAssignmentIndex,
  enrichTransportLegsWithAssignments,
} from './transportAssignments';
import type { IUserMaster } from '@/features/users/types';
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
 * Enforces strict filtering:
 * 1. If AttendanceUsers (IsTransportTarget) data exists, use it.
 * 2. Fallback to checking User Master (UserTransportSettings) fields.
 */
function adaptUsers(
  summaryUsers: IUserMaster[],
  attendanceUsers?: Array<{ UserCode: string; IsTransportTarget?: boolean }>,
): TransportUserInfo[] {
  // Build a set of transport-target user codes from AttendanceUsers.
  const transportTargetSet = new Set(
    (attendanceUsers ?? [])
      .filter((u) => u.IsTransportTarget === true)
      .map((u) => u.UserCode),
  );
  const hasAttendanceFilter = transportTargetSet.size > 0;

  return summaryUsers
    .filter((u) => {
      const userCode = (u.UserID ?? '').trim();

      // If we have explicit flag from AttendanceUsers, prioritize it
      if (hasAttendanceFilter && transportTargetSet.has(userCode)) return true;

      // Fallback/Secondary check: Check if transport info is actually set in User Master
      return hasTransportInfo(u);
    })
    .map((u, i) => ({
      userId: (u.UserID ?? '').trim() || `U${String(u.Id ?? i + 1).padStart(3, '0')}`,
      fullName: u.FullName ?? `利用者${i + 1}`,
      isTransportTarget: true, // Already filtered above
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

  /** Whether the active date has legs and both feeds have succeeded */
  isReady: boolean;

  /** loading, failed closed, or operable */
  boardPhase: TransportFeedPhase;

  /** Manual refresh for kiosk/background sync */
  refresh: () => Promise<void>;
};

// ─── Hook Implementation ────────────────────────────────────────────────────

/** Get today's date as yyyy-MM-dd in JST */
function getTodayKey(now = new Date()): string {
  return jstCalendarDateKey(now.toISOString()) ?? '';
}

function getTodayScheduleRange(today = getTodayKey()): { from: string; to: string } {
  return {
    from: `${today}T00:00:00+09:00`,
    to: `${today}T23:59:59+09:00`,
  };
}

const EMPTY_LEGS: TransportLeg[] = [];

type RevisionMark = { dateKey: string; revision: number };

function normalizeLookupKey(value: string): string {
  return value.trim().replace(/[-_\s]/g, '').toUpperCase();
}

function toTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildStaffNameIndex(rows: unknown): Map<string, string> {
  const index = new Map<string, string>();
  if (!Array.isArray(rows)) return index;

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const item = row as { id?: unknown; staffId?: unknown; name?: unknown };

    const name = toTrimmedString(item.name);
    if (!name) continue;

    if (typeof item.id === 'string' || typeof item.id === 'number') {
      const id = String(item.id);
      index.set(id, name);
      index.set(normalizeLookupKey(id), name);
    }

    const staffId = toTrimmedString(item.staffId);
    if (staffId) {
      index.set(staffId, name);
      index.set(normalizeLookupKey(staffId), name);
    }
  }

  return index;
}

export function useTransportStatus(): UseTransportStatusReturn {
  const summary = useTodaySummary();
  const sp = useSP();
  const { show } = useToast();
  const [todayKey, setTodayKey] = useState(getTodayKey);
  const todayKeyRef = useRef(todayKey);
  todayKeyRef.current = todayKey;
  const legsDateRef = useRef(todayKey);
  const discardPreviousLegsRef = useRef(false);
  const holdsRef = useRef(new Map<string, RevisionMark>());
  const commitsRef = useRef(new Map<string, RevisionMark>());
  const revisionRef = useRef(0);
  const snapshotSeqRef = useRef(0);
  const appliedSnapshotSeqRef = useRef(0);
  const saveChainsRef = useRef(new Map<string, Promise<void>>());
  const scheduleWatchRef = useRef({ dateKey: todayKey, sawLoading: false });
  const todayScheduleRange = useMemo(() => getTodayScheduleRange(todayKey), [todayKey]);
  const {
    items: todaySchedules,
    loading: schedulesLoading,
    lastError: schedulesError,
  } = useSchedules(todayScheduleRange);
  if (scheduleWatchRef.current.dateKey !== todayKey) {
    scheduleWatchRef.current = { dateKey: todayKey, sawLoading: schedulesLoading };
  } else if (schedulesLoading) {
    scheduleWatchRef.current.sawLoading = true;
  }
  const schedulesPhase = resolveScheduleFeedPhase({
    sawLoadingForDate: scheduleWatchRef.current.dateKey === todayKey && scheduleWatchRef.current.sawLoading,
    loading: schedulesLoading,
    hasError: schedulesError != null,
  });
  const [logsPhase, setLogsPhase] = useState<TransportFeedPhase>('loading');
  const logsDateRef = useRef(todayKey);
  if (logsDateRef.current !== todayKey) {
    logsDateRef.current = todayKey;
    setLogsPhase('loading');
  }
  const boardPhase = !isCurrentTransportDate(todayKey, getTodayKey())
    ? 'loading'
    : resolveTransportBoardPhase({ schedules: schedulesPhase, logs: logsPhase });
  const boardPhaseRef = useRef(boardPhase);
  boardPhaseRef.current = boardPhase;
  const { data: staffRows } = useStaffStore();

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

  // Stale-in-progress dedup: prevents duplicate events for the same leg
  const staleNotifiedRef = useRef<Set<string>>(new Set());

  // Current time for overdue detection (updates every minute)
  const [currentTime, setCurrentTime] = useState(() => formatHHmm(new Date()));

  // Staff + schedule assignment enrichment (vehicle/driver visibility)
  const staffNameIndex = useMemo(() => buildStaffNameIndex(staffRows), [staffRows]);
  const todayScheduleRows = useMemo(
    () => filterScheduleRowsForJstDate(
      (todaySchedules ?? []) as unknown as Array<Record<string, unknown> & { start?: unknown }>,
      todayKey,
    ),
    [todaySchedules, todayKey],
  );
  const assignmentIndex = useMemo(
    () =>
      buildTransportAssignmentIndex(
        todayScheduleRows,
        (staffId) => staffNameIndex.get(staffId) ?? staffNameIndex.get(normalizeLookupKey(staffId)),
      ),
    [todayScheduleRows, staffNameIndex],
  );
  const userNameById = useMemo(() => {
    const names = new Map<string, string>();
    for (const user of summary.users ?? []) {
      const userId = user.UserID?.trim();
      const fullName = user.FullName?.trim();
      if (userId && fullName) names.set(userId, fullName);
    }
    return names;
  }, [summary.users]);
  const enrichedLegs = useMemo(
    () => enrichTransportLegsWithAssignments(legs, assignmentIndex),
    [legs, assignmentIndex],
  );

  const notifyOperationFailure = useCallback(
    (kind: 'transport:rollback' | 'transport:sync-non-blocking', userName?: string) => {
      const feedback = resolveOperationFailureFeedback(kind, { userName });
      show(feedback.toastSeverity, feedback.toastMessage);
    },
    [show],
  );

  const buildLegSnapshot = useCallback(async (dateKey: string) => {
    const startedRevision = revisionRef.current;
    const seq = ++snapshotSeqRef.current;
    let fallbackActivated = false;
    let logsOk = true;

    const [existingLogs, attendanceUsers] = await Promise.all([
      loadTransportLogs(sp, dateKey).catch((err) => {
        console.warn('[useTransportStatus] Failed to load Transport_Log', err);
        logsOk = false;
        return [] as TransportLogEntry[];
      }),
      getActiveUsers(sp, undefined, dateKey).catch((err) => {
        console.warn('[useTransportStatus] Failed to load AttendanceUsers, showing all users', err);
        fallbackActivated = true;
        return [] as AttendanceUserItem[];
      }),
    ]);

    const logsForDate = selectTransportLogsForDate(existingLogs, dateKey);
    const users = summary.users?.length
      ? adaptUsers(summary.users, attendanceUsers)
      : [];
    const visits = adaptVisits(summary.visits);
    const masterLegs = [
      ...deriveTransportLegs(users, visits, logsForDate, 'to'),
      ...deriveTransportLegs(users, visits, logsForDate, 'from'),
    ];
    const scheduleLegs = applyTransportLogs(
      buildLegsForScheduleAssignments(todayScheduleRows, masterLegs, userNameById, dateKey),
      logsForDate,
      dateKey,
    );

    return {
      dateKey,
      seq,
      startedRevision,
      logsOk,
      fallbackActivated,
      usersCount: users.length,
      legs: [...masterLegs, ...scheduleLegs],
    };
  }, [summary.users, summary.visits, sp, todayScheduleRows, userNameById]);

  const heldKeysForSnapshot = useCallback((dateKey: string, startedRevision: number) => {
    const held = new Set<string>();
    for (const [key, hold] of holdsRef.current) {
      if (hold.dateKey === dateKey) held.add(key);
    }
    for (const [key, mark] of commitsRef.current) {
      if (mark.dateKey === dateKey && startedRevision < mark.revision) held.add(key);
    }
    return held;
  }, []);

  const publishLegSnapshot = useCallback((snapshot: {
    dateKey: string;
    seq: number;
    startedRevision: number;
    logsOk: boolean;
    fallbackActivated: boolean;
    usersCount: number;
    legs: TransportLeg[];
  }) => {
    if (!isCurrentTransportDate(snapshot.dateKey, todayKeyRef.current)) return;
    if (snapshot.seq < appliedSnapshotSeqRef.current) return;
    appliedSnapshotSeqRef.current = snapshot.seq;
    if (!snapshot.logsOk) {
      setLogsPhase('error');
      return;
    }
    setLogsPhase('ready');
    const preserveLocalStatus = !discardPreviousLegsRef.current && legsDateRef.current === snapshot.dateKey;
    discardPreviousLegsRef.current = false;
    legsDateRef.current = snapshot.dateKey;
    const heldKeys = preserveLocalStatus
      ? heldKeysForSnapshot(snapshot.dateKey, snapshot.startedRevision)
      : undefined;
    setLegs((current) => composeEffectiveLegs({
      previous: preserveLocalStatus ? current : [],
      derived: snapshot.legs,
      preserveLocalStatus,
      heldKeys,
    }));

    if (snapshot.fallbackActivated) {
      trackTransportEvent({
        type: 'transport:fallback-all-users',
        eventVersion: 1,
        source: 'useTransportStatus',
        reason: 'fetch-error',
        totalUsersShown: snapshot.usersCount,
        clientTs: new Date().toISOString(),
      });
    }
  }, [heldKeysForSnapshot]);

  const adoptJstDate = useCallback((nextKey: string): boolean => {
    const stateMatches = isCurrentTransportDate(nextKey, todayKeyRef.current);
    const legsMatch = isCurrentTransportDate(nextKey, legsDateRef.current);
    if (stateMatches && legsMatch) return false;
    discardPreviousLegsRef.current = true;
    legsDateRef.current = nextKey;
    todayKeyRef.current = nextKey;
    setTodayKey((current) => (current === nextKey ? current : nextKey));
    setLegs(EMPTY_LEGS);
    return true;
  }, []);

  const refresh = useCallback(async () => {
    const dateKey = todayKeyRef.current;
    const snapshot = await buildLegSnapshot(dateKey);
    if (!isCurrentTransportDate(snapshot.dateKey, todayKeyRef.current)) return;
    publishLegSnapshot(snapshot);
  }, [buildLegSnapshot, publishLegSnapshot]);

  // Align the board at the next JST midnight. The 60s clock below is only a backup.
  useEffect(() => {
    let timeoutId = 0;
    const arm = () => {
      timeoutId = window.setTimeout(() => {
        adoptJstDate(getTodayKey());
        arm();
      }, msUntilNextJstMidnight());
    };
    arm();
    return () => window.clearTimeout(timeoutId);
  }, [adoptJstDate]);

  // Timer: update currentTime every 60s for overdue detection
  useEffect(() => {
    const timer = setInterval(() => {
      adoptJstDate(getTodayKey());
      setCurrentTime(formatHHmm(new Date()));

      // Only auto-switch direction if user hasn't manually changed
      if (!userOverriddenRef.current) {
        const newDefault = getDefaultDirection();
        setActiveDirection(newDefault);
      }

      // ── Stale-in-progress detection ──
      const todayKey = getTodayKey();
      setLegs((currentLegs) => {
        if (discardPreviousLegsRef.current || !isCurrentTransportDate(legsDateRef.current, todayKey)) {
          return currentLegs.length === 0 ? currentLegs : EMPTY_LEGS;
        }
        for (const leg of currentLegs) {
          if (leg.status !== 'in-progress' || !leg.actualTime) continue;

          // Parse actualTime (HH:mm) to compute elapsed minutes
          const [h, m] = leg.actualTime.split(':').map(Number);
          if (h == null || m == null || isNaN(h) || isNaN(m)) continue;

          const now = new Date();
          const startMinutes = h * 60 + m;
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          const elapsed = nowMinutes - startMinutes;

          if (elapsed >= 30) {
            const dedupKey = getTransportStaleDedupKey(
              leg.userId, todayKey, leg.direction, elapsed,
            );
            if (!staleNotifiedRef.current.has(dedupKey)) {
              staleNotifiedRef.current.add(dedupKey);
              trackTransportEvent({
                type: 'transport:stale-in-progress',
                eventVersion: 1,
                source: 'transportTimer',
                userCode: leg.userId,
                direction: leg.direction,
                minutesElapsed: elapsed,
                clientTs: now.toISOString(),
              });
            }
          }
        }
        return currentLegs; // no mutation — read-only scan
      });
    }, 60_000);

    return () => clearInterval(timer);
  }, [adoptJstDate]);

  // One effective leg list for the active JST date, including schedule-only riders.
  useEffect(() => {
    let cancelled = false;
    const dateKey = todayKey;
    if (legsDateRef.current !== dateKey) {
      discardPreviousLegsRef.current = true;
      legsDateRef.current = dateKey;
      setLegs([]);
    }

    async function initLegs() {
      const snapshot = await buildLegSnapshot(dateKey);
      if (cancelled || !isCurrentTransportDate(snapshot.dateKey, todayKeyRef.current)) return;
      publishLegSnapshot(snapshot);
    }

    void initLegs();
    return () => { cancelled = true; };
  }, [todayKey, summary.users, buildLegSnapshot, publishLegSnapshot]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const transition = useCallback(
    (userId: string, direction: TransportDirection, nextStatus: TransportLegStatus): boolean => {
      const activeDate = getTodayKey();
      if (adoptJstDate(activeDate) || discardPreviousLegsRef.current) return false;
      if (!canOperateTransportBoard({
        activeDateKey: activeDate,
        boardDateKey: todayKeyRef.current,
        phase: boardPhaseRef.current,
      })) return false;

      let success = false;

      setLegs((prev) => {
        if (!isCurrentTransportDate(getTodayKey(), activeDate)) return prev;
        if (!isCurrentTransportDate(legsDateRef.current, activeDate)) return prev;
        if (discardPreviousLegsRef.current) return prev;
        if (!canOperateTransportBoard({
          activeDateKey: getTodayKey(),
          boardDateKey: todayKeyRef.current,
          phase: boardPhaseRef.current,
        })) return prev;

        const result = transitionTransportLegs(prev, userId, direction, nextStatus);
        if (!result) return prev;

        success = true;
        const { legs: next, updated, previous: leg } = result;
        const key = transportLegHoldKey(userId, direction);
        const revision = ++revisionRef.current;
        holdsRef.current.set(key, { dateKey: activeDate, revision });

        // Telemetry: record status transition
        trackTransportEvent({
          type: 'transport:status-transition',
          eventVersion: 1,
          source: 'useTransportStatus',
          userCode: updated.userId,
          direction: updated.direction,
          fromStatus: leg.status,
          toStatus: updated.status,
          clientTs: new Date().toISOString(),
        });

        // Phase 3: Fire-and-forget SP save with optimistic rollback.
        // Same leg writes wait their turn so arrival cannot land before departure.
        enqueueTransportLogSave({
          chains: saveChainsRef.current,
          key: `${activeDate}\0${key}`,
          save: () => saveTransportLog(spRef.current, {
            userCode: updated.userId,
            recordDate: activeDate,
            direction: updated.direction,
            status: updated.status,
            method: updated.method,
            actualTime: updated.actualTime,
            driverName: updated.driverName,
            notes: updated.notes,
          }),
        }).then(() => {
          const hold = holdsRef.current.get(key);
          if (hold && hold.revision === revision && hold.dateKey === activeDate) {
            holdsRef.current.delete(key);
            commitsRef.current.set(key, { dateKey: activeDate, revision });
          }
          // Phase 3.5: Sync to AttendanceDaily when arrived
          // Fire-and-forget — sync failures should not affect transport log
          if (updated.status === 'arrived') {
            syncToAttendanceDaily(spRef.current, {
              userCode: updated.userId,
              recordDate: activeDate,
              direction: updated.direction,
              status: updated.status,
              method: updated.method,
            }).catch((syncErr) => {
              console.warn('[useTransportStatus] AttendanceDaily sync failed (non-blocking):', syncErr);
              notifyOperationFailure('transport:sync-non-blocking', updated.userName);
              // Telemetry: record sync failure
              trackTransportEvent({
                type: 'transport:sync-failed',
                eventVersion: 1,
                source: 'useTransportStatus',
                userCode: updated.userId,
                recordDate: activeDate,
                direction: updated.direction,
                errorMessage: syncErr instanceof Error ? syncErr.message : String(syncErr),
                errorStatus: (syncErr as { status?: number })?.status,
                clientTs: new Date().toISOString(),
              });
            });
          }
        }).catch((err) => {
          console.error('[useTransportStatus] SP save failed, rolling back:', err);
          notifyOperationFailure('transport:rollback', leg.userName);
          setLegs((current) => {
            const hold = holdsRef.current.get(key);
            const latestRevision = hold && hold.dateKey === activeDate ? hold.revision : -1;
            const restored = restoreLegAfterFailedSave({
              current,
              previous: leg,
              userId,
              direction,
              startedDateKey: activeDate,
              activeDateKey: getTodayKey(),
              boardDateKey: todayKeyRef.current,
              operationRevision: revision,
              latestRevision,
            });
            if (!restored) return current;
            if (hold && hold.revision === revision) holdsRef.current.delete(key);
            const mark = commitsRef.current.get(key);
            if (mark && mark.revision === revision && mark.dateKey === activeDate) {
              commitsRef.current.delete(key);
            }
            return restored;
          });
        });

        return next;
      });

      return success;
    },
    [adoptJstDate, notifyOperationFailure],
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

  const wallClockDate = getTodayKey();
  const legsForActiveDate = isCurrentTransportDate(todayKey, wallClockDate) ? enrichedLegs : EMPTY_LEGS;

  const status: TodayTransportStatus = useMemo(() => ({
    to: computeDirectionSummary(legsForActiveDate, 'to', currentTime),
    from: computeDirectionSummary(legsForActiveDate, 'from', currentTime),
    legs: legsForActiveDate,
  }), [legsForActiveDate, currentTime]);

  const isReady = boardPhase === 'ready' && legsForActiveDate.length > 0;

  return useMemo(
    () => ({
      status,
      activeDirection,
      setActiveDirection: handleSetActiveDirection,
      transition,
      markInProgress,
      markArrived,
      markAbsent,
      currentTime,
      isReady,
      boardPhase,
      refresh,
    }),
    [
      status,
      activeDirection,
      handleSetActiveDirection,
      transition,
      markInProgress,
      markArrived,
      markAbsent,
      currentTime,
      isReady,
      boardPhase,
      refresh,
    ],
  );
}

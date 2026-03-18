// contract:allow-sp-direct
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { upsertObservation } from '@/features/nurse';
import { makeSharePointListApi } from '@/features/nurse/sp/client';
import { useSP } from '@/lib/spClient';
import { NURSE_LISTS } from '@/features/nurse/sp/constants';
import type { ObservationListItem } from '@/features/nurse/sp/map';
import type { AbsentSupportLog } from '@/features/service-provision/domain/absentSupportLog';

import { buildServiceEndTimestamp, getAutoCheckOutTargets, isBeforeCloseTime, SERVICE_END_TIME } from './attendance.logic';
import {
    buildSavedTemps,
    errorMessage,
    getNextStatusRow,
    mergeRows,
    NOTIFICATION_CLOSED,
    statusLabel,
    toDailyItem,
    todayIso,
    type AttendanceNotification,
} from './attendanceMappers';
import { classifyAttendanceError } from './hooks/useAttendanceActions';
import { useAttendanceRepository } from './repositoryFactory';
import type { AttendanceFilter, AttendanceHookStatus, AttendanceInputMode, AttendanceRowVM } from './types';

export { buildSavedTemps, type AttendanceNotification } from './attendanceMappers';

export type UseAttendanceReturn = {
  status: AttendanceHookStatus;
  rows: AttendanceRowVM[];
  filters: AttendanceFilter;
  inputMode: AttendanceInputMode;
  savingUsers: ReadonlySet<string>;
  savedTempsByUser: Record<string, number>;
  notification: AttendanceNotification;
  dismissNotification: () => void;
  actions: {
    setFilters: (next: Partial<AttendanceFilter>) => void;
    setInputMode: (mode: AttendanceInputMode) => void;
    updateStatus: (userCode: string, status: AttendanceRowVM['status']) => Promise<void>;
    updateStatusWithAbsentSupport: (userCode: string, log: AbsentSupportLog) => Promise<void>;
    updateRowFields: (userCode: string, fields: Partial<AttendanceRowVM>) => Promise<void>;
    saveTemperature: (userCode: string, temperature: number, onHighTempAction?: () => void) => Promise<void>;
    refresh: () => Promise<void>;
  };
};

export function useAttendance(): UseAttendanceReturn {
  const repository = useAttendanceRepository();
  const { spFetch } = useSP();
  const [status, setStatus] = useState<AttendanceHookStatus>('loading');
  const [rowsRaw, setRowsRaw] = useState<AttendanceRowVM[]>([]);
  const [filters, setFiltersState] = useState<AttendanceFilter>({ date: todayIso(), query: '' });

  // ── Per-user double-submit guard ──
  const savingUsersRef = useRef<Set<string>>(new Set());
  const [, setSavingTick] = useState(0);
  const bumpSavingTick = useCallback(() => setSavingTick((t) => t + 1), []);

  // ── Input mode state ──
  const [inputMode, setInputMode] = useState<AttendanceInputMode>('checkInRun');

  // ── Saved temperatures from Observation list ──
  const [savedTempsByUser, setSavedTempsByUser] = useState<Record<string, number>>({});

  // ── Notification state ──
  const [notification, setNotification] = useState<AttendanceNotification>(NOTIFICATION_CLOSED);
  const dismissNotification = useCallback(() => setNotification(NOTIFICATION_CLOSED), []);

  // ── Auto-checkout guard (tracks which date has been auto-checked-out) ──
  const autoCheckOutDoneRef = useRef<string>('');

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const [users, dailyItems] = await Promise.all([
        repository.getActiveUsers(),
        repository.getDailyByDate({ recordDate: filters.date }),
      ]);
      const merged = mergeRows(users, dailyItems, filters.date);
      setRowsRaw(merged);
      setStatus('success');

      // Load saved temperatures (non-blocking, failures are silent)
      try {
        const observations = await repository.getObservationsByDate(filters.date);
        const lookupMap = new Map<number, string>();
        for (const u of users) {
          if (u.Id != null) lookupMap.set(u.Id, u.UserCode);
        }
        setSavedTempsByUser(buildSavedTemps(observations, lookupMap));
      } catch (e) {
        console.error('useAttendance: temperature load failed (non-fatal)', e);
      }

      // ── Auto-checkout: 16:00 過ぎに「通所中」→「退所済」を一括処理 ──
      const today = todayIso();
      if (filters.date === today && autoCheckOutDoneRef.current !== today) {
        const targets = getAutoCheckOutTargets(merged, new Date());
        if (targets.length > 0) {
          autoCheckOutDoneRef.current = today;
          const checkOutIso = buildServiceEndTimestamp(today);
          const checkedOutRows = merged.map((row) =>
            targets.includes(row.userCode)
              ? getNextStatusRow(row, '退所済', checkOutIso)
              : row,
          );
          setRowsRaw(checkedOutRows);

          try {
            await Promise.all(
              checkedOutRows
                .filter((r) => targets.includes(r.userCode))
                .map((r) => repository.upsertDailyByKey(toDailyItem(r, filters.date))),
            );
            const names = checkedOutRows
              .filter((r) => targets.includes(r.userCode))
              .map((r) => r.FullName ?? r.userCode)
              .join('、');
            setNotification({
              open: true,
              severity: 'info',
              message: `${targets.length}名を自動退所しました（${names}）`,
            });
          } catch (error) {
            console.error('useAttendance: autoCheckOut persist failed', error);
            autoCheckOutDoneRef.current = ''; // allow retry on next refresh
          }
        } else if (!isBeforeCloseTime(new Date(), SERVICE_END_TIME)) {
          // Past service end but no targets → mark as done
          autoCheckOutDoneRef.current = today;
        }
      }
    } catch (error) {
      console.error('useAttendance.refresh failed', error);
      setStatus('error');
    }
  }, [filters.date, repository]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ── Timer: 16:00 到達時に refresh を発火して自動退所をトリガー ──
  useEffect(() => {
    const today = todayIso();
    if (filters.date !== today) return;
    if (autoCheckOutDoneRef.current === today) return;

    const now = new Date();
    if (!isBeforeCloseTime(now, SERVICE_END_TIME)) return; // already past

    const [hh, mm] = SERVICE_END_TIME.split(':').map((v) => parseInt(v, 10));
    const target = new Date(now.getTime());
    target.setHours(hh, mm, 0, 0);
    const delay = target.getTime() - now.getTime() + 2000; // +2s buffer

    const timer = setTimeout(() => {
      void refresh();
    }, delay);
    return () => clearTimeout(timer);
  }, [filters.date, refresh]);

  // Ref to always call the latest updateStatus from undo callbacks
  const updateStatusRef = useRef<(userCode: string, status: AttendanceRowVM['status']) => Promise<void>>();

  const updateStatus = useCallback(
    async (userCode: string, nextStatus: AttendanceRowVM['status']) => {
      // Per-user in-flight guard: skip if already saving for this user
      if (savingUsersRef.current.has(userCode)) return;

      const current = rowsRaw.find((row) => row.userCode === userCode);
      if (!current) return;

      const prevStatus = current.status;

      savingUsersRef.current.add(userCode);
      bumpSavingTick();

      const nowIso = new Date().toISOString();
      const nextRow = getNextStatusRow(current, nextStatus, nowIso);
      const userName = current.FullName ?? userCode;

      setRowsRaw((prev) => prev.map((row) => (row.userCode === userCode ? nextRow : row)));

      try {
        await repository.upsertDailyByKey(toDailyItem(nextRow, filters.date));

        // Absence gets an undo action (5s window); others get simple success
        const label = statusLabel(nextStatus);
        if (nextStatus === '当日欠席') {
          setNotification({
            open: true,
            severity: 'success',
            message: `${userName}さんを${label}にしました`,
            actionLabel: '取り消し',
            onAction: () => {
              void updateStatusRef.current?.(userCode, prevStatus);
            },
          });
        } else {
          setNotification({
            open: true,
            severity: 'success',
            message: `${userName}さんを${label}にしました`,
          });
        }
      } catch (error) {
        console.error('useAttendance.updateStatus failed', error);
        const classified = classifyAttendanceError(error);
        const { severity, message } = errorMessage(classified.code);

        // Rollback to server state
        try {
          await refresh();
        } catch {
          // refresh failure is separate — don't overwrite save error
        }

        setNotification({
          open: true,
          severity,
          message,
          actionLabel: '再読込',
          onAction: () => {
            void refresh();
          },
        });
      } finally {
        savingUsersRef.current.delete(userCode);
        bumpSavingTick();
      }
    },
    [bumpSavingTick, filters.date, refresh, repository, rowsRaw],
  );

  // Keep ref in sync for undo callbacks
  updateStatusRef.current = updateStatus;

  // ── Absence with AbsentSupportLog ──
  const updateStatusWithAbsentSupport = useCallback(
    async (userCode: string, log: AbsentSupportLog) => {
      if (savingUsersRef.current.has(userCode)) return;

      const current = rowsRaw.find((row) => row.userCode === userCode);
      if (!current) return;

      savingUsersRef.current.add(userCode);
      bumpSavingTick();

      const nowIso = new Date().toISOString();
      const hasFollowUp = Boolean(log.followUpDateTime || log.followUpContent);
      const nextRow: AttendanceRowVM = {
        ...getNextStatusRow(current, '当日欠席', nowIso),
        absentSupport: log,
        absentMorningContacted: true,
        eveningChecked: hasFollowUp,
      };
      const userName = current.FullName ?? userCode;

      setRowsRaw((prev) => prev.map((row) => (row.userCode === userCode ? nextRow : row)));

      try {
        await repository.upsertDailyByKey(toDailyItem(nextRow, filters.date));
        setNotification({
          open: true,
          severity: 'success',
          message: `${userName}さんを欠席にしました（詳細記録済）`,
          actionLabel: '取り消し',
          onAction: () => {
            void updateStatusRef.current?.(userCode, current.status);
          },
        });
      } catch (error) {
        console.error('useAttendance.updateStatusWithAbsentSupport failed', error);
        const classified = classifyAttendanceError(error);
        const { severity, message } = errorMessage(classified.code);
        try { await refresh(); } catch { /* refresh failure is separate */ }
        setNotification({
          open: true,
          severity,
          message,
          actionLabel: '再読込',
          onAction: () => { void refresh(); },
        });
      } finally {
        savingUsersRef.current.delete(userCode);
        bumpSavingTick();
      }
    },
    [bumpSavingTick, filters.date, refresh, repository, rowsRaw],
  );

  // ── Partial row field update (transport, userConfirm, etc.) ──
  const updateRowFields = useCallback(
    async (userCode: string, fields: Partial<AttendanceRowVM>) => {
      if (savingUsersRef.current.has(userCode)) return;

      const current = rowsRaw.find((row) => row.userCode === userCode);
      if (!current) return;

      savingUsersRef.current.add(userCode);
      bumpSavingTick();

      const nextRow: AttendanceRowVM = { ...current, ...fields };
      const userName = current.FullName ?? userCode;

      setRowsRaw((prev) => prev.map((row) => (row.userCode === userCode ? nextRow : row)));

      try {
        await repository.upsertDailyByKey(toDailyItem(nextRow, filters.date));
        setNotification({
          open: true,
          severity: 'success',
          message: `${userName}さんの情報を更新しました`,
        });
      } catch (error) {
        console.error('useAttendance.updateRowFields failed', error);
        const classified = classifyAttendanceError(error);
        const { severity, message } = errorMessage(classified.code);
        try { await refresh(); } catch { /* refresh failure is separate */ }
        setNotification({
          open: true,
          severity,
          message,
          actionLabel: '再読込',
          onAction: () => { void refresh(); },
        });
      } finally {
        savingUsersRef.current.delete(userCode);
        bumpSavingTick();
      }
    },
    [bumpSavingTick, filters.date, refresh, repository, rowsRaw],
  );

  const setFilters = useCallback((next: Partial<AttendanceFilter>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
  }, []);

  // ── Temperature save via upsertObservation (B-route) ──
  const saveTemperature = useCallback(
    async (userCode: string, temperature: number, onHighTempAction?: () => void) => {
      if (savingUsersRef.current.has(userCode)) return;

      const row = rowsRaw.find((r) => r.userCode === userCode);
      if (!row) return;

      const userName = row.FullName ?? userCode;
      const lookupId = row.Id;
      if (lookupId == null || lookupId < 0) {
        setNotification({
          open: true,
          severity: 'error',
          message: `${userName}さんのユーザーIDが不明です。`,
        });
        return;
      }

      savingUsersRef.current.add(userCode);
      bumpSavingTick();

      try {
        const nowIso = new Date().toISOString();
        const idempotencyKey = `att-temp-${userCode}-${filters.date}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const payload: ObservationListItem = {
          UserLookupId: lookupId,
          ObservedAt: nowIso,
          Temperature: temperature,
          IdempotencyKey: idempotencyKey,
          Source: 'attendance',
        };

        const api = makeSharePointListApi(spFetch);
        await upsertObservation(api, NURSE_LISTS.observation, payload);

        // C1.7: high-temp (≥37.5) fires warning + '看護記録へ' action
        if (temperature >= 37.5 && onHighTempAction) {
          setNotification({
            open: true,
            severity: 'warning',
            message: `${userName}さんが高体温です（${temperature.toFixed(1)}℃）`,
            actionLabel: '看護記録へ',
            onAction: () => {
              dismissNotification();
              onHighTempAction();
            },
          });
        } else {
          setNotification({
            open: true,
            severity: 'success',
            message: `${userName}さん ${temperature}℃ を記録しました`,
          });
        }
      } catch (error) {
        console.error('useAttendance.saveTemperature failed', error);
        const classified = classifyAttendanceError(error);
        const { severity, message } = errorMessage(classified.code);
        setNotification({ open: true, severity, message });
      } finally {
        savingUsersRef.current.delete(userCode);
        bumpSavingTick();
      }
    },
    [bumpSavingTick, filters.date, rowsRaw, dismissNotification, spFetch],
  );

  const rows = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    if (!query) return rowsRaw;
    return rowsRaw.filter((row) => {
      const name = row.FullName?.toLowerCase() ?? '';
      const code = row.UserID?.toLowerCase() ?? '';
      return name.includes(query) || code.includes(query);
    });
  }, [filters.query, rowsRaw]);

  return {
    status,
    rows,
    filters,
    inputMode,
    savingUsers: savingUsersRef.current,
    savedTempsByUser,
    notification,
    dismissNotification,
    actions: {
      setFilters,
      setInputMode,
      updateStatus,
      updateStatusWithAbsentSupport,
      updateRowFields,
      saveTemperature,
      refresh,
    },
  };
}

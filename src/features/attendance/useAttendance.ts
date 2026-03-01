import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { upsertObservation } from '@/features/nurse';
import { makeSharePointListApi } from '@/features/nurse/sp/client';
import { NURSE_LISTS } from '@/features/nurse/sp/constants';
import type { ObservationListItem } from '@/features/nurse/sp/map';
import type { AbsentSupportLog } from '@/features/service-provision/domain/absentSupportLog';
import type { IUserMaster } from '@/features/users/types';

import type { ObservationTemperatureItem } from './domain/AttendanceRepository';
import { classifyAttendanceError, type AttendanceErrorCode } from './hooks/useAttendanceActions';
import type { AttendanceDailyItem } from './infra/attendanceDailyRepository';
import { useAttendanceRepository } from './repositoryFactory';
import { methodImpliesShuttle } from './transportMethod';
import type { AttendanceFilter, AttendanceHookStatus, AttendanceInputMode, AttendanceRowVM } from './types';

const todayIso = (): string => new Date().toISOString().split('T')[0];

/**
 * SP フラット列 → AbsentSupportLog 埋め込み型へ変換
 * いずれかの欠席対応フィールドに値がある場合のみログを構築する。
 */
const buildAbsentSupportFromItem = (
  item: AttendanceDailyItem,
): AbsentSupportLog | undefined => {
  // 1つでも値があるか判定
  const hasAny =
    item.AbsentContactTimestamp ||
    item.AbsentReason ||
    item.AbsentContactorType ||
    item.AbsentSupportContent ||
    item.NextScheduledDate ||
    item.StaffInChargeId;

  if (!hasAny) return undefined;

  return {
    contactDateTime: item.AbsentContactTimestamp ?? '',
    contactPerson: item.AbsentContactorType ?? '',
    absenceReason: item.AbsentReason ?? '',
    supportContent: item.AbsentSupportContent ?? '',
    followUpDateTime: '',
    followUpTarget: '',
    followUpContent: '',
    followUpResult: '実施',
    nextPlannedDate: item.NextScheduledDate ?? '',
    staffInChargeId: item.StaffInChargeId ?? '',
  };
};

const buildBaseVisit = (userCode: string, date: string): AttendanceRowVM => ({
  Id: -1,
  Title: null,
  UserID: userCode,
  FullName: userCode,
  userCode,
  status: '未',
  recordDate: date,
  cntAttendIn: 0,
  cntAttendOut: 0,
  transportTo: false,
  transportFrom: false,
  isEarlyLeave: false,
  absentMorningContacted: false,
  absentMorningMethod: '',
  eveningChecked: false,
  eveningNote: '',
  isAbsenceAddonClaimable: false,
  providedMinutes: 0,
});

const toMasterUser = (item: {
  Id?: number;
  Title: string;
  UserCode: string;
  IsActive: boolean;
}): IUserMaster => ({
  Id: item.Id ?? -1,
  Title: item.Title,
  UserID: item.UserCode,
  FullName: item.Title,
  IsActive: item.IsActive,
});

const toVisit = (item: AttendanceDailyItem): AttendanceRowVM => ({
  ...buildBaseVisit(item.UserCode, item.RecordDate),
  userCode: item.UserCode,
  status: (item.Status as AttendanceRowVM['status']) ?? '未',
  recordDate: item.RecordDate,
  cntAttendIn: item.CntAttendIn ?? 0,
  cntAttendOut: item.CntAttendOut ?? 0,
  transportTo: item.TransportTo ?? false,
  transportFrom: item.TransportFrom ?? false,
  transportToMethod: item.TransportToMethod ?? undefined,
  transportFromMethod: item.TransportFromMethod ?? undefined,
  transportToNote: item.TransportToNote ?? undefined,
  transportFromNote: item.TransportFromNote ?? undefined,
  isEarlyLeave: item.IsEarlyLeave ?? false,
  absentMorningContacted: item.AbsentMorningContacted ?? false,
  absentMorningMethod: (item.AbsentMorningMethod as AttendanceRowVM['absentMorningMethod']) ?? '',
  eveningChecked: item.EveningChecked ?? false,
  eveningNote: item.EveningNote ?? '',
  isAbsenceAddonClaimable: item.IsAbsenceAddonClaimable ?? false,
  providedMinutes: item.ProvidedMinutes ?? 0,
  userConfirmedAt: item.UserConfirmedAt ?? undefined,
  checkInAt: item.CheckInAt ?? undefined,
  checkOutAt: item.CheckOutAt ?? undefined,
  // AbsentSupportLog 統合: SP フラット列 → 埋め込み型
  absentSupport: buildAbsentSupportFromItem(item),
});

const toDailyItem = (row: AttendanceRowVM, date: string): AttendanceDailyItem => ({
  Key: `${row.userCode}|${date}`,
  UserCode: row.userCode,
  RecordDate: date,
  Status: row.status,
  CheckInAt: row.checkInAt ?? null,
  CheckOutAt: row.checkOutAt ?? null,
  CntAttendIn: row.cntAttendIn,
  CntAttendOut: row.cntAttendOut,
  TransportTo: row.transportToMethod
    ? methodImpliesShuttle(row.transportToMethod)
    : row.transportTo,
  TransportFrom: row.transportFromMethod
    ? methodImpliesShuttle(row.transportFromMethod)
    : row.transportFrom,
  TransportToMethod: row.transportToMethod,
  TransportFromMethod: row.transportFromMethod,
  TransportToNote: row.transportToNote,
  TransportFromNote: row.transportFromNote,
  ProvidedMinutes: row.providedMinutes,
  IsEarlyLeave: row.isEarlyLeave,
  UserConfirmedAt: row.userConfirmedAt ?? null,
  AbsentMorningContacted: row.absentMorningContacted,
  AbsentMorningMethod: row.absentMorningMethod,
  EveningChecked: row.eveningChecked,
  EveningNote: row.eveningNote,
  IsAbsenceAddonClaimable: row.isAbsenceAddonClaimable,
  // AbsentSupportLog → SP フラット列
  AbsentContactTimestamp: row.absentSupport?.contactDateTime || undefined,
  AbsentReason: row.absentSupport?.absenceReason || undefined,
  AbsentContactorType: row.absentSupport?.contactPerson || undefined,
  AbsentSupportContent: row.absentSupport?.supportContent || undefined,
  NextScheduledDate: row.absentSupport?.nextPlannedDate || undefined,
  StaffInChargeId: row.absentSupport?.staffInChargeId || undefined,
});

const mergeRows = (
  users: Array<{ Id?: number; Title: string; UserCode: string; IsActive: boolean }>,
  dailyItems: AttendanceDailyItem[],
  date: string,
): AttendanceRowVM[] => {
  const dailyByCode = new Map<string, AttendanceRowVM>();
  dailyItems.forEach((item) => {
    dailyByCode.set(item.UserCode, toVisit(item));
  });

  return users.map((item) => {
    const master = toMasterUser(item);
    const base = dailyByCode.get(item.UserCode) ?? buildBaseVisit(item.UserCode, date);
    return {
      ...master,
      ...base,
      FullName: master.FullName,
      UserID: master.UserID,
      Id: master.Id,
      Title: master.Title,
    };
  });
};

/**
 * Build a userCode → temperature map from observations.
 * If a user has multiple observations, the latest ObservedAt wins.
 */
export const buildSavedTemps = (
  observations: ObservationTemperatureItem[],
  lookupIdToUserCode: Map<number, string>,
): Record<string, number> => {
  const result: Record<string, number> = {};
  const latestAt: Record<string, string> = {};

  for (const obs of observations) {
    const userCode = lookupIdToUserCode.get(obs.userLookupId);
    if (!userCode) continue;

    const prev = latestAt[userCode];
    if (!prev || obs.observedAt > prev) {
      result[userCode] = obs.temperature;
      latestAt[userCode] = obs.observedAt;
    }
  }
  return result;
};

const getNextStatusRow = (
  row: AttendanceRowVM,
  status: AttendanceRowVM['status'],
  nowIso: string,
): AttendanceRowVM => {
  if (status === '通所中') {
    return {
      ...row,
      status,
      cntAttendIn: 1,
      checkInAt: row.checkInAt ?? nowIso,
      checkOutAt: undefined,
      cntAttendOut: 0,
    };
  }

  if (status === '退所済') {
    return {
      ...row,
      status,
      cntAttendIn: row.cntAttendIn || row.checkInAt ? row.cntAttendIn : 1,
      cntAttendOut: 1,
      checkInAt: row.checkInAt ?? nowIso,
      checkOutAt: nowIso,
    };
  }

  if (status === '当日欠席') {
    return {
      ...row,
      status,
      cntAttendIn: 0,
      cntAttendOut: 0,
      checkInAt: undefined,
      checkOutAt: undefined,
      providedMinutes: 0,
    };
  }

  return {
    ...row,
    status: '未',
    cntAttendIn: 0,
    cntAttendOut: 0,
    checkInAt: undefined,
    checkOutAt: undefined,
    providedMinutes: 0,
  };
};

/** Map internal status to user-friendly label for notifications */
const statusLabel = (s: AttendanceRowVM['status']): string => {
  switch (s) {
    case '通所中': return '通所';
    case '退所済': return '退所';
    case '当日欠席': return '欠席';
    default: return s;
  }
};

export type AttendanceNotification = {
  open: boolean;
  severity: 'success' | 'info' | 'warning' | 'error';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

const NOTIFICATION_CLOSED: AttendanceNotification = {
  open: false,
  severity: 'info',
  message: '',
};

const errorMessage = (code: AttendanceErrorCode): { severity: 'warning' | 'error'; message: string } => {
  switch (code) {
    case 'CONFLICT':
      return { severity: 'warning', message: '他で更新されています。最新を取得してください。' };
    case 'NETWORK':
      return { severity: 'error', message: '通信できません（オフラインの可能性）。' };
    case 'THROTTLED':
      return { severity: 'warning', message: 'サーバーが混み合っています。しばらくお待ちください。' };
    case 'UNKNOWN':
    default:
      return { severity: 'error', message: '保存に失敗しました。' };
  }
};

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
    saveTemperature: (userCode: string, temperature: number, onHighTempAction?: () => void) => Promise<void>;
    refresh: () => Promise<void>;
  };
};

export function useAttendance(): UseAttendanceReturn {
  const repository = useAttendanceRepository();
  const [status, setStatus] = useState<AttendanceHookStatus>('loading');
  const [rowsRaw, setRowsRaw] = useState<AttendanceRowVM[]>([]);
  const [filters, setFiltersState] = useState<AttendanceFilter>({ date: todayIso(), query: '' });

  // ── Per-user double-submit guard ──
  const savingUsersRef = useRef<Set<string>>(new Set());
  const [, setSavingTick] = useState(0);
  const bumpSavingTick = useCallback(() => setSavingTick((t) => t + 1), []);

  // ── Input mode state ──
  const [inputMode, setInputMode] = useState<AttendanceInputMode>('normal');

  // ── Saved temperatures from Observation list ──
  const [savedTempsByUser, setSavedTempsByUser] = useState<Record<string, number>>({});

  // ── Notification state ──
  const [notification, setNotification] = useState<AttendanceNotification>(NOTIFICATION_CLOSED);
  const dismissNotification = useCallback(() => setNotification(NOTIFICATION_CLOSED), []);

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const [users, dailyItems] = await Promise.all([
        repository.getActiveUsers(),
        repository.getDailyByDate({ recordDate: filters.date }),
      ]);
      setRowsRaw(mergeRows(users, dailyItems, filters.date));
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
    } catch (error) {
      console.error('useAttendance.refresh failed', error);
      setStatus('error');
    }
  }, [filters.date, repository]);
  useEffect(() => {
    void refresh();
  }, [refresh]);

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

        const api = makeSharePointListApi();
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
    [bumpSavingTick, filters.date, rowsRaw, dismissNotification],
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
      saveTemperature,
      refresh,
    },
  };
}

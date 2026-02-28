import { useCallback, useEffect, useMemo, useState } from 'react';

import type { IUserMaster } from '@/features/users/types';

import type { AttendanceDailyItem } from './infra/attendanceDailyRepository';
import { useAttendanceRepository } from './repositoryFactory';
import { methodImpliesShuttle } from './transportMethod';
import type { AttendanceFilter, AttendanceHookStatus, AttendanceRowVM } from './types';

const todayIso = (): string => new Date().toISOString().split('T')[0];

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

export type UseAttendanceReturn = {
  status: AttendanceHookStatus;
  rows: AttendanceRowVM[];
  filters: AttendanceFilter;
  actions: {
    setFilters: (next: Partial<AttendanceFilter>) => void;
    updateStatus: (userCode: string, status: AttendanceRowVM['status']) => Promise<void>;
    refresh: () => Promise<void>;
  };
};

export function useAttendance(): UseAttendanceReturn {
  const repository = useAttendanceRepository();
  const [status, setStatus] = useState<AttendanceHookStatus>('loading');
  const [rowsRaw, setRowsRaw] = useState<AttendanceRowVM[]>([]);
  const [filters, setFiltersState] = useState<AttendanceFilter>({ date: todayIso(), query: '' });

  const refresh = useCallback(async () => {
    setStatus('loading');
    try {
      const [users, dailyItems] = await Promise.all([
        repository.getActiveUsers(),
        repository.getDailyByDate({ recordDate: filters.date }),
      ]);
      setRowsRaw(mergeRows(users, dailyItems, filters.date));
      setStatus('success');
    } catch (error) {
      console.error('useAttendance.refresh failed', error);
      setStatus('error');
    }
  }, [filters.date, repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateStatus = useCallback(
    async (userCode: string, nextStatus: AttendanceRowVM['status']) => {
      const current = rowsRaw.find((row) => row.userCode === userCode);
      if (!current) return;

      const nowIso = new Date().toISOString();
      const nextRow = getNextStatusRow(current, nextStatus, nowIso);

      setRowsRaw((prev) => prev.map((row) => (row.userCode === userCode ? nextRow : row)));

      try {
        await repository.upsertDailyByKey(toDailyItem(nextRow, filters.date));
      } catch (error) {
        console.error('useAttendance.updateStatus failed', error);
        await refresh();
        setStatus('error');
      }
    },
    [filters.date, refresh, repository, rowsRaw],
  );

  const setFilters = useCallback((next: Partial<AttendanceFilter>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
  }, []);

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
    actions: {
      setFilters,
      updateStatus,
      refresh,
    },
  };
}

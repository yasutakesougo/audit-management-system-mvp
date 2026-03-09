/**
 * Attendance Data Mappers
 *
 * Pure functions for converting between SharePoint flat columns,
 * domain models (AttendanceRowVM), and user master data.
 *
 * Extracted from useAttendance.ts for maintainability —
 * all functions are stateless and free of React dependencies.
 *
 * @module features/attendance/attendanceMappers
 */

import type { AbsentSupportLog } from '@/features/service-provision/domain/absentSupportLog';
import type { IUserMaster } from '@/features/users/types';

import { toLocalDateISO } from '@/utils/getNow';
import type { ObservationTemperatureItem } from './domain/AttendanceRepository';
import type { AttendanceDailyItem } from './infra/attendanceDailyRepository';
import { methodImpliesShuttle } from './transportMethod';
import type { AttendanceRowVM } from './types';

// ============================================================================
// Date Helpers
// ============================================================================

export const todayIso = (): string => toLocalDateISO();

/** Convert date string (YYYY-MM-DD) to Japanese weekday label */
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;
export const getWeekdayLabel = (dateStr: string): string => {
  const d = new Date(dateStr + 'T00:00:00');
  return WEEKDAY_LABELS[d.getDay()];
};

// ============================================================================
// Row Builders
// ============================================================================

export const buildBaseVisit = (userCode: string, date: string): AttendanceRowVM => ({
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

export const toMasterUser = (item: {
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

// ============================================================================
// SP ↔ VM Conversion
// ============================================================================

/**
 * SP フラット列 → AbsentSupportLog 埋め込み型へ変換
 * いずれかの欠席対応フィールドに値がある場合のみログを構築する。
 */
export const buildAbsentSupportFromItem = (
  item: AttendanceDailyItem,
): AbsentSupportLog | undefined => {
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

export const toVisit = (item: AttendanceDailyItem): AttendanceRowVM => ({
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
  absentSupport: buildAbsentSupportFromItem(item),
});

export const toDailyItem = (row: AttendanceRowVM, date: string): AttendanceDailyItem => ({
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
  AbsentContactTimestamp: row.absentSupport?.contactDateTime || undefined,
  AbsentReason: row.absentSupport?.absenceReason || undefined,
  AbsentContactorType: row.absentSupport?.contactPerson || undefined,
  AbsentSupportContent: row.absentSupport?.supportContent || undefined,
  NextScheduledDate: row.absentSupport?.nextPlannedDate || undefined,
  StaffInChargeId: row.absentSupport?.staffInChargeId || undefined,
});

// ============================================================================
// Data Merging
// ============================================================================

export const mergeRows = (
  users: Array<{ Id?: number; Title: string; UserCode: string; IsActive: boolean; AttendanceDays?: string[] }>,
  dailyItems: AttendanceDailyItem[],
  date: string,
): AttendanceRowVM[] => {
  const dailyByCode = new Map<string, AttendanceRowVM>();
  dailyItems.forEach((item) => {
    dailyByCode.set(item.UserCode, toVisit(item));
  });

  const weekday = getWeekdayLabel(date);

  return users
    .filter((item) => {
      if (dailyByCode.has(item.UserCode)) return true;
      if (!item.AttendanceDays || item.AttendanceDays.length === 0) return true;
      return item.AttendanceDays.includes(weekday);
    })
    .map((item) => {
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

// ============================================================================
// Observation / Temperature
// ============================================================================

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

// ============================================================================
// Status Transition
// ============================================================================

export const getNextStatusRow = (
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
export const statusLabel = (s: AttendanceRowVM['status']): string => {
  switch (s) {
    case '通所中': return '通所';
    case '退所済': return '退所';
    case '当日欠席': return '欠席';
    default: return s;
  }
};

// ============================================================================
// Notification Helpers
// ============================================================================

export type AttendanceNotification = {
  open: boolean;
  severity: 'success' | 'info' | 'warning' | 'error';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const NOTIFICATION_CLOSED: AttendanceNotification = {
  open: false,
  severity: 'info',
  message: '',
};

export type { AttendanceErrorCode } from './hooks/useAttendanceActions';

export const errorMessage = (code: import('./hooks/useAttendanceActions').AttendanceErrorCode): { severity: 'warning' | 'error'; message: string } => {
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

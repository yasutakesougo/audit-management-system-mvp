/**
 * SharePoint フィールド定義 — Attendance 関連
 *
 * Staff_Attendance, AttendanceUsers, AttendanceDaily
 */

// ──────────────────────────────────────────────────────────────
// Staff attendance (SharePoint list: Staff_Attendance)
// ──────────────────────────────────────────────────────────────

export const STAFF_ATTENDANCE_LIST_TITLE = 'Staff_Attendance' as const;

export const STAFF_ATTENDANCE_FIELDS = {
  id: 'Id',
  title: 'Title',
  staffId: 'StaffId',
  recordDate: 'RecordDate',
  isFinalized: 'IsFinalized',
  finalizedAt: 'FinalizedAt',
  finalizedBy: 'FinalizedBy',
  status: 'Status',
  checkInAt: 'CheckInAt',
  checkOutAt: 'CheckOutAt',
  lateMinutes: 'LateMinutes',
  note: 'Note',
  created: 'Created',
  modified: 'Modified',
} as const;

export const STAFF_ATTENDANCE_SELECT_FIELDS = [
  STAFF_ATTENDANCE_FIELDS.id,
  STAFF_ATTENDANCE_FIELDS.title,
  STAFF_ATTENDANCE_FIELDS.staffId,
  STAFF_ATTENDANCE_FIELDS.recordDate,
  STAFF_ATTENDANCE_FIELDS.isFinalized,
  STAFF_ATTENDANCE_FIELDS.status,
  STAFF_ATTENDANCE_FIELDS.checkInAt,
  STAFF_ATTENDANCE_FIELDS.checkOutAt,
  STAFF_ATTENDANCE_FIELDS.lateMinutes,
  STAFF_ATTENDANCE_FIELDS.note,
] as const;

export const STAFF_ATTENDANCE_FIELD_MAP = {
  id: 'Id',
  title: 'Title',
  staffId: 'StaffId',
  recordDate: 'RecordDate',
  status: 'Status',
  checkInAt: 'CheckInAt',
  checkOutAt: 'CheckOutAt',
  lateMinutes: 'LateMinutes',
  note: 'Note',
  created: 'Created',
  modified: 'Modified',
} as const;

// ──────────────────────────────────────────────────────────────
// User Attendance Users (SharePoint list: AttendanceUsers)
// ──────────────────────────────────────────────────────────────

export const ATTENDANCE_USERS_LIST_TITLE = 'AttendanceUsers' as const;

export const ATTENDANCE_USERS_FIELDS = {
  id: 'Id',
  title: 'Title',
  userCode: 'UserCode',
  isTransportTarget: 'IsTransportTarget',
  standardMinutes: 'StandardMinutes',
  isActive: 'IsActive',

  // Transport method default fields (optional - require SP column creation)
  defaultTransportToMethod: 'DefaultTransportToMethod',
  defaultTransportFromMethod: 'DefaultTransportFromMethod',
  defaultTransportToNote: 'DefaultTransportToNote',
  defaultTransportFromNote: 'DefaultTransportFromNote',
} as const;

export const ATTENDANCE_USERS_SELECT_FIELDS = [
  ATTENDANCE_USERS_FIELDS.id,
  ATTENDANCE_USERS_FIELDS.title,
  ATTENDANCE_USERS_FIELDS.userCode,
  ATTENDANCE_USERS_FIELDS.isTransportTarget,
  ATTENDANCE_USERS_FIELDS.standardMinutes,
  ATTENDANCE_USERS_FIELDS.isActive,
] as const;

/**
 * AttendanceUsers フィールド候補
 */
export const ATTENDANCE_USERS_CANDIDATES = {
  userCode: ['UserID', 'UserCode', 'cr013_usercode', 'Title'],
  title: ['FullName', 'FullNameKana', 'Title'],
  isTransportTarget: ['IsTransportTarget'],
  standardMinutes: ['StandardMinutes'],
  isActive: ['IsActive', 'Active'],
  defaultTransportToMethod: ['DefaultTransportToMethod'],
  defaultTransportFromMethod: ['DefaultTransportFromMethod'],
  defaultTransportToNote: ['DefaultTransportToNote'],
  defaultTransportFromNote: ['DefaultTransportFromNote'],
} as const;

// ──────────────────────────────────────────────────────────────
// User Attendance Daily (SharePoint list: AttendanceDaily)
// ──────────────────────────────────────────────────────────────

export const ATTENDANCE_DAILY_LIST_TITLE = 'AttendanceDaily' as const;

export const ATTENDANCE_DAILY_FIELDS = {
  id: 'Id',
  // SharePoint の既定テキスト列（一部環境で "Key" 列が存在しないため Title を正本にする）
  key: 'Title',
  // 旧スキーマ互換（読み取りのみ）
  legacyKey: 'Key',
  userCode: 'UserCode',
  recordDate: 'RecordDate',
  status: 'Status',
  checkInAt: 'CheckInAt',
  checkOutAt: 'CheckOutAt',
  cntAttendIn: 'CntAttendIn',
  cntAttendOut: 'CntAttendOut',
  transportTo: 'TransportTo',
  transportFrom: 'TransportFrom',
  providedMinutes: 'ProvidedMinutes',
  isEarlyLeave: 'IsEarlyLeave',
  userConfirmedAt: 'UserConfirmedAt',
  absentMorningContacted: 'AbsentMorningContacted',
  absentMorningMethod: 'AbsentMorningMethod',
  eveningChecked: 'EveningChecked',
  eveningNote: 'EveningNote',
  isAbsenceAddonClaimable: 'IsAbsenceAddonClaimable',

  // Transport method enum fields (optional - require SP column creation)
  transportToMethod: 'TransportToMethod',
  transportFromMethod: 'TransportFromMethod',
  transportToNote: 'TransportToNote',
  transportFromNote: 'TransportFromNote',

  // Absent support fields (optional - require SP column creation)
  // Not in SELECT to avoid 400 on envs without these columns
  absentContactTimestamp: 'AbsentContactTimestamp',
  absentReason: 'AbsentReason',
  absentContactorType: 'AbsentContactorType',
  absentSupportContent: 'AbsentSupportContent',
  nextScheduledDate: 'NextScheduledDate',
  staffInChargeId: 'StaffInChargeId',
} as const;

export const ATTENDANCE_DAILY_SELECT_FIELDS = [
  ATTENDANCE_DAILY_FIELDS.id,
  ATTENDANCE_DAILY_FIELDS.key,
  ATTENDANCE_DAILY_FIELDS.userCode,
  ATTENDANCE_DAILY_FIELDS.recordDate,
  ATTENDANCE_DAILY_FIELDS.status,
  ATTENDANCE_DAILY_FIELDS.checkInAt,
  ATTENDANCE_DAILY_FIELDS.checkOutAt,
  ATTENDANCE_DAILY_FIELDS.cntAttendIn,
  ATTENDANCE_DAILY_FIELDS.cntAttendOut,
  ATTENDANCE_DAILY_FIELDS.transportTo,
  ATTENDANCE_DAILY_FIELDS.transportFrom,
  ATTENDANCE_DAILY_FIELDS.providedMinutes,
  ATTENDANCE_DAILY_FIELDS.isEarlyLeave,
  ATTENDANCE_DAILY_FIELDS.userConfirmedAt,
  ATTENDANCE_DAILY_FIELDS.absentMorningContacted,
  ATTENDANCE_DAILY_FIELDS.absentMorningMethod,
  ATTENDANCE_DAILY_FIELDS.eveningChecked,
  ATTENDANCE_DAILY_FIELDS.eveningNote,
  ATTENDANCE_DAILY_FIELDS.isAbsenceAddonClaimable,
] as const;

import type { SpFieldDef } from '@/lib/sp/types';

/**
 * AttendanceDaily フィールド候補 (環境差異吸収用)
 */
export const ATTENDANCE_DAILY_CANDIDATES = {
  key: ['Title', 'Key'],
  userCode: ['UserCode', 'cr013_usercode', 'cr013_personId', 'UserId', 'UserID'],
  recordDate: ['RecordDate', 'cr013_date', 'cr013_recorddate', 'Date'],
  status: ['Status', 'cr013_status'],
  checkInAt: ['CheckInAt'],
  checkOutAt: ['CheckOutAt'],
  cntAttendIn: ['CntAttendIn'],
  cntAttendOut: ['CntAttendOut'],
  transportTo: ['TransportTo'],
  transportFrom: ['TransportFrom'],
  providedMinutes: ['ProvidedMinutes'],
  isEarlyLeave: ['IsEarlyLeave'],
  userConfirmedAt: ['UserConfirmedAt'],
  absentMorningContacted: ['AbsentMorningContacted'],
  absentMorningMethod: ['AbsentMorningMethod'],
  eveningChecked: ['EveningChecked'],
  eveningNote: ['EveningNote'],
  isAbsenceAddonClaimable: ['IsAbsenceAddonClaimable', 'AbsenceAddonClaimable'],
  transportToMethod: ['TransportToMethod'],
  transportFromMethod: ['TransportFromMethod'],
  transportToNote: ['TransportToNote'],
  transportFromNote: ['TransportFromNote'],
  absentContactTimestamp: ['AbsentContactTimestamp'],
  absentReason: ['AbsentReason'],
  absentContactorType: ['AbsentContactorType'],
  absentSupportContent: ['AbsentSupportContent'],
  nextScheduledDate: ['NextScheduledDate'],
  staffInChargeId: ['StaffInChargeId'],
} as const;

/**
 * AttendanceDaily プロビジョニング用定義 (ensureListExists 用)
 */
export const ATTENDANCE_DAILY_ENSURE_FIELDS: SpFieldDef[] = [
  { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true },
  { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly' },
  { internalName: 'Status', type: 'Text', displayName: 'Status', required: true },
  { internalName: 'CheckInAt', type: 'DateTime', displayName: 'Check-in Time', dateTimeFormat: 'DateTime' },
  { internalName: 'CheckOutAt', type: 'DateTime', displayName: 'Check-out Time', dateTimeFormat: 'DateTime' },
  { internalName: 'CntAttendIn', type: 'Number', displayName: 'Attendance In Count' },
  { internalName: 'CntAttendOut', type: 'Number', displayName: 'Attendance Out Count' },
  { internalName: 'TransportTo', type: 'Boolean', displayName: 'Transport To' },
  { internalName: 'TransportFrom', type: 'Boolean', displayName: 'Transport From' },
  { internalName: 'ProvidedMinutes', type: 'Number', displayName: 'Provided Minutes' },
  { internalName: 'IsEarlyLeave', type: 'Boolean', displayName: 'Early Leave' },
  { internalName: 'UserConfirmedAt', type: 'DateTime', displayName: 'User Confirmed Time', dateTimeFormat: 'DateTime' },
  { internalName: 'AbsentMorningContacted', type: 'Boolean', displayName: 'Absent Morning Contacted' },
  { internalName: 'AbsentMorningMethod', type: 'Text', displayName: 'Absent Morning Method' },
  { internalName: 'EveningChecked', type: 'Boolean', displayName: 'Evening Checked' },
  { internalName: 'EveningNote', type: 'Note', displayName: 'Evening Note' },
  { internalName: 'IsAbsenceAddonClaimable', type: 'Boolean', displayName: 'Absence Add-on Claimable' },
  { internalName: 'TransportToMethod', type: 'Text', displayName: 'Transport To Method' },
  { internalName: 'TransportFromMethod', type: 'Text', displayName: 'Transport From Method' },
  { internalName: 'TransportToNote', type: 'Note', displayName: 'Transport To Note' },
  { internalName: 'TransportFromNote', type: 'Note', displayName: 'Transport From Note' },
  { internalName: 'AbsentContactTimestamp', type: 'DateTime', displayName: 'Absent Contact Time', dateTimeFormat: 'DateTime' },
  { internalName: 'AbsentReason', type: 'Note', displayName: 'Absent Reason' },
  { internalName: 'AbsentContactorType', type: 'Text', displayName: 'Absent Contactor Type' },
  { internalName: 'AbsentSupportContent', type: 'Note', displayName: 'Absent Support Content' },
  { internalName: 'NextScheduledDate', type: 'DateTime', displayName: 'Next Scheduled Date', dateTimeFormat: 'DateOnly' },
  { internalName: 'StaffInChargeId', type: 'Text', displayName: 'Staff in Charge ID' },
];

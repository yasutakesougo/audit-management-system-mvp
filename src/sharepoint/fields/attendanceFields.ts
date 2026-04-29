/**
 * SharePoint フィールド定義 — Attendance 関連
 *
 * Staff_Attendance, AttendanceUsers, AttendanceDaily
 */

// ──────────────────────────────────────────────────────────────
// Attendance parent (SharePoint list: Daily_Attendance)
// ──────────────────────────────────────────────────────────────

export const ATTENDANCE_LIST_TITLE = 'Daily_Attendance' as const;

/**
 * Daily_Attendance フィールド候補マップ (SSOT / Drift Resistance)
 *
 * read / write / diagnostics 共通で参照する候補定義。
 */
export const ATTENDANCE_CANDIDATES = {
  userId: [
    'UserID',
    'UserId',
    'userId',
    'User',
    'User_x0020_Id',
    'UserCode',
    'UserIdId',
    'cr013_userId',
  ],
  attendanceDate: [
    'Date',
    'AttendanceDate',
    'Attendance_x0020_Date',
    'AttendanceDate0',
    'RecordDate',
    'EntryDate',
    'cr013_date',
  ],
  status: [
    'Status',
    'AttendanceStatus',
    'UsageStatus',
    'Status0',
    'cr013_status',
  ],
  checkInTime: [
    'CheckInTime',
    'CheckInAt',
    'StartTime',
    'CheckIn_x0020_Time',
    'CheckInTime0',
  ],
  checkOutTime: [
    'CheckOutTime',
    'CheckOutAt',
    'EndTime',
    'CheckOut_x0020_Time',
    'CheckOutTime0',
  ],
  isTrial: [
    'IsTrial',
    'Trial',
    'Is_x0020_Trial',
    'IsTrial0',
    'cr013_isTrial',
  ],
  notes: [
    'Notes',
    'Note',
    'Memo',
    'Notes0',
    'cr013_notes',
  ],
} as const;

export const ATTENDANCE_ESSENTIALS: (keyof typeof ATTENDANCE_CANDIDATES)[] = [
  'userId',
  'attendanceDate',
  'status',
];

export type AttendanceCandidateKey = keyof typeof ATTENDANCE_CANDIDATES;
export type AttendanceFieldMapping = Partial<Record<AttendanceCandidateKey, string>>;

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

/**
 * Staff_Attendance フィールド候補マップ (Drift Resistance)
 */
export const STAFF_ATTENDANCE_CANDIDATES = {
  staffId: ['StaffId', 'StaffID', 'UserCode', 'cr013_staffId'],
  recordDate: ['RecordDate', 'Date', 'cr013_recordDate'],
  status: ['Status', 'UsageStatus', 'cr013_status'],
  checkInAt: ['CheckInAt', 'CheckIn', 'cr013_checkInAt'],
  checkOutAt: ['CheckOutAt', 'CheckOut', 'cr013_checkOutAt'],
  lateMinutes: ['LateMinutes', 'Late', 'cr013_lateMinutes'],
  note: ['Note', 'Notes', 'cr013_note'],
  isFinalized: ['IsFinalized', 'Finalized', 'cr013_isFinalized'],
} as const;

export const STAFF_ATTENDANCE_ESSENTIALS: (keyof typeof STAFF_ATTENDANCE_CANDIDATES)[] = [
  'staffId', 'recordDate', 'status'
];

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
  serviceEndDate: 'ServiceEndDate',
  usageStatus: 'UsageStatus',

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
  ATTENDANCE_USERS_FIELDS.serviceEndDate,
  ATTENDANCE_USERS_FIELDS.usageStatus,
] as const;

/**
 * AttendanceUsers フィールド候補
 */
export const ATTENDANCE_USERS_CANDIDATES = {
  userCode: ['UserCode', 'UserID', 'UserId', 'userId', 'User_x0020_Id', 'UserIdId', 'cr013_userCode', 'Title'],
  title: ['Title', 'FullName', 'DisplayName', 'UserName', 'Full_x0020_Name', 'cr013_fullName'],
  isTransportTarget: ['IsTransportTarget', 'TransportTarget', 'cr013_isTransportTarget'],
  standardMinutes: ['StandardMinutes', 'StdMinutes', 'cr013_standardMinutes'],
  isActive: ['IsActive', 'Active', 'Is_x0020_Active', 'IsActive0', 'cr013_isActive'],
  serviceEndDate: ['ServiceEndDate', 'EndDate', 'Service_x0020_End_x0020_Date', 'ServiceEndDate0', 'cr013_serviceEndDate'],
  usageStatus: ['UsageStatus', 'Status', 'Usage_x0020_Status', 'Status0', 'cr013_usageStatus'],
  attendanceDays: ['AttendanceDays', 'WorkDays', 'cr013_attendanceDays'],
  defaultTransportToMethod: ['DefaultTransportToMethod', 'cr013_defTransTo'],
  defaultTransportFromMethod: ['DefaultTransportFromMethod', 'cr013_defTransFrom'],
  defaultTransportToNote: ['DefaultTransportToNote', 'cr013_defTransToNote'],
  defaultTransportFromNote: ['DefaultTransportFromNote', 'cr013_defTransFromNote'],
} as const;

export const ATTENDANCE_USERS_ESSENTIALS: (keyof typeof ATTENDANCE_USERS_CANDIDATES)[] = [
  'userCode', 'title'
];

export type AttendanceUsersCandidateKey = keyof typeof ATTENDANCE_USERS_CANDIDATES;
export type AttendanceUsersFieldMapping = Partial<Record<AttendanceUsersCandidateKey, string>>;

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
  key: ['Title', 'Key', 'key', 'AttendanceKey', 'Key0', 'cr013_key'],
  userCode: ['UserCode', 'UserID', 'UserId', 'userId', 'UserIdId', 'cr013_userCode', 'cr013_personId'],
  recordDate: ['RecordDate', 'AttendanceDate', 'AttendanceDate0', 'Date', 'EntryDate', 'RecordDate0', 'cr013_recordDate'],
  status: ['Status', 'AttendanceStatus', 'UsageStatus', 'Status0', 'cr013_status'],
  checkInAt: ['CheckInAt', 'CheckInTime', 'StartTime', 'CheckInAt0', 'CheckIn', 'cr013_checkInAt'],
  checkOutAt: ['CheckOutAt', 'CheckOutTime', 'EndTime', 'CheckOutAt0', 'CheckOut', 'cr013_checkOutAt'],
  cntAttendIn: ['CntAttendIn', 'cr013_cntAttendIn'],
  cntAttendOut: ['CntAttendOut', 'cr013_cntAttendOut'],
  transportTo: ['TransportTo', 'cr013_transportTo'],
  transportFrom: ['TransportFrom', 'cr013_transportFrom'],
  providedMinutes: ['ProvidedMinutes', 'cr013_providedMinutes'],
  isEarlyLeave: ['IsEarlyLeave', 'cr013_isEarlyLeave'],
  userConfirmedAt: ['UserConfirmedAt', 'cr013_userConfirmedAt'],
  absentMorningContacted: ['AbsentMorningContacted', 'cr013_absentMorningContacted'],
  absentMorningMethod: ['AbsentMorningMethod', 'cr013_absentMorningMethod'],
  eveningChecked: ['EveningChecked', 'cr013_eveningChecked'],
  eveningNote: ['EveningNote', 'cr013_eveningNote'],
  isAbsenceAddonClaimable: ['IsAbsenceAddonClaimable', 'cr013_isAbsenceAddonClaimable'],
  transportToMethod: ['TransportToMethod', 'cr013_transportToMethod'],
  transportFromMethod: ['TransportFromMethod', 'cr013_transportFromMethod'],
  transportToNote: ['TransportToNote', 'cr013_transportToNote'],
  transportFromNote: ['TransportFromNote', 'cr013_transportFromNote'],
  absentContactTimestamp: ['AbsentContactTimestamp', 'cr013_absentContactTimestamp'],
  absentReason: ['AbsentReason', 'cr013_absentReason'],
  absentContactorType: ['AbsentContactorType', 'cr013_absentContactorType'],
  absentSupportContent: ['AbsentSupportContent', 'cr013_absentSupportContent'],
  nextScheduledDate: ['NextScheduledDate', 'cr013_nextScheduledDate'],
  staffInChargeId: ['StaffInChargeId', 'cr013_staffInChargeId'],
} as const;

export const ATTENDANCE_DAILY_ESSENTIALS: (keyof typeof ATTENDANCE_DAILY_CANDIDATES)[] = [
  'userCode',
  'recordDate',
  'status',
  'checkInAt',
];

export type AttendanceDailyCandidateKey = keyof typeof ATTENDANCE_DAILY_CANDIDATES;
export type AttendanceDailyFieldMapping = Partial<Record<AttendanceDailyCandidateKey, string>>;

/**
 * AttendanceDaily プロビジョニング用定義 (ensureListExists 用)
 */
export const ATTENDANCE_DAILY_ENSURE_FIELDS: SpFieldDef[] = [
  { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true },
  { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly' },
  { internalName: 'Status', type: 'Text', displayName: 'Status', required: true },
  { internalName: 'CheckInAt', type: 'DateTime', displayName: 'Check-in Time', dateTimeFormat: 'DateTime', forceCreate: true },
  { internalName: 'CheckOutAt', type: 'DateTime', displayName: 'Check-out Time', dateTimeFormat: 'DateTime', forceCreate: true },
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

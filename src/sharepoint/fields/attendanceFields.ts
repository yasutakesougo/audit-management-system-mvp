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

// ──────────────────────────────────────────────────────────────
// User Attendance Daily (SharePoint list: AttendanceDaily)
// ──────────────────────────────────────────────────────────────

export const ATTENDANCE_DAILY_LIST_TITLE = 'AttendanceDaily' as const;

export const ATTENDANCE_DAILY_FIELDS = {
  id: 'Id',
  key: 'Key',
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

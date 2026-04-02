/**
 * SharePoint フィールド定義 — Transport_Log
 *
 * 送迎ステータスのリアルタイムログを記録するリスト。
 * 全状態遷移を保持し、監査証跡として機能する。
 *
 * Title (複合キー): {UserCode}_{RecordDate}_{Direction}
 *   例: U001_2026-03-13_to
 *
 * Sync ルール (AttendanceDaily への確定値同期):
 *   - status=arrived かつ method=facility-vehicle → TransportTo/From = true
 *   - status=self / family / walk              → TransportTo/From = false, Method のみ記録
 *   - status=absent                            → sync しない (attendance 側に委譲)
 */

// ──────────────────────────────────────────────────────────────
// Transport Log (SharePoint list: Transport_Log)
// ──────────────────────────────────────────────────────────────

export const TRANSPORT_LOG_LIST_TITLE = 'Transport_Log' as const;

export const TRANSPORT_LOG_FIELDS = {
  id: 'Id',
  title: 'Title',           // composite key: {UserCode}_{Date}_{Direction}
  userCode: 'UserCode',
  recordDate: 'RecordDate',
  direction: 'Direction',   // Choice: to | from
  status: 'Status',         // Choice: pending | in-progress | arrived | absent | self
  method: 'Method',         // Choice: facility-vehicle | family | taxi | walk | self | other
  scheduledTime: 'ScheduledTime',   // HH:mm
  actualTime: 'ActualTime',         // HH:mm
  driverName: 'DriverName',
  notes: 'Notes',
  updatedBy: 'UpdatedBy',
  updatedAt: 'UpdatedAt',
} as const;

export const TRANSPORT_LOG_SELECT_FIELDS = [
  TRANSPORT_LOG_FIELDS.id,
  TRANSPORT_LOG_FIELDS.title,
  TRANSPORT_LOG_FIELDS.userCode,
  TRANSPORT_LOG_FIELDS.recordDate,
  TRANSPORT_LOG_FIELDS.direction,
  TRANSPORT_LOG_FIELDS.status,
  TRANSPORT_LOG_FIELDS.method,
  TRANSPORT_LOG_FIELDS.scheduledTime,
  TRANSPORT_LOG_FIELDS.actualTime,
  TRANSPORT_LOG_FIELDS.driverName,
  TRANSPORT_LOG_FIELDS.notes,
  TRANSPORT_LOG_FIELDS.updatedBy,
  TRANSPORT_LOG_FIELDS.updatedAt,
] as const;

// ──────────────────────────────────────────────────────────────
// Title key builder
// ──────────────────────────────────────────────────────────────

/** Build the composite Title key for a transport log entry */
export function buildTransportLogTitle(
  userCode: string,
  recordDate: string,
  direction: 'to' | 'from',
): string {
  return `${userCode}_${recordDate}_${direction}`;
}

// ──────────────────────────────────────────────────────────────
// Drift Candidates & Essentials
// ──────────────────────────────────────────────────────────────

/**
 * 1. Transport Log リスト用のフィールド候補
 */
export const TRANSPORT_LOG_CANDIDATES = {
  userCode:      ['UserCode', 'UserID', 'cr013_userCode', 'User_x0020_Code'],
  recordDate:    ['RecordDate', 'Date', 'cr013_date', 'Record_x0020_Date'],
  direction:     ['Direction', 'cr013_direction', 'to_from'],
  status:        ['Status', 'cr013_status', 'TransportStatus', 'cr013_transportStatus'],
  method:        ['Method', 'cr013_method', 'TransportMethod', 'cr013_transportMethod'],
  scheduledTime: ['ScheduledTime', 'Scheduled_x0020_Time', 'cr013_scheduledTime'],
  actualTime:    ['ActualTime', 'Actual_x0020_Time', 'cr013_actualTime'],
  driverName:    ['DriverName', 'Driver_x0020_Name', 'cr013_driverName'],
  notes:         ['Notes', 'Note', 'cr013_notes'],
  updatedBy:     ['UpdatedBy', 'cr013_updatedBy'],
  updatedAt:     ['UpdatedAt', 'cr013_updatedAt', 'Modified'],
} as const;

export const TRANSPORT_LOG_ESSENTIALS: (keyof typeof TRANSPORT_LOG_CANDIDATES)[] = [
  'userCode', 'recordDate', 'direction', 'status'
];

/**
 * 2. User Transport Settings リスト用のフィールド候補
 */
export const TRANSPORT_SETTING_CANDIDATES = {
  userId:           ['UserID', 'UserCode', 'cr013_userId', 'User_x0020_ID'],
  transportToDays:  ['TransportToDays', 'ToDays', 'To_x0020_Days', 'cr013_transportToDays'],
  transportFromDays: ['TransportFromDays', 'FromDays', 'From_x0020_Days', 'cr013_transportFromDays'],
  transportCourse:  ['TransportCourse', 'Course', 'cr013_transportCourse'],
  transportSchedule: ['TransportSchedule', 'Schedule', 'cr013_transportSchedule'],
  transportAdditionType: ['TransportAdditionType', 'AdditionType', 'cr013_additionType'],
} as const;

export const TRANSPORT_SETTING_ESSENTIALS: (keyof typeof TRANSPORT_SETTING_CANDIDATES)[] = [
  'userId', 'transportToDays', 'transportFromDays'
];

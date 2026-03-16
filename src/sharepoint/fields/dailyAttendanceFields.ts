/**
 * SharePoint フィールド定義 — Daily_Attendance
 *
 * 日次出欠記録リスト（読み取り専用）。
 * 出欠管理の集約ビューとして、他リスト (AttendanceDaily 等) から参照されるマスタ的なリスト。
 *
 * 監査 P1-3 追加
 *
 * ⚠️ 実際の SP リスト列を PnP PowerShell で確認し、
 *   下記の推定フィールドを実際の内部名に合わせて修正してください。
 *
 * ```powershell
 * Get-PnPField -List "Daily_Attendance" | Format-Table InternalName, Title, TypeAsString -AutoSize
 * ```
 */

export const DAILY_ATTENDANCE_LIST_TITLE = 'Daily_Attendance' as const;

export const DAILY_ATTENDANCE_FIELDS = {
  id: 'Id',
  title: 'Title',
  userCode: 'UserCode',
  recordDate: 'RecordDate',
  status: 'Status',           // Choice: present | absent | late | early-leave
  checkInTime: 'CheckInTime',
  checkOutTime: 'CheckOutTime',
  note: 'Note',
  created: 'Created',
  modified: 'Modified',
} as const;

export const DAILY_ATTENDANCE_SELECT_FIELDS = [
  DAILY_ATTENDANCE_FIELDS.id,
  DAILY_ATTENDANCE_FIELDS.title,
  DAILY_ATTENDANCE_FIELDS.userCode,
  DAILY_ATTENDANCE_FIELDS.recordDate,
  DAILY_ATTENDANCE_FIELDS.status,
  DAILY_ATTENDANCE_FIELDS.checkInTime,
  DAILY_ATTENDANCE_FIELDS.checkOutTime,
  DAILY_ATTENDANCE_FIELDS.note,
  DAILY_ATTENDANCE_FIELDS.created,
  DAILY_ATTENDANCE_FIELDS.modified,
] as const;

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

/**
 * daily_attendance リストのフィールド解決候補マップ (Drift Resistance)
 * 1番目の候補（基準名）以外は drift (WARN) と見なされる。
 *
 * essentialFields (registry): ['UserID', 'Date', 'Status']
 *
 * 注意: DAILY_ATTENDANCE_FIELDS は 'UserCode' / 'RecordDate' を使うが、
 * registry の provisioningFields は 'UserID' / 'Date' で定義されている。
 * candidates に両方を含めることで drift として吸収する。
 */
export const DAILY_ATTENDANCE_CANDIDATES = {
  userID: [
    'UserID', 'UserCode', 'UserId', 'UserIdId', 'cr013_userId',
  ],
  date: [
    'Date', 'RecordDate', 'EntryDate', 'AttendanceDate', 'Date0', 'cr013_date',
  ],
  status: [
    'Status', 'AttendanceStatus', 'Status0', 'cr013_status',
  ],
  isTrial: [
    'IsTrial', 'Trial', 'IsTrial0', 'cr013_isTrial',
  ],
  notes: [
    'Notes', 'Note', 'Memo', 'Notes0', 'cr013_notes',
  ],
} as const;

/**
 * daily_attendance の必須フィールドキー。
 * UserID + Date + Status が揃わなければ出欠記録として機能しない。
 */
export const DAILY_ATTENDANCE_ESSENTIALS: (keyof typeof DAILY_ATTENDANCE_CANDIDATES)[] = [
  'userID',
  'date',
  'status',
];

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

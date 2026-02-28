import type { SpDailyItem, SpScheduleItem, SpStaffItem, SpUserItem } from '@/types';

// SharePoint フィールド定義（暫定安全セット）

export type UserRow = SpUserItem;
export type StaffRow = SpStaffItem;
export type ScheduleRow = SpScheduleItem;
export type DailyRow = SpDailyItem;

// ──────────────────────────────────────────────────────────────
// Service Provision Records (SharePoint list: ServiceProvisionRecords)
// ──────────────────────────────────────────────────────────────

export const SERVICE_PROVISION_LIST_TITLE = 'ServiceProvisionRecords' as const;

export const SERVICE_PROVISION_FIELDS = {
  id: 'Id',
  title: 'Title',
  entryKey: 'EntryKey',
  userCode: 'UserCode',
  recordDate: 'RecordDate',
  status: 'Status',
  startHHMM: 'StartHHMM',
  endHHMM: 'EndHHMM',
  hasTransport: 'HasTransport',
  hasTransportPickup: 'HasTransportPickup',
  hasTransportDropoff: 'HasTransportDropoff',
  hasMeal: 'HasMeal',
  hasBath: 'HasBath',
  hasExtended: 'HasExtended',
  hasAbsentSupport: 'HasAbsentSupport',
  note: 'Note',
  source: 'Source',
  updatedByUPN: 'UpdatedByUPN',
  created: 'Created',
  modified: 'Modified',
} as const;

export const SERVICE_PROVISION_SELECT_FIELDS = [
  SERVICE_PROVISION_FIELDS.id,
  SERVICE_PROVISION_FIELDS.title,
  SERVICE_PROVISION_FIELDS.entryKey,
  SERVICE_PROVISION_FIELDS.userCode,
  SERVICE_PROVISION_FIELDS.recordDate,
  SERVICE_PROVISION_FIELDS.status,
  SERVICE_PROVISION_FIELDS.startHHMM,
  SERVICE_PROVISION_FIELDS.endHHMM,
  SERVICE_PROVISION_FIELDS.hasTransport,
  SERVICE_PROVISION_FIELDS.hasTransportPickup,
  SERVICE_PROVISION_FIELDS.hasTransportDropoff,
  SERVICE_PROVISION_FIELDS.hasMeal,
  SERVICE_PROVISION_FIELDS.hasBath,
  SERVICE_PROVISION_FIELDS.hasExtended,
  SERVICE_PROVISION_FIELDS.hasAbsentSupport,
  SERVICE_PROVISION_FIELDS.note,
  SERVICE_PROVISION_FIELDS.source,
  SERVICE_PROVISION_FIELDS.updatedByUPN,
  SERVICE_PROVISION_FIELDS.created,
  SERVICE_PROVISION_FIELDS.modified,
] as const;

// ──────────────────────────────────────────────────────────────
// Org master (SharePoint list: Org_Master)
// Internal names confirmed: OrgCode / OrgType / Audience / SortOrder / IsActive / Notes
// ──────────────────────────────────────────────────────────────

export const ORG_MASTER_LIST_TITLE = 'Org_Master' as const;

export const ORG_MASTER_FIELDS = {
  id: 'Id',
  title: 'Title',
  orgCode: 'OrgCode',
  orgType: 'OrgType',
  audience: 'Audience',
  sortOrder: 'SortOrder',
  isActive: 'IsActive',
  notes: 'Notes',
} as const;

export const ORG_MASTER_SELECT_FIELDS = [
  ORG_MASTER_FIELDS.id,
  ORG_MASTER_FIELDS.title,
  ORG_MASTER_FIELDS.orgCode,
  ORG_MASTER_FIELDS.orgType,
  ORG_MASTER_FIELDS.audience,
  ORG_MASTER_FIELDS.sortOrder,
  ORG_MASTER_FIELDS.isActive,
  ORG_MASTER_FIELDS.notes,
] as const;

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

// ──────────────────────────────────────────────────────────────
// Meeting Minutes (SharePoint list: MeetingMinutes)
// ──────────────────────────────────────────────────────────────

export const MEETING_MINUTES_LIST_TITLE = 'MeetingMinutes' as const;

export const MEETING_MINUTES_FIELDS = {
  id: 'Id',
  title: 'Title',
  meetingDate: 'MeetingDate',
  category: 'Category',
  summary: 'Summary',
  decisions: 'Decisions',
  actions: 'Actions',
  tags: 'Tags',
  relatedLinks: 'RelatedLinks',
  isPublished: 'IsPublished',
  chair: 'Chair',
  scribe: 'Scribe',
  attendees: 'Attendees',
  created: 'Created',
  modified: 'Modified',
} as const;

export const MEETING_MINUTES_SELECT_FIELDS = [
  MEETING_MINUTES_FIELDS.id,
  MEETING_MINUTES_FIELDS.title,
  MEETING_MINUTES_FIELDS.meetingDate,
  MEETING_MINUTES_FIELDS.category,
  MEETING_MINUTES_FIELDS.summary,
  MEETING_MINUTES_FIELDS.decisions,
  MEETING_MINUTES_FIELDS.actions,
  MEETING_MINUTES_FIELDS.tags,
  MEETING_MINUTES_FIELDS.relatedLinks,
  MEETING_MINUTES_FIELDS.isPublished,
  MEETING_MINUTES_FIELDS.chair,
  MEETING_MINUTES_FIELDS.scribe,
  MEETING_MINUTES_FIELDS.attendees,
  MEETING_MINUTES_FIELDS.created,
  MEETING_MINUTES_FIELDS.modified,
] as const;

export interface IUserMaster {
  Id: number;
  Title?: string | null;
  UserID: string;
  FullName: string;
  Furigana?: string | null;
  FullNameKana?: string | null;
  ContractDate?: string | null;
  ServiceStartDate?: string | null;
  ServiceEndDate?: string | null;
  IsHighIntensitySupportTarget?: boolean | null;
  IsSupportProcedureTarget?: boolean | null;  // 支援手順記録対象フラグ
  severeFlag?: boolean | null;
  IsActive?: boolean | null;
  TransportToDays?: string[] | null;
  TransportFromDays?: string[] | null;
  AttendanceDays?: string[] | null;
  RecipientCertNumber?: string | null;
  RecipientCertExpiry?: string | null;
  Modified?: string | null;
  Created?: string | null;

  // 事業所との契約情報 / 利用ステータス
  UsageStatus?: string | null;

  // 支給決定情報
  GrantMunicipality?: string | null;
  GrantPeriodStart?: string | null;
  GrantPeriodEnd?: string | null;
  DisabilitySupportLevel?: string | null;
  GrantedDaysPerMonth?: string | null;
  UserCopayLimit?: string | null;

  // 請求・加算関連情報
  TransportAdditionType?: string | null;
  MealAddition?: string | null;
  CopayPaymentMethod?: string | null;

  // 取得レベルマーカー（Repository から付与、UI 側で表示判定に使用可）
  __selectMode?: UserSelectMode;
}

export interface IUserMasterCreateDto {
  UserID?: string | null;  // システム採番のためフロントからは基本送信しない
  FullName: string;
  Furigana?: string | null;
  FullNameKana?: string | null;
  ContractDate?: string | null;
  ServiceStartDate?: string | null;
  ServiceEndDate?: string | null;
  IsHighIntensitySupportTarget?: boolean | null;
  IsSupportProcedureTarget?: boolean | null;  // 支援手順記録対象フラグ
  severeFlag?: boolean | null;
  IsActive?: boolean | null;
  TransportToDays?: string[] | null;
  TransportFromDays?: string[] | null;
  AttendanceDays?: string[] | null;
  RecipientCertNumber?: string | null;
  RecipientCertExpiry?: string | null;

  // 事業所との契約情報 / 利用ステータス
  UsageStatus?: string | null;

  // 支給決定情報
  GrantMunicipality?: string | null;
  GrantPeriodStart?: string | null;
  GrantPeriodEnd?: string | null;
  DisabilitySupportLevel?: string | null;
  GrantedDaysPerMonth?: string | null;
  UserCopayLimit?: string | null;

  // 請求・加算関連情報
  TransportAdditionType?: string | null;
  MealAddition?: string | null;
  CopayPaymentMethod?: string | null;
}

export const joinSelect = (arr: readonly string[]) => arr.join(',');

export enum ListKeys {
  UsersMaster = 'Users_Master',
  StaffMaster = 'Staff_Master',
  ComplianceCheckRules = 'Compliance_CheckRules',

  DailyActivityRecords = 'DailyActivityRecords',
  IcebergAnalysis = 'Iceberg_Analysis',
  IcebergPdca = 'Iceberg_PDCA',
  SurveyTokusei = 'FormsResponses_Tokusei',
  OrgMaster = 'Org_Master',
  StaffAttendance = 'Staff_Attendance',
  DiagnosticsReports = 'Diagnostics_Reports',
  AttendanceUsers = 'AttendanceUsers',
  AttendanceDaily = 'AttendanceDaily',
  MeetingMinutes = 'MeetingMinutes',
  SupportTemplates = 'SupportTemplates',
}

export const LIST_CONFIG: Record<ListKeys, { title: string }> = {
  [ListKeys.UsersMaster]: { title: 'Users_Master' },
  [ListKeys.StaffMaster]: { title: 'Staff_Master' },
  [ListKeys.ComplianceCheckRules]: { title: 'Compliance_CheckRules' },

  [ListKeys.DailyActivityRecords]: { title: 'DailyActivityRecords' },
  [ListKeys.IcebergAnalysis]: { title: 'Iceberg_Analysis' },
  [ListKeys.IcebergPdca]: { title: 'Iceberg_PDCA' },
  [ListKeys.SurveyTokusei]: { title: 'FormsResponses_Tokusei' },
  [ListKeys.OrgMaster]: { title: 'Org_Master' },
  [ListKeys.StaffAttendance]: { title: 'Staff_Attendance' },
  [ListKeys.DiagnosticsReports]: { title: 'Diagnostics_Reports' },
  [ListKeys.AttendanceUsers]: { title: 'AttendanceUsers' },
  [ListKeys.AttendanceDaily]: { title: 'AttendanceDaily' },
  [ListKeys.MeetingMinutes]: { title: 'MeetingMinutes' },
  [ListKeys.SupportTemplates]: { title: 'SupportTemplates' },
};

export const FIELD_MAP = {
  Users_Master: {
    id: 'Id',
    title: 'Title',
    userId: 'UserID',
    fullName: 'FullName',
    furigana: 'Furigana',
    fullNameKana: 'FullNameKana',
    contractDate: 'ContractDate',
    serviceStartDate: 'ServiceStartDate',
    serviceEndDate: 'ServiceEndDate',
    isHighIntensitySupportTarget: 'IsHighIntensitySupportTarget',
    isSupportProcedureTarget: 'IsSupportProcedureTarget',
    severeFlag: 'severeFlag',
    isActive: 'IsActive',
    transportToDays: 'TransportToDays',
    transportFromDays: 'TransportFromDays',
    attendanceDays: 'AttendanceDays',
    recipientCertNumber: 'RecipientCertNumber',
    recipientCertExpiry: 'RecipientCertExpiry',
    modified: 'Modified',
    created: 'Created',
    // ── 支給決定・請求加算（DETAIL/FULL モード用） ──
    usageStatus: 'UsageStatus',
    grantMunicipality: 'GrantMunicipality',
    grantPeriodStart: 'GrantPeriodStart',
    grantPeriodEnd: 'GrantPeriodEnd',
    disabilitySupportLevel: 'DisabilitySupportLevel',
    grantedDaysPerMonth: 'GrantedDaysPerMonth',
    userCopayLimit: 'UserCopayLimit',
    transportAdditionType: 'TransportAdditionType',
    mealAddition: 'MealAddition',
    copayPaymentMethod: 'CopayPaymentMethod',
  },
  Staff_Master: {
    id: 'Id',
    title: 'Title',
    staffId: 'StaffID',
    fullName: 'FullName',
    furigana: 'Furigana',
    fullNameKana: 'FullNameKana',
    jobTitle: 'JobTitle',
    employmentType: 'EmploymentType',
    rbacRole: 'RBACRole',
  role: 'Role',
  isActive: 'IsActive',
    department: 'Department',
    workDaysText: 'Work_x0020_Days',
  workDays: 'WorkDays',
  baseShiftStartTime: 'BaseShiftStartTime',
  baseShiftEndTime: 'BaseShiftEndTime',
  baseWorkingDays: 'BaseWorkingDays',
    hireDate: 'HireDate',
    resignDate: 'ResignDate',
    email: 'Email',
    phone: 'Phone',
    certifications: 'Certifications',
  },
  Staff_Attendance: {
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
  },
  Org_Master: ORG_MASTER_FIELDS,
  Schedules: {
    // Standard SharePoint columns
    id: 'Id',
    title: 'Title',
    created: 'Created',
    modified: 'Modified',

    // Phase 1 mandatory fields (validated in app-test staging)
    EventDate: 'EventDate', // DateTime
    EndDate: 'EndDate',     // DateTime
    Status: 'Status',       // Choice
    ServiceType: 'ServiceType', // Text
    cr014_personType: 'cr014_personType',  // Choice: User/Staff/Org
    cr014_personId: 'cr014_personId',      // Text
    cr014_personName: 'cr014_personName',  // Text (optional)
    AssignedStaffId: 'AssignedStaffId',    // Text (optional)
    TargetUserId: 'TargetUserId',          // Text (optional)
    RowKey: 'RowKey',                      // Text (identifier)
    cr014_dayKey: 'cr014_dayKey',          // DateTime → normalize to YYYY-MM-DD
    MonthKey: 'MonthKey',                  // Text: YYYY-MM
    cr014_fiscalYear: 'cr014_fiscalYear',  // Text
    cr014_orgAudience: 'cr014_orgAudience', // Text (optional)
    Note: 'Note',                          // Text (optional notes)
    CreatedAt: 'CreatedAt',                // DateTime (metadata)
    UpdatedAt: 'UpdatedAt',                // DateTime (metadata)

    // Legacy aliases (kept for backwards compatibility)
    start: 'EventDate',
    end: 'EndDate',
    notes: 'Note',
    rowKey: 'RowKey',
    dayKey: 'cr014_dayKey',
    monthKey: 'MonthKey',
    staffIds: 'AssignedStaffId',
    targetUserIds: 'TargetUserId',
  },
} as const;

/**
 * SupportTemplates list field mappings (確定版: 2026-02-12)
 *
 * ✅ 実内部名（Fields API で確認済み）
 * - UserCode0, RowNo0, TimeSlot0, Activity0, PersonManual0, SupporterManual0, version（⚠️小文字）
 * - IsActive（存在確認済み）
 *
 * ⚠️ 重要: intensity は version（Version0ではなく小文字!）
 *
 * 🎯 戦略:
 * - Phase 1: UserID === userCode（ドメイン側で I022、SharePoint側でも UserCode0=I022）
 * - Phase 2: UserID統一列追加後に UserCode0 から移行
 *
 * 📊 必須列（常に取得）:
 * - Id, UserCode0, RowNo0, Activity0, SupporterManual0, TimeSlot0, PersonManual0, version
 * - Created, Modified（SharePoint標準）
 *
 * 🔧 オプション列（フィルタリング用）:
 * - IsActive（有効フラグ：true/false）
 */


/**
 * DailyActivityRecords リスト用フィールド定義（内部名）
 * Fields API で確認済み: UserCode, RecordDate, TimeSlot, Observation, Behavior, version, duration, Order
 *
 * NOTE: `intensity` → `version` と `duration` → `duration` は SharePoint 内部名が小文字。
 * これはレガシースキーマの仕様であり、意図的なマッピング（変更不可）。
 */
export const FIELD_MAP_DAILY_ACTIVITY = {
  id: 'Id',
  userId: 'UserCode',
  recordDate: 'RecordDate',
  timeSlot: 'TimeSlot',
  planSlotKey: 'PlanSlotKey',
  plannedActivity: 'PlannedActivity',
  recordedAtText: 'RecordedAtText',
  observation: 'Observation',
  behavior: 'Behavior',
  intensity: 'version',
  duration: 'duration',
  order: 'Order',
  created: 'Created',
  modified: 'Modified',
} as const;

/**
 * Iceberg_Analysis リスト用フィールド定義（内部名）
 * JSON ペイロードに IcebergSnapshot 全体を格納するリスト
 */
export const FIELD_MAP_ICEBERG_ANALYSIS = {
  id: 'Id',
  title: 'Title',
  entryHash: 'EntryHash',
  sessionId: 'SessionId',
  userId: 'UserId',
  payloadJson: 'PayloadJson',
  schemaVersion: 'SchemaVersion',
  updatedAt: 'UpdatedAt',
} as const;

export const FIELD_MAP_ICEBERG_PDCA = {
  id: 'Id',
  userId: 'UserID0',
  title: 'Title',
  summary: 'Summary0',
  phase: 'Phase0',
  createdAt: 'Created',
  updatedAt: 'Modified',
} as const;

// ──────────────────────────────────────────────────────────────
// Diagnostics_Reports リスト
// ──────────────────────────────────────────────────────────────
// 環境診断結果を記録するリスト
//
// 内部名が違う場合（e.g., "Report_x0020_Link"）の対応方法：
// - 以下の FIELD_MAP_DIAGNOSTICS_REPORTS を修正するだけで OK
// - 例: reportLink: 'Report_x0020_Link' と変更すれば全コード自動対応
// ──────────────────────────────────────────────────────────────

export const DIAGNOSTICS_REPORTS_LIST_TITLE = 'Diagnostics_Reports' as const;

/**
 * Diagnostics_Reports リスト用フィールド定義（内部名マップ）
 *
 * 使用方法：
 * - コード内では logicalName（左側）を使用
 * - SharePoint API呼び出し時は value（右側）の内部名を使用
 *
 * 内部名が変わった場合:
 * - このオブジェクトの value のみ修正すれば、全コード自動対応
 *
 * @example
 * // ✅ 使用パターン
 * const fieldName = FIELD_MAP_DIAGNOSTICS_REPORTS.reportLink;
 * // fieldName = 'Report_x0020_Link' (内部名)
 *
 * // ❌ 非推奨（内部名をハードコード）
 * const fieldName = 'Report_x0020_Link';
 */
export const FIELD_MAP_DIAGNOSTICS_REPORTS = {
  id: 'Id',                    // SharePoint システムフィールド
  title: 'Title',              // 一意キー: health:<tenant>:<site>
  overall: 'Overall',          // Choice: pass | warn | fail
  topIssue: 'TopIssue',        // 最上位課題（1行）
  summaryText: 'SummaryText',  // 詳細サマリー（複数行）
  reportLink: 'ReportLink',    // 診断レポートへのリンク
  notified: 'Notified',        // 通知フラグ（Power Automate制御）
  notifiedAt: 'NotifiedAt',    // 通知日時
  created: 'Created',          // SharePoint システムフィールド
  modified: 'Modified',        // SharePoint システムフィールド
} as const;

/**
 * Diagnostics_Reports の select フィールド（固定）
 *
 * Power Automate/SharePoint は環境で返却形式が微妙に異なるため、
 * 取得列を固定しておくと、互換性問題を最小化できます。
 *
 * 全キーを field map 経由で定義しているため、内部名変更時は
 * FIELD_MAP_DIAGNOSTICS_REPORTS を修正するだけで OK
 */
export const DIAGNOSTICS_REPORTS_SELECT_FIELDS = [
  FIELD_MAP_DIAGNOSTICS_REPORTS.id,
  FIELD_MAP_DIAGNOSTICS_REPORTS.title,
  FIELD_MAP_DIAGNOSTICS_REPORTS.overall,
  FIELD_MAP_DIAGNOSTICS_REPORTS.topIssue,
  FIELD_MAP_DIAGNOSTICS_REPORTS.summaryText,
  FIELD_MAP_DIAGNOSTICS_REPORTS.reportLink,
  FIELD_MAP_DIAGNOSTICS_REPORTS.notified,
  FIELD_MAP_DIAGNOSTICS_REPORTS.notifiedAt,
  FIELD_MAP_DIAGNOSTICS_REPORTS.created,
  FIELD_MAP_DIAGNOSTICS_REPORTS.modified,
] as const;



export const DAILY_ACTIVITY_SELECT_FIELDS = [
  FIELD_MAP_DAILY_ACTIVITY.id,
  FIELD_MAP_DAILY_ACTIVITY.userId,
  FIELD_MAP_DAILY_ACTIVITY.recordDate,
  FIELD_MAP_DAILY_ACTIVITY.timeSlot,
  FIELD_MAP_DAILY_ACTIVITY.planSlotKey,
  FIELD_MAP_DAILY_ACTIVITY.plannedActivity,
  FIELD_MAP_DAILY_ACTIVITY.recordedAtText,
  FIELD_MAP_DAILY_ACTIVITY.observation,
  FIELD_MAP_DAILY_ACTIVITY.behavior,
  FIELD_MAP_DAILY_ACTIVITY.intensity,
  FIELD_MAP_DAILY_ACTIVITY.duration,
  FIELD_MAP_DAILY_ACTIVITY.order,
  FIELD_MAP_DAILY_ACTIVITY.created,
] as const;

export const ICEBERG_PDCA_SELECT_FIELDS = [
  FIELD_MAP_ICEBERG_PDCA.id,
  FIELD_MAP_ICEBERG_PDCA.userId,
  FIELD_MAP_ICEBERG_PDCA.title,
  FIELD_MAP_ICEBERG_PDCA.summary,
  FIELD_MAP_ICEBERG_PDCA.phase,
  FIELD_MAP_ICEBERG_PDCA.createdAt,
  FIELD_MAP_ICEBERG_PDCA.updatedAt,
] as const;

export const FIELD_MAP_SURVEY_TOKUSEI = {
  id: 'Id',
  responseId: 'ResponseId',
  responderEmail: 'ResponderEmail',
  responderName: 'ResponderName',
  fillDate: 'FillDate',
  targetUserName: 'TargetUserName',
  guardianName: 'GuardianName',
  relation: 'Relation',
  heightCm: 'HeightCm',
  weightKg: 'WeightKg',
  strengths: 'Strengths',
  notes: 'Notes',
  created: 'Created',

  // -- Forms メタ（SP 物理列あり） --
  formRowId: 'FormRowId',
  startTime: 'StartTime',
  endTime: 'EndTime',

  // -- 対人関係（SP 物理列あり） --
  relationalDifficulties: 'RelationalDifficulties',
  situationalUnderstanding: 'SituationalUnderstanding',

  // -- 感覚（5感別 — SP 物理列あり） --
  hearing: 'Hearing',
  vision: 'Vision',
  touch: 'Touch',
  smell: 'Smell',
  taste: 'Taste',
  sensoryMultiSelect: 'SensoryMultiSelect',
  sensoryFreeText: 'SensoryFreeText',

  // -- こだわり（SP 物理列あり） --
  difficultyWithChanges: 'DifficultyWithChanges',
  interestInParts: 'InterestInParts',
  repetitiveBehaviors: 'RepetitiveBehaviors',
  fixedHabits: 'FixedHabits',

  // -- コミュニケーション（SP 物理列あり） --
  comprehensionDifficulty: 'ComprehensionDifficulty',
  expressionDifficulty: 'ExpressionDifficulty',
  interactionDifficulty: 'InteractionDifficulty',

  // -- 行動（SP 物理列あり） --
  behaviorMultiSelect: 'BehaviorMultiSelect',
  behaviorEpisodes: 'BehaviorEpisodes',
} as const;

/**
 * Tokusei の派生フィールド（SP 物理列なし）
 *
 * ⚠️ OData $select には使用不可 — 400 エラーの原因になる。
 * Adapter 層 (mapSpRowToTokuseiResponse) が個別 SP 列から動的に合成する。
 */
export const FIELD_DERIVED_TOKUSEI = {
  personality: 'Personality',
  sensoryFeatures: 'SensoryFeatures',
  behaviorFeatures: 'BehaviorFeatures',
} as const;

/** FIELD_MAP_SURVEY_TOKUSEI（物理列）+ FIELD_DERIVED_TOKUSEI（派生列）の統合 */
export const FIELD_MAP_SURVEY_TOKUSEI_ALL = {
  ...FIELD_MAP_SURVEY_TOKUSEI,
  ...FIELD_DERIVED_TOKUSEI,
} as const;

// ──────────────────────────────────────────────────────────────
// SupportTemplates リスト
// ──────────────────────────────────────────────────────────────
// 支援手順テンプレートを記録するリスト
// 注意：内部名には "0" サフィックスが付与されている (UserCode0, RowNo0, etc.)
// ──────────────────────────────────────────────────────────────

export const SUPPORT_TEMPLATES_LIST_TITLE = 'SupportTemplates' as const;

/**
 * SupportTemplates リスト用フィールド定義（内部名マップ）
 *
 * 重要: SharePoint で Fields API 取得時、実際の内部名には "0" サフィックスが付与されています
 * - userCode → UserCode0
 * - rowNo → RowNo0
 * - timeSlot → TimeSlot0
 * - activity → Activity0
 * - personManual → PersonManual0
 * - supporterManual → SupporterManual0
 *
 * 使用方法：
 * - コード内では logicalName（左側）を使用
 * - SharePoint API呼び出し時は value（右側）の内部名を使用
 *
 * @example
 * // ✅ 使用パターン
 * const orderby = FIELD_MAP_SUPPORT_TEMPLATES.userCode;
 * // orderby = 'UserCode0' (内部名)
 *
 * // ❌ 非推奨（内部名をハードコード）
 * const orderby = 'userCode'; // これは 500 エラーになる
 */
export const FIELD_MAP_SUPPORT_TEMPLATES = {
  id: 'Id',
  title: 'Title',
  userCode: 'UserCode0',
  rowNo: 'RowNo0',
  timeSlot: 'TimeSlot0',
  activity: 'Activity0',
  personManual: 'PersonManual0',
  supporterManual: 'SupporterManual0',
  created: 'Created',
  modified: 'Modified',
} as const;

export const SUPPORT_TEMPLATES_SELECT_FIELDS = [
  FIELD_MAP_SUPPORT_TEMPLATES.id,
  FIELD_MAP_SUPPORT_TEMPLATES.title,
  FIELD_MAP_SUPPORT_TEMPLATES.userCode,
  FIELD_MAP_SUPPORT_TEMPLATES.rowNo,
  FIELD_MAP_SUPPORT_TEMPLATES.timeSlot,
  FIELD_MAP_SUPPORT_TEMPLATES.activity,
  FIELD_MAP_SUPPORT_TEMPLATES.personManual,
  FIELD_MAP_SUPPORT_TEMPLATES.supporterManual,
  FIELD_MAP_SUPPORT_TEMPLATES.created,
  FIELD_MAP_SUPPORT_TEMPLATES.modified,
] as const;

// Exclude fields we know are missing based on 400 error cascade; allow others
export const SURVEY_TOKUSEI_SELECT_FIELDS: readonly string[] = Object.entries(FIELD_MAP_SURVEY_TOKUSEI)
  .filter(([key]) =>
    key !== 'responseId' &&
    key !== 'guardianName' &&
    key !== 'relation' &&
    key !== 'heightCm' &&
    key !== 'weightKg' &&
    key !== 'personality' &&
    key !== 'sensoryFeatures' &&
    key !== 'behaviorFeatures'
  )
  .map(([, value]) => value);
/**
 * 動的に "存在する列だけ" を select フィールドに含める
 * テナント列差分・列削除・列名変更に対応
 */
export async function buildSurveyTokuseiSelectFields(
  getFieldNames: () => Promise<Set<string>>
): Promise<string[]> {
  try {
    const availableFields = await getFieldNames();
    const availableLower = new Set(Array.from(availableFields).map((name) => name.toLowerCase()));
    const allCandidates = Object.values(FIELD_MAP_SURVEY_TOKUSEI);
    const selected = allCandidates.filter((fieldName) => fieldName === 'Id' || availableLower.has(fieldName.toLowerCase()));

    // 🔍 デバッグ出力：何が存在して何が除外されたか可視化
    console.debug('[TokuseiSelect] 📊 Fields API から取得した内部名（最初の50個）:', Array.from(availableFields).slice(0, 50));
    console.debug('[TokuseiSelect] 📋 FIELD_MAP から candidate（全数）:', allCandidates);
    console.debug('[TokuseiSelect] ✅ selected（存在する列）:', selected);
    console.debug('[TokuseiSelect] ❌ dropped（見つからない列）:', allCandidates.filter(x => !selected.includes(x)));

    return selected;
  } catch (error) {
    // Fallback: エラー時は既知フィールドの除外版を使う
    console.warn('[buildSurveyTokuseiSelectFields] Fields API 取得失敗、fallback を使用:', error);
    return Array.from(SURVEY_TOKUSEI_SELECT_FIELDS);
  }
}

/**
 * 汎用的な動的 $select ビルダー（テナント差分に耐える）
 * 存在するフィールドだけを $select に含めて 400 エラーを防ぐ
 */
export function buildSelectFieldsFromMap(
  fieldMap: Record<string, string>,
  existingInternalNames?: readonly string[],
  opts?: { alwaysInclude?: readonly string[]; fallback?: readonly string[] }
): readonly string[] {
  const alwaysInclude = (opts?.alwaysInclude ?? ['Id']).map((s) => String(s));
  const existing = new Set((existingInternalNames ?? []).map((x) => String(x).toLowerCase()));

  const candidates = Object.values(fieldMap)
    .map((v) => String(v))
    .filter(Boolean);

  // Fields API 取得失敗時は安全な fallback を返す（400 回避優先）
  if (existing.size === 0) {
    const fb = opts?.fallback ?? alwaysInclude;
    return Array.from(new Set(fb.map((x) => (x.toLowerCase() === 'id' ? 'Id' : x))));
  }

  const selected = candidates.filter((v) => existing.has(v.toLowerCase()));
  const merged = Array.from(
    new Set([...alwaysInclude, ...selected].map((x) => (x.toLowerCase() === 'id' ? 'Id' : x)))
  );

  return merged;
}



/**
 * DailyActivityRecords リスト用の動的 $select ビルダー
 */
export function buildDailyActivitySelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(FIELD_MAP_DAILY_ACTIVITY, existingInternalNames, {
    alwaysInclude: ['Id', 'Created', 'Modified'],
    fallback: [
      'Id',
      'UserCode',
      'RecordDate',
      'TimeSlot',
      'PlanSlotKey',
      'PlannedActivity',
      'RecordedAtText',
      'Observation',
      'Behavior',
      'version',
      'duration',
      'Order',
      'Created',
      'Modified',
    ],
  });
}

/**
 * Iceberg PDCA リスト用の動的 $select ビルダー
 */
export function buildIcebergPdcaSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(FIELD_MAP_ICEBERG_PDCA, existingInternalNames, {
    alwaysInclude: ['Id', 'Created', 'Modified'],
    fallback: ['Id', 'Created'],
  });
}

/**
 * SupportTemplates リスト用の動的 $select ビルダー
 *
 * 重要：このリストの内部名には "0" サフィックスが付与されている
 * (UserCode0, RowNo0, TimeSlot0, Activity0, PersonManual0, SupporterManual0)
 */
export function buildSupportTemplatesSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(FIELD_MAP_SUPPORT_TEMPLATES, existingInternalNames, {
    alwaysInclude: ['Id', 'Created', 'Modified'],
    fallback: ['Id', 'Created'],
  });
}

/**
 * Handoff リスト用の FIELD_MAP（HANDOFF_TIMELINE_COLUMNS から抽出）
 */
export const FIELD_MAP_HANDOFF = {
  id: 'Id',
  title: 'Title',
  message: 'Message',
  userCode: 'UserCode',
  userDisplayName: 'UserDisplayName',
  category: 'Category',
  severity: 'Severity',
  status: 'Status',
  timeBand: 'TimeBand',
  meetingSessionKey: 'MeetingSessionKey',
  sourceType: 'SourceType',
  sourceId: 'SourceId',
  sourceUrl: 'SourceUrl',
  sourceKey: 'SourceKey',
  sourceLabel: 'SourceLabel',
  createdBy: 'CreatedBy',
  createdAt: 'CreatedAt',
  modifiedBy: 'ModifiedBy',
  modifiedAt: 'ModifiedAt',
  created: 'Created',
  modified: 'Modified',
} as const;

/**
 * Handoff リスト用の動的 $select ビルダー
 */
export function buildHandoffSelectFields(existingInternalNames?: readonly string[]): readonly string[] {
  return buildSelectFieldsFromMap(FIELD_MAP_HANDOFF, existingInternalNames, {
    alwaysInclude: ['Id', 'Title', 'Created', 'Modified'],
    fallback: ['Id', 'Title', 'Message', 'UserCode', 'Created'],
  });
}

// ── CORE: 一覧表示用（軽量 / 20列） ──
export const USERS_SELECT_FIELDS_CORE = [
  FIELD_MAP.Users_Master.id,
  FIELD_MAP.Users_Master.title,
  FIELD_MAP.Users_Master.userId,
  FIELD_MAP.Users_Master.fullName,
  FIELD_MAP.Users_Master.furigana,
  FIELD_MAP.Users_Master.fullNameKana,
  FIELD_MAP.Users_Master.contractDate,
  FIELD_MAP.Users_Master.serviceStartDate,
  FIELD_MAP.Users_Master.serviceEndDate,
  FIELD_MAP.Users_Master.isHighIntensitySupportTarget,
  FIELD_MAP.Users_Master.isSupportProcedureTarget,
  FIELD_MAP.Users_Master.severeFlag,
  FIELD_MAP.Users_Master.isActive,
  FIELD_MAP.Users_Master.transportToDays,
  FIELD_MAP.Users_Master.transportFromDays,
  FIELD_MAP.Users_Master.attendanceDays,
  FIELD_MAP.Users_Master.recipientCertNumber,
  FIELD_MAP.Users_Master.recipientCertExpiry,
  FIELD_MAP.Users_Master.modified,
  FIELD_MAP.Users_Master.created,
] as const;

// ── DETAIL: 詳細画面用（CORE + 支給決定情報） ──
export const USERS_SELECT_FIELDS_DETAIL = [
  ...USERS_SELECT_FIELDS_CORE,
  FIELD_MAP.Users_Master.usageStatus,
  FIELD_MAP.Users_Master.grantMunicipality,
  FIELD_MAP.Users_Master.grantPeriodStart,
  FIELD_MAP.Users_Master.grantPeriodEnd,
  FIELD_MAP.Users_Master.disabilitySupportLevel,
  FIELD_MAP.Users_Master.grantedDaysPerMonth,
  FIELD_MAP.Users_Master.userCopayLimit,
] as const;

// ── FULL: 請求・監査用（DETAIL + 加算情報） ──
export const USERS_SELECT_FIELDS_FULL = [
  ...USERS_SELECT_FIELDS_DETAIL,
  FIELD_MAP.Users_Master.transportAdditionType,
  FIELD_MAP.Users_Master.mealAddition,
  FIELD_MAP.Users_Master.copayPaymentMethod,
] as const;

// ── セレクトモード型 & リゾルバ ──
export type UserSelectMode = 'core' | 'detail' | 'full';

export function resolveUserSelectFields(mode: UserSelectMode = 'core'): readonly string[] {
  switch (mode) {
    case 'full':   return USERS_SELECT_FIELDS_FULL;
    case 'detail': return USERS_SELECT_FIELDS_DETAIL;
    default:       return USERS_SELECT_FIELDS_CORE;
  }
}

/** @deprecated Use USERS_SELECT_FIELDS_CORE instead */
export const USERS_SELECT_FIELDS_SAFE = USERS_SELECT_FIELDS_CORE;

export const STAFF_SELECT_FIELDS_CANONICAL = [
  FIELD_MAP.Staff_Master.id,
  FIELD_MAP.Staff_Master.title,
  FIELD_MAP.Staff_Master.staffId,
  FIELD_MAP.Staff_Master.fullName,
  FIELD_MAP.Staff_Master.jobTitle,
  FIELD_MAP.Staff_Master.employmentType,
  FIELD_MAP.Staff_Master.rbacRole,
  FIELD_MAP.Staff_Master.role,
  FIELD_MAP.Staff_Master.isActive,
  FIELD_MAP.Staff_Master.department,
  FIELD_MAP.Staff_Master.hireDate,
  FIELD_MAP.Staff_Master.resignDate,
  FIELD_MAP.Staff_Master.certifications,
  FIELD_MAP.Staff_Master.email,
  FIELD_MAP.Staff_Master.phone,
  FIELD_MAP.Staff_Master.furigana,
  FIELD_MAP.Staff_Master.fullNameKana,
  FIELD_MAP.Staff_Master.workDaysText,
  FIELD_MAP.Staff_Master.workDays,
  FIELD_MAP.Staff_Master.baseShiftStartTime,
  FIELD_MAP.Staff_Master.baseShiftEndTime,
  FIELD_MAP.Staff_Master.baseWorkingDays,
] as const;

export const USERS_SELECT_SAFE = joinSelect(USERS_SELECT_FIELDS_CORE as readonly string[]);
export const STAFF_SELECT = joinSelect(STAFF_SELECT_FIELDS_CANONICAL as readonly string[]);

// Backwards compatibility exports (legacy names still in use)
export const USERS_SELECT_FIELDS = USERS_SELECT_FIELDS_CORE;

// ──────────────────────────────────────────────────────────────
// Daily record list fields
// ──────────────────────────────────────────────────────────────

export const DAILY_FIELD_DATE = 'Date' as const;
export const DAILY_FIELD_START_TIME = 'StartTime' as const;
export const DAILY_FIELD_END_TIME = 'EndTime' as const;
export const DAILY_FIELD_LOCATION = 'Location' as const;
export const DAILY_FIELD_STAFF_ID = 'StaffIdId' as const;
export const DAILY_FIELD_USER_ID = 'UserIdId' as const;
export const DAILY_FIELD_NOTES = 'Notes' as const;
export const DAILY_FIELD_MEAL_LOG = 'MealLog' as const;
export const DAILY_FIELD_BEHAVIOR_LOG = 'BehaviorLog' as const;
export const DAILY_FIELD_DRAFT = 'Draft' as const;
export const DAILY_FIELD_STATUS = 'Status' as const;

// ──────────────────────────────────────────────────────────────
// Schedule list fields
// ──────────────────────────────────────────────────────────────

export const SCHEDULE_FIELD_START = 'EventDate' as const;
export const SCHEDULE_FIELD_END = 'EndDate' as const;
export const SCHEDULE_FIELD_STATUS = 'Status' as const;
export const SCHEDULE_FIELD_CATEGORY = 'cr014_category' as const;
export const SCHEDULE_FIELD_SERVICE_TYPE = 'ServiceType' as const;
export const SCHEDULE_FIELD_PERSON_TYPE = 'cr014_personType' as const;
export const SCHEDULE_FIELD_PERSON_ID = 'cr014_personId' as const;
export const SCHEDULE_FIELD_PERSON_NAME = 'cr014_personName' as const;
export const SCHEDULE_FIELD_EXTERNAL_NAME = 'cr014_externalPersonName' as const;
export const SCHEDULE_FIELD_EXTERNAL_ORG = 'cr014_externalPersonOrg' as const;
export const SCHEDULE_FIELD_EXTERNAL_CONTACT = 'cr014_externalPersonContact' as const;
export const SCHEDULE_FIELD_STAFF_IDS = 'cr014_staffIds' as const;
export const SCHEDULE_FIELD_STAFF_NAMES = 'cr014_staffNames' as const;
export const SCHEDULE_FIELD_BILLING_FLAGS = 'BillingFlags' as const;
export const SCHEDULE_FIELD_NOTE = 'Note' as const;
export const SCHEDULE_FIELD_ASSIGNED_STAFF = 'AssignedStaff' as const;
export const SCHEDULE_FIELD_ASSIGNED_STAFF_ID = 'AssignedStaffId' as const;
export const SCHEDULE_FIELD_TARGET_USER = 'TargetUser' as const;
export const SCHEDULE_FIELD_TARGET_USER_ID = 'TargetUserId' as const;
export const SCHEDULE_FIELD_RELATED_RESOURCE = 'RelatedResource' as const;
export const SCHEDULE_FIELD_RELATED_RESOURCE_ID = 'RelatedResourceId' as const;
export const SCHEDULE_FIELD_ROW_KEY = 'RowKey' as const;
export const SCHEDULE_FIELD_DAY_KEY = 'cr014_dayKey' as const;
export const SCHEDULE_FIELD_FISCAL_YEAR = 'cr014_fiscalYear' as const;
export const SCHEDULE_FIELD_MONTH_KEY = 'MonthKey' as const;
export const SCHEDULE_FIELD_ENTRY_HASH = 'EntryHash' as const;
export const SCHEDULE_FIELD_SUB_TYPE = 'SubType' as const;
export const SCHEDULE_FIELD_ORG_AUDIENCE = 'cr014_orgAudience' as const;
export const SCHEDULE_FIELD_ORG_RESOURCE_ID = 'cr014_resourceId' as const;
export const SCHEDULE_FIELD_ORG_EXTERNAL_NAME = 'ExternalOrgName' as const;
export const SCHEDULE_FIELD_DAY_PART = 'cr014_dayPart' as const;
export const SCHEDULE_FIELD_CREATED_AT = 'CreatedAt' as const;
export const SCHEDULE_FIELD_UPDATED_AT = 'UpdatedAt' as const;

export const SCHEDULES_BASE_FIELDS = [
  'Id',
  'Title',
  SCHEDULE_FIELD_START,
  SCHEDULE_FIELD_END,
  SCHEDULE_FIELD_STATUS,
  SCHEDULE_FIELD_CATEGORY,
  SCHEDULE_FIELD_SERVICE_TYPE,
  SCHEDULE_FIELD_PERSON_TYPE,
  SCHEDULE_FIELD_PERSON_ID,
  SCHEDULE_FIELD_PERSON_NAME,
  SCHEDULE_FIELD_EXTERNAL_NAME,
  SCHEDULE_FIELD_EXTERNAL_ORG,
  SCHEDULE_FIELD_EXTERNAL_CONTACT,
  SCHEDULE_FIELD_STAFF_IDS,
  SCHEDULE_FIELD_STAFF_NAMES,
  SCHEDULE_FIELD_BILLING_FLAGS,
  SCHEDULE_FIELD_NOTE,
  SCHEDULE_FIELD_ASSIGNED_STAFF,
  SCHEDULE_FIELD_ASSIGNED_STAFF_ID,
  SCHEDULE_FIELD_TARGET_USER,
  SCHEDULE_FIELD_TARGET_USER_ID,
  SCHEDULE_FIELD_RELATED_RESOURCE,
  SCHEDULE_FIELD_RELATED_RESOURCE_ID,
  SCHEDULE_FIELD_ROW_KEY,
  SCHEDULE_FIELD_ENTRY_HASH,
  SCHEDULE_FIELD_DAY_KEY,
  SCHEDULE_FIELD_FISCAL_YEAR,
  SCHEDULE_FIELD_MONTH_KEY,
  SCHEDULE_FIELD_SUB_TYPE,
  SCHEDULE_FIELD_ORG_AUDIENCE,
  SCHEDULE_FIELD_ORG_RESOURCE_ID,
  SCHEDULE_FIELD_ORG_EXTERNAL_NAME,
  SCHEDULE_FIELD_DAY_PART,
  SCHEDULE_FIELD_CREATED_AT,
  SCHEDULE_FIELD_UPDATED_AT,
  'Created',
  'Modified',
  '@odata.etag',
] as const;

// SharePoint OData URL制限対応：最小限のフィールドセット（フィルター条件に必要なフィールドを含む）
// 開発環境では存在しない可能性のあるカスタムフィールドを除外
export const SCHEDULES_MINIMAL_FIELDS = [
  'Id',           // SharePoint既定フィールド（必須）
  'Title',        // SharePoint既定フィールド（必須）
  'Created',      // SharePoint既定フィールド（必須）
  'Modified',     // SharePoint既定フィールド（必須）
  '@odata.etag',  // データ更新で必要
] as const;

// 開発環境で利用可能な場合に追加で試行するフィールド
export const SCHEDULES_DEVELOPMENT_OPTIONAL_FIELDS = [
  'EventDate',    // フィルター条件で必要（存在する場合）
  'EndDate',      // フィルター条件で必要（存在する場合）
  SCHEDULE_FIELD_CATEGORY, // フィルター条件で必要（存在する場合）
] as const;

export const SCHEDULES_COMMON_OPTIONAL_FIELDS = [] as const;

export const SCHEDULES_STAFF_TEXT_FIELDS = [] as const;

// URL制限対応：開発環境では短いフィールドセットを使用
const isVitestRuntime = typeof process !== 'undefined' && process.env?.VITEST === 'true';
const shouldUseMinimalScheduleFields =
  typeof window !== 'undefined' && window.location?.hostname === 'localhost' && !isVitestRuntime;

export const SCHEDULES_SELECT_FIELDS = joinSelect(
  shouldUseMinimalScheduleFields
    ? SCHEDULES_MINIMAL_FIELDS as readonly string[]
    : SCHEDULES_BASE_FIELDS as readonly string[]
);

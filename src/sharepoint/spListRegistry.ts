/**
 * SharePoint リスト レジストリ — 全33リストの Single Source of Truth
 *
 * 各エントリは以下を保持:
 * - key: プログラム内で使用するユニーク識別子
 * - displayName: UI / ログ表示用の日本語名
 * - resolve(): 実際のリスト名（またはGUID）を返す関数
 * - operations: このリストで行われる操作種別
 * - category: 機能カテゴリ
 * - lifecycle: 運用フェーズの定義 (required | optional | deprecated | experimental)
 */
import { readOptionalEnv } from '@/lib/env';
import { LIST_CONFIG, ListKeys } from '@/sharepoint/fields';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpListOperation = 'R' | 'W' | 'D';

export type SpListCategory =
  | 'master'
  | 'daily'
  | 'attendance'
  | 'schedule'
  | 'meeting'
  | 'handoff'
  | 'compliance'
  | 'other';

/** リストのライフサイクル：フェーズごとの振る舞いを定義 */
export type SpListLifecycle =
  | 'required'     // 必須。不在ならブート時エラー
  | 'optional'     // 任意。不在でも続行（404抑制）
  | 'deprecated'   // 廃止予定。利用時に警告、ブート時は基本スキップ
  | 'experimental'; // 実験的。Feature Flag との連動用

export interface SpListEntry {
  /** プログラム内のユニークキー */
  key: string;
  /** UI表示用の日本語名 */
  displayName: string;
  /** リスト名（タイトルまたは guid:xxx）を解決する関数 */
  resolve: () => string;
  /** このリストで行われる操作 */
  operations: readonly SpListOperation[];
  /** 機能カテゴリ */
  category: SpListCategory;
  /** 正常動作に必須なフィールド（内部名）のリスト */
  essentialFields?: readonly string[];
  /** 自己修復用のフィールド定義リスト */
  provisioningFields?: readonly import('@/lib/sp/types').SpFieldDef[];
  /** SharePoint リストテンプレート ID (100: List, 101: DocumentLibrary) */
  baseTemplate?: number;
  /** ライフサイクル段階。不在時の挙動やログレベルを決定する */
  lifecycle: SpListLifecycle;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 環境変数からリスト名を読み取り、なければフォールバックを返す。GUID 指定時は Title 回帰のため無視する。 */
const envOr = (envKey: string, fallback: string): string => {
  const envVal = readOptionalEnv(envKey);
  if (!envVal) return fallback;
  // GUID 形式 (guid:xxx) の場合は、物理制限・復旧性向上のため Title ベース (fallback) を優先
  if (envVal.toLowerCase().startsWith('guid:')) return fallback;
  return envVal;
};

/** LIST_CONFIG から直接タイトルを読み取る */
const fromConfig = (key: ListKeys): string => LIST_CONFIG[key].title;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const SP_LIST_REGISTRY: readonly SpListEntry[] = [

  // ── 1. マスタ系 ──────────────────────────────────────────
  {
    key: 'users_master',
    displayName: '利用者マスタ',
    resolve: () => envOr('VITE_SP_LIST_USERS', fromConfig(ListKeys.UsersMaster)),
    operations: ['R', 'W'],
    category: 'master',
    lifecycle: 'required', // 制度管理の基盤となるため required
    essentialFields: [
      'UserID', 'FullName', 'IsActive', 'UsageStatus'
    ],
    provisioningFields: [
      { internalName: 'UserID', type: 'Text', displayName: 'User ID', required: true, indexed: true, candidates: ['UserID', 'UserCode', 'User_x0020_ID'] },
      { internalName: 'FullName', type: 'Text', displayName: 'Full Name', required: true },
      { internalName: 'Furigana', type: 'Text', displayName: 'Furigana' },
      { internalName: 'FullNameKana', type: 'Text', displayName: 'Full Name Kana' },
      { internalName: 'ContractDate', type: 'DateTime', displayName: 'Contract Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'ServiceStartDate', type: 'DateTime', displayName: 'Service Start Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'ServiceEndDate', type: 'DateTime', displayName: 'Service End Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'IsActive', type: 'Boolean', displayName: 'Is Active', default: true },
      { internalName: 'UsageStatus', type: 'Text', displayName: 'Usage Status' },
      { internalName: 'IsHighIntensitySupportTarget', type: 'Boolean', displayName: 'High Intensity Target' },
      { internalName: 'IsSupportProcedureTarget', type: 'Boolean', displayName: 'Support Procedure Target' },
      { internalName: 'LastAssessmentDate', type: 'DateTime', displayName: 'Last Assessment Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'BehaviorScore', type: 'Number', displayName: 'Behavior Score' },
      { internalName: 'ChildBehaviorScore', type: 'Number', displayName: 'Child Behavior Score' },
      { internalName: 'ServiceTypesJson', type: 'Note', displayName: 'Service Types JSON', richText: false },
      { internalName: 'EligibilityCheckedAt', type: 'DateTime', displayName: 'Eligibility Checked At' },
    ],
  },
  {
    key: 'user_transport_settings',
    displayName: '利用者送迎設定',
    resolve: () => envOr('VITE_SP_LIST_USER_TRANSPORT', fromConfig(ListKeys.UserTransportSettings)),
    operations: ['R', 'W'],
    category: 'master',
    lifecycle: 'required',
    essentialFields: [
      'UserID', 'TransportToDays', 'TransportFromDays'
    ],
    provisioningFields: [
      { internalName: 'UserID', type: 'Text', displayName: 'User ID', required: true, indexed: true, candidates: ['UserID', 'User_x0020_ID'] },
      { internalName: 'TransportToDays', type: 'MultiChoice', displayName: 'Transport To Days', choices: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      { internalName: 'TransportFromDays', type: 'MultiChoice', displayName: 'Transport From Days', choices: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      { internalName: 'TransportCourse', type: 'Text', displayName: 'Transport Course' },
      { internalName: 'TransportSchedule', type: 'Note', displayName: 'Transport Schedule', richText: false },
      { internalName: 'TransportAdditionType', type: 'Text', displayName: 'Transport Addition Type' },
    ],
  },
  {
    key: 'user_benefit_profile',
    displayName: '利用者支給量プロファイル',
    resolve: () => envOr('VITE_SP_LIST_USER_BENEFIT', fromConfig(ListKeys.UserBenefitProfile)),
    operations: ['R', 'W'],
    category: 'master',
    lifecycle: 'required',
    essentialFields: [
      'UserID'
    ],
    provisioningFields: [
      { internalName: 'UserID', type: 'Text', displayName: 'User ID', required: true, indexed: true, candidates: ['UserID', 'User_x0020_ID'] },
      // RecipientCertNumber moved to _Ext to avoid 8KB limit
      { internalName: 'RecipientCertExpiry', type: 'DateTime', displayName: 'Recipient Cert Expiry', dateTimeFormat: 'DateOnly' },
      { internalName: 'GrantMunicipality', type: 'Text', displayName: 'Grant Municipality' },
      { internalName: 'GrantPeriodStart', type: 'DateTime', displayName: 'Grant Period Start', dateTimeFormat: 'DateOnly' },
      { internalName: 'GrantPeriodEnd', type: 'DateTime', displayName: 'Grant Period End', dateTimeFormat: 'DateOnly' },
      { internalName: 'DisabilitySupportLevel', type: 'Text', displayName: 'Disability Support Level' },
      { internalName: 'GrantedDaysPerMonth', type: 'Text', displayName: 'Granted Days Per Month' },
      { internalName: 'UserCopayLimit', type: 'Text', displayName: 'User Copay Limit' },
      { internalName: 'MealAddition', type: 'Text', displayName: 'Meal Addition' },
      { internalName: 'CopayPaymentMethod', type: 'Text', displayName: 'Copay Payment Method' },
    ],
  },
  {
    key: 'user_benefit_profile_ext',
    displayName: '利用者支給量プロファイル (拡充)',
    resolve: () => envOr('VITE_SP_LIST_USER_BENEFIT_EXT', fromConfig(ListKeys.UserBenefitProfileExt)),
    operations: ['R', 'W'],
    category: 'master',
    lifecycle: 'required',
    essentialFields: [
      'UserID', 'RecipientCertNumber'
    ],
    provisioningFields: [
      { internalName: 'UserID', type: 'Text', displayName: 'User ID', required: true, indexed: true, candidates: ['UserID', 'User_x0020_ID'] },
      { internalName: 'RecipientCertNumber', type: 'Text', displayName: 'Recipient Cert Number', required: true, candidates: ['RecipientCertNumber', 'RecipientCertNumber0', 'Recipient_x0020_Cert_x0020_Numbe'] },
    ],
  },
  {
    key: 'staff_master',
    displayName: '職員マスタ',
    resolve: () => envOr('VITE_SP_LIST_STAFF', fromConfig(ListKeys.StaffMaster)),
    operations: ['R'],
    category: 'master',
    lifecycle: 'required',
    essentialFields: [
      'StaffID', 'FullName', 'Role', 'RBACRole', 'IsActive', 'Department'
    ],
    provisioningFields: [
      { internalName: 'StaffID', type: 'Text', displayName: 'Staff ID', required: true },
      { internalName: 'FullName', type: 'Text', displayName: 'Full Name', required: true },
      { internalName: 'Furigana', type: 'Text', displayName: 'Furigana' },
      { internalName: 'FullNameKana', type: 'Text', displayName: 'Full Name Kana' },
      { internalName: 'JobTitle', type: 'Text', displayName: 'Job Title' },
      { internalName: 'EmploymentType', type: 'Text', displayName: 'Employment Type' },
      { internalName: 'RBACRole', type: 'Text', displayName: 'RBAC Role' },
      { internalName: 'Role', type: 'Text', displayName: 'Role' },
      { internalName: 'IsActive', type: 'Boolean', displayName: 'Is Active', default: true },
      { internalName: 'Department', type: 'Text', displayName: 'Department' },
      { internalName: 'Work_x0020_Days', type: 'Text', displayName: 'Work Days (Legacy)' },
      { internalName: 'WorkDays', type: 'MultiChoice', displayName: 'Work Days', choices: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      { internalName: 'BaseShiftStartTime', type: 'Text', displayName: 'Base Shift Start' },
      { internalName: 'BaseShiftEndTime', type: 'Text', displayName: 'Base Shift End' },
      { internalName: 'HireDate', type: 'DateTime', displayName: 'Hire Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'ResignDate', type: 'DateTime', displayName: 'Resign Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'Email', type: 'Text', displayName: 'Email' },
      { internalName: 'Phone', type: 'Text', displayName: 'Phone' },
      { internalName: 'Certifications', type: 'Note', displayName: 'Certifications' },
    ],
  },
  {
    key: 'org_master',
    displayName: '組織マスタ',
    resolve: () => envOr('VITE_SP_LIST_ORG_MASTER', fromConfig(ListKeys.OrgMaster)),
    operations: ['R'],
    category: 'master',
    lifecycle: 'required',
    essentialFields: ['OrgCode', 'OrgType', 'Audience'],
    provisioningFields: [
      { internalName: 'OrgCode', type: 'Text', displayName: 'Organization Code', required: true },
      { internalName: 'OrgType', type: 'Text', displayName: 'Organization Type' },
      { internalName: 'Audience', type: 'Text', displayName: 'Audience' },
      { internalName: 'SortOrder', type: 'Number', displayName: 'Sort Order' },
      { internalName: 'IsActive', type: 'Boolean', displayName: 'Active', default: true },
      { internalName: 'Notes', type: 'Note', displayName: 'Notes' },
    ],
  },
  {
    key: 'holiday_master',
    displayName: '祝日・休業日マスタ',
    resolve: () => envOr('VITE_SP_LIST_HOLIDAY_MASTER', fromConfig(ListKeys.HolidayMaster)),
    operations: ['R'],
    category: 'master',
    lifecycle: 'required',
  },

  // ── 2. 日々の記録系 ─────────────────────────────────────
  {
    key: 'support_record_daily',
    displayName: '日次支援記録 (親/統括)',
    resolve: () => envOr('VITE_SP_LIST_DAILY_RECORD', fromConfig(ListKeys.DailyRecordParent)),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required',
    // DAILY_RECORD_CANONICAL_ESSENTIALS と一致させる:
    //   Title / RecordDate / UserRowsJSON が必須。
    //   ReporterName は欠落時でも記録者不明として継続可能なためオプション。
    essentialFields: ['Title', 'RecordDate', 'UserRowsJSON'],
    provisioningFields: [
      { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly', indexed: true },
      { internalName: 'ReporterName', type: 'Text', displayName: 'Reporter Name' },
      { internalName: 'ReporterRole', type: 'Text', displayName: 'Reporter Role' },
      { internalName: 'UserRowsJSON', type: 'Note', displayName: 'User Rows JSON', required: true, richText: false },
      { internalName: 'UserCount', type: 'Number', displayName: 'User Count' },
      { internalName: 'ApprovalStatus', type: 'Text', displayName: 'Approval Status' },
      { internalName: 'ApprovedBy', type: 'Text', displayName: 'Approved By' },
      { internalName: 'ApprovedAt', type: 'DateTime', displayName: 'Approved At', dateTimeFormat: 'DateTime' },
    ],
  },
  {
    key: 'support_procedure_record_daily',
    displayName: '支援手順記録 (ISP詳細)',
    resolve: () => envOr('VITE_SP_LIST_PROCEDURE_RECORD', fromConfig(ListKeys.ProcedureRecordDaily)),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required', // 三層モデルの核となるため required
    essentialFields: [
      'UserCode', 'RecordDate', 'ExecutionStatus', 'PlanningSheetId'
    ],
    provisioningFields: [
      { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true, indexed: true },
      { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly', indexed: true },
      { internalName: 'ISPId', type: 'Text', displayName: 'ISP ID' },
      { internalName: 'PlanningSheetId', type: 'Text', displayName: 'Planning Sheet ID', required: true },
      { internalName: 'ProcedureText', type: 'Note', displayName: 'Procedure Text', richText: false },
      { internalName: 'ExecutionStatus', type: 'Text', displayName: 'Execution Status' },
      { internalName: 'TimeSlot', type: 'Text', displayName: 'Time Slot' },
      { internalName: 'Activity', type: 'Text', displayName: 'Activity' },
      { internalName: 'PerformedBy', type: 'Text', displayName: 'Performed By' },
      { internalName: 'PerformedAt', type: 'DateTime', displayName: 'Performed At' },
      { internalName: 'UserResponse', type: 'Note', displayName: 'User Response', richText: false },
      { internalName: 'SpecialNotes', type: 'Note', displayName: 'Special Notes', richText: false },
      { internalName: 'HandoffNotes', type: 'Note', displayName: 'Handoff Notes', richText: false },
    ],
  },
  {
    key: 'support_record_rows',
    displayName: '日次支援記録 (詳細行)',
    resolve: () => envOr('VITE_SP_LIST_PROCEDURE_RECORD_ROWS', 'DailyRecordRows'),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required',
    essentialFields: [
      'ParentID', 'UserID'
    ],
    provisioningFields: [
      { internalName: 'ParentID', type: 'Number', displayName: 'Parent ID', required: true, indexed: true },
      { internalName: 'UserID', type: 'Text', displayName: 'User ID', required: true, indexed: true },
      { internalName: 'Version', type: 'Number', displayName: 'Version', default: 1 },
      { internalName: 'Status', type: 'Text', displayName: 'Status' },
      { internalName: 'Payload', type: 'Note', displayName: 'Row Data JSON', richText: false },
      { internalName: 'RecordedAt', type: 'DateTime', displayName: 'Recorded At' },
    ],
  },
  {
    key: 'daily_activity_records',
    displayName: '日次活動記録',
    resolve: () => envOr('VITE_SP_LIST_DAILY_ACTIVITY_RECORDS', fromConfig(ListKeys.DailyActivityRecords)),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required',
    essentialFields: ['UserCode', 'RecordDate', 'TimeSlot', 'Observation'],
    provisioningFields: [
      { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true },
      { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly' },
      { internalName: 'TimeSlot', type: 'Text', displayName: 'Time Slot' },
      { internalName: 'PlanSlotKey', type: 'Text', displayName: 'Plan Slot Key' },
      { internalName: 'PlannedActivity', type: 'Text', displayName: 'Planned Activity' },
      { internalName: 'RecordedAtText', type: 'Text', displayName: 'Recorded At' },
      { internalName: 'Observation', type: 'Note', displayName: 'Observation' },
      { internalName: 'Behavior', type: 'Note', displayName: 'Behavior' },
      { internalName: 'version', type: 'Text', displayName: 'Intensity/Version' },
      { internalName: 'duration', type: 'Text', displayName: 'Duration' },
      { internalName: 'Order', type: 'Number', displayName: 'Order' },
    ],
  },
  {
    key: 'service_provision_records',
    displayName: 'サービス提供実績',
    resolve: () => envOr('VITE_SP_LIST_SERVICE_PROVISION', 'ServiceProvisionRecords'),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required', // 業務継続に不可欠なため required へ昇格
    essentialFields: [
      'EntryKey', 'UserCode', 'RecordDate', 'Status', 'StartHHMM', 'EndHHMM'
    ],
    provisioningFields: [
      { internalName: 'EntryKey', type: 'Text', displayName: 'Entry Key', required: true, indexed: true },
      { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true, indexed: true },
      { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly', indexed: true },
      { internalName: 'Status', type: 'Text', displayName: 'Status' },
      { internalName: 'StartHHMM', type: 'Text', displayName: 'Start Time (HHMM)' },
      { internalName: 'EndHHMM', type: 'Text', displayName: 'End Time (HHMM)' },
      { internalName: 'HasTransport', type: 'Boolean', displayName: 'Has Transport' },
      { internalName: 'HasTransportPickup', type: 'Boolean', displayName: 'Has Transport Pickup' },
      { internalName: 'HasTransportDropoff', type: 'Boolean', displayName: 'Has Transport Dropoff' },
      { internalName: 'HasMeal', type: 'Boolean', displayName: 'Has Meal' },
      { internalName: 'HasBath', type: 'Boolean', displayName: 'Has Bath' },
      { internalName: 'HasExtended', type: 'Boolean', displayName: 'Has Extended' },
      { internalName: 'HasAbsentSupport', type: 'Boolean', displayName: 'Has Absent Support' },
      { internalName: 'Note', type: 'Note', displayName: 'Note', richText: false },
      { internalName: 'Source', type: 'Text', displayName: 'Source' },
      { internalName: 'UpdatedByUPN', type: 'Text', displayName: 'UpdatedByUPN' },
    ],
  },
  {
    key: 'activity_diary',
    displayName: '活動日誌',
    resolve: () => envOr('VITE_SP_LIST_ACTIVITY_DIARY', 'ActivityDiary'),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required', // 業務継続に不可欠なため required へ昇格
    essentialFields: ['UserID', 'Date', 'Shift', 'Category'],
    provisioningFields: [
      { internalName: 'UserID', type: 'Text', displayName: 'User ID', required: true },
      { internalName: 'Date', type: 'DateTime', displayName: 'Date', required: true, dateTimeFormat: 'DateOnly', indexed: true },
      { internalName: 'Shift', type: 'Choice', displayName: 'Shift', choices: ['AM', 'PM', '1日'], required: true },
      { internalName: 'Category', type: 'Choice', displayName: 'Category', choices: ['請負', '個別', '外活動', '余暇'], required: true },
      { internalName: 'LunchAmount', type: 'Choice', displayName: 'Lunch Amount', choices: ['完食', '8割', '半分', '少量', 'なし'] },
      { internalName: 'ProblemBehavior', type: 'Boolean', displayName: 'Problem Behavior' },
      { internalName: 'Seizure', type: 'Boolean', displayName: 'Seizure' },
      { internalName: 'Goals', type: 'Note', displayName: 'Goals JSON', richText: false },
      { internalName: 'Notes', type: 'Note', displayName: 'Notes', richText: false },
    ],
  },

  // ── 3. 出席管理系 ──────────────────────────────────────
  {
    key: 'daily_attendance',
    displayName: '日次出欠',
    resolve: () => envOr('VITE_SP_LIST_ATTENDANCE', fromConfig(ListKeys.DailyAttendance)),
    operations: ['R', 'W'],
    category: 'attendance',
    lifecycle: 'required',
    essentialFields: ['UserID', 'Date', 'Status'],
    provisioningFields: [
      { internalName: 'UserID', type: 'Text', displayName: 'User ID', required: true },
      { internalName: 'Date', type: 'DateTime', displayName: 'Date', required: true, dateTimeFormat: 'DateOnly', indexed: true },
      { internalName: 'Status', type: 'Choice', displayName: 'Status', choices: ['通常', '欠席', '振替', '休止'], required: true },
      { internalName: 'IsTrial', type: 'Boolean', displayName: 'Trial' },
      { internalName: 'Notes', type: 'Note', displayName: 'Notes', richText: false },
    ],
  },
  {
    key: 'attendance_users',
    displayName: '出席管理ユーザー',
    resolve: () => envOr('VITE_SP_LIST_ATTENDANCE_USERS', fromConfig(ListKeys.AttendanceUsers)),
    operations: ['R'],
    category: 'attendance',
    lifecycle: 'required',
    essentialFields: [
      'UserCode', 'IsActive', 'UsageStatus', 'ServiceEndDate'
    ],
    provisioningFields: [
      { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true, indexed: true },
      { internalName: 'IsActive', type: 'Boolean', displayName: 'Is Active', default: true },
      { internalName: 'UsageStatus', type: 'Text', displayName: 'Usage Status' },
      { internalName: 'ServiceEndDate', type: 'DateTime', displayName: 'Service End Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'IsTransportTarget', type: 'Boolean', displayName: 'Is Transport Target' },
      { internalName: 'StandardMinutes', type: 'Number', displayName: 'Standard Minutes' },
    ],
  },
  {
    key: 'attendance_daily',
    displayName: '日次出席詳細',
    resolve: () => envOr('VITE_SP_LIST_ATTENDANCE_DAILY', fromConfig(ListKeys.AttendanceDaily)),
    operations: ['R', 'W'],
    category: 'attendance',
    lifecycle: 'required',
    // ATTENDANCE_DAILY_ESSENTIALS と同期
    essentialFields: ['UserCode', 'RecordDate', 'Status', 'CheckInAt'],
    provisioningFields: [
      { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true, indexed: true },
      { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly', indexed: true },
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
    ],
  },
  {
    key: 'staff_attendance',
    displayName: '職員出勤管理',
    resolve: () => envOr('VITE_SP_LIST_STAFF_ATTENDANCE', fromConfig(ListKeys.StaffAttendance)),
    operations: ['R', 'W'],
    category: 'attendance',
    lifecycle: 'required',
    essentialFields: ['StaffId', 'RecordDate', 'Status'],
    provisioningFields: [
      { internalName: 'StaffId', type: 'Text', displayName: 'Staff ID', required: true, indexed: true },
      { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly', indexed: true },
      { internalName: 'Status', type: 'Text', displayName: 'Status', required: true },
      { internalName: 'CheckInAt', type: 'DateTime', displayName: 'Check-in', dateTimeFormat: 'DateTime' },
      { internalName: 'CheckOutAt', type: 'DateTime', displayName: 'Check-out', dateTimeFormat: 'DateTime' },
      { internalName: 'IsFinalized', type: 'Boolean', displayName: 'Finalized', default: false },
      { internalName: 'Note', type: 'Note', displayName: 'Note' },
    ],
  },
  {
    key: 'transport_log',
    displayName: '送迎ステータスログ',
    resolve: () => envOr('VITE_SP_LIST_TRANSPORT_LOG', fromConfig(ListKeys.TransportLog)),
    operations: ['R', 'W'],
    category: 'attendance',
    lifecycle: 'required',
    essentialFields: ['UserCode', 'RecordDate', 'Direction', 'Status'],
    provisioningFields: [
      { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true, indexed: true },
      { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly', indexed: true },
      { internalName: 'Direction', type: 'Choice', displayName: 'Direction', choices: ['to', 'from'], required: true },
      { internalName: 'Status', type: 'Choice', displayName: 'Status', choices: ['pending', 'in-progress', 'arrived', 'absent', 'self'], required: true },
      { internalName: 'Method', type: 'Choice', displayName: 'Method', choices: ['facility-vehicle', 'family', 'taxi', 'walk', 'self', 'other'] },
      { internalName: 'ScheduledTime', type: 'Text', displayName: 'Scheduled Time' },
      { internalName: 'ActualTime', type: 'Text', displayName: 'Actual Time' },
      { internalName: 'DriverName', type: 'Text', displayName: 'Driver Name' },
      { internalName: 'Notes', type: 'Note', displayName: 'Notes' },
    ],
  },

  // ── 4. スケジュール系 ──────────────────────────────────
  {
    key: 'schedule_events',
    displayName: 'スケジュール',
    resolve: () => envOr('VITE_SP_LIST_SCHEDULES', fromConfig(ListKeys.Schedules)),
    operations: ['R', 'W', 'D'],
    category: 'schedule',
    essentialFields: ['Title', 'EventDate', 'EndDate'],
    provisioningFields: [
      { internalName: 'EventDate', type: 'DateTime', displayName: 'Start Time', required: true, dateTimeFormat: 'DateTime' },
      { internalName: 'EndDate', type: 'DateTime', displayName: 'End Time', required: true, dateTimeFormat: 'DateTime' },
      { internalName: 'Status', type: 'Choice', displayName: 'Status', choices: ['Planned', 'Postponed', 'Cancelled'] },
      { internalName: 'ServiceType', type: 'Text', displayName: 'Service Type' },
      { internalName: 'TargetUserId', type: 'Text', displayName: 'User ID' },
      { internalName: 'AssignedStaffId', type: 'Text', displayName: 'Staff ID' },
      { internalName: 'RowKey', type: 'Text', displayName: 'Row Key' },
      { internalName: 'Note', type: 'Note', displayName: 'Note' },
      { internalName: 'Visibility', type: 'Choice', displayName: 'Visibility', choices: ['org', 'team', 'private'] },
    ],
    lifecycle: 'required',
  },

  // ── 5. 会議系 ──────────────────────────────────────────
  {
    key: 'meeting_sessions',
    displayName: '会議セッション',
    resolve: () => envOr('VITE_SP_LIST_MEETING_SESSIONS', 'MeetingSessions'),
    operations: ['R', 'W', 'D'],
    category: 'meeting',
    lifecycle: 'optional',
    essentialFields: ['SessionKey', 'MeetingKind', 'MeetingDate'],
    provisioningFields: [
      { internalName: 'SessionKey', type: 'Text', displayName: 'Session Key', required: true, indexed: true },
      { internalName: 'MeetingKind', type: 'Choice', displayName: 'Meeting Kind', choices: ['morning', 'evening'], required: true },
      { internalName: 'MeetingDate', type: 'DateTime', displayName: 'Meeting Date', required: true, dateTimeFormat: 'DateOnly' },
      { internalName: 'StartTime', type: 'Text', displayName: 'Start Time' },
      { internalName: 'EndTime', type: 'Text', displayName: 'End Time' },
      { internalName: 'ChairpersonUserId', type: 'Text', displayName: 'Chairperson ID' },
      { internalName: 'ChairpersonName', type: 'Text', displayName: 'Chairperson Name' },
      { internalName: 'Status', type: 'Choice', displayName: 'Status', choices: ['scheduled', 'in-progress', 'completed', 'cancelled'] },
      { internalName: 'TotalParticipants', type: 'Number', displayName: 'Total Participants' },
    ],
  },
  {
    key: 'meeting_steps',
    displayName: '会議ステップ',
    resolve: () => envOr('VITE_SP_LIST_MEETING_STEPS', 'MeetingSteps'),
    operations: ['R', 'W', 'D'],
    category: 'meeting',
    lifecycle: 'optional',
    essentialFields: ['SessionId', 'StepId', 'StepTitle'],
    provisioningFields: [
      { internalName: 'SessionId', type: 'Number', displayName: 'Session ID', required: true, indexed: true },
      { internalName: 'SessionKey', type: 'Text', displayName: 'Session Key', required: true },
      { internalName: 'StepId', type: 'Number', displayName: 'Step ID', required: true },
      { internalName: 'StepTitle', type: 'Text', displayName: 'Step Title', required: true },
      { internalName: 'Completed', type: 'Boolean', displayName: 'Completed', default: false },
      { internalName: 'TimeSpentMinutes', type: 'Number', displayName: 'Minutes Spent' },
      { internalName: 'StepNotes', type: 'Note', displayName: 'Step Notes', richText: false },
    ],
  },
  {
    key: 'meeting_minutes',
    displayName: '議事録',
    resolve: () => envOr('VITE_SP_LIST_MEETING_MINUTES', fromConfig(ListKeys.MeetingMinutes)),
    operations: ['R', 'W', 'D'],
    category: 'meeting',
    lifecycle: 'required',
    essentialFields: ['MeetingDate', 'Category'],
    provisioningFields: [
      { internalName: 'MeetingDate', type: 'DateTime', displayName: 'Meeting Date', required: true, dateTimeFormat: 'DateOnly', indexed: true },
      { internalName: 'Category', type: 'Text', displayName: 'Category', required: true },
      { internalName: 'Summary', type: 'Note', displayName: 'Summary' },
      { internalName: 'Decisions', type: 'Note', displayName: 'Decisions' },
      { internalName: 'Actions', type: 'Note', displayName: 'Actions' },
      { internalName: 'Attendees', type: 'Note', displayName: 'Attendees' },
      { internalName: 'StaffAttendance', type: 'Note', displayName: 'Staff Attendance' },
      { internalName: 'IsPublished', type: 'Boolean', displayName: 'Published', default: false },
    ],
  },

  // ── 6. 引き継ぎ・支援計画系 ────────────────────────────
  {
    key: 'handoff',
    displayName: '引き継ぎ',
    resolve: () => envOr('VITE_SP_HANDOFF_LIST_TITLE', 'Handoff'),
    operations: ['R', 'W', 'D'],
    category: 'handoff',
    lifecycle: 'required',
    essentialFields: ['Message', 'UserCode', 'Category'],
    provisioningFields: [
      { internalName: 'Message', type: 'Note', displayName: 'Message', required: true },
      { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true, indexed: true },
      { internalName: 'Category', type: 'Text', displayName: 'Category', required: true },
      { internalName: 'Severity', type: 'Text', displayName: 'Severity' },
      { internalName: 'Status', type: 'Text', displayName: 'Status' },
      { internalName: 'TimeBand', type: 'Text', displayName: 'Time Band' },
      { internalName: 'SourceType', type: 'Text', displayName: 'Source Type' },
      { internalName: 'SourceKey', type: 'Text', displayName: 'Source Key' },
    ],
  },
  {
    key: 'support_templates',
    displayName: '支援手順テンプレート',
    resolve: () => envOr('VITE_SP_LIST_SUPPORT_TEMPLATES', fromConfig(ListKeys.SupportTemplates)),
    operations: ['R'],
    category: 'handoff',
    lifecycle: 'required',
  },
  {
    key: 'plan_goals',
    displayName: '支援計画目標',
    resolve: () => envOr('VITE_SP_LIST_PLAN_GOAL', fromConfig(ListKeys.PlanGoals)),
    operations: ['R', 'W'],
    category: 'handoff',
    lifecycle: 'optional',
  },
  {
    key: 'support_plans',
    displayName: '個別支援計画',
    resolve: () => envOr('VITE_SP_LIST_SUPPORT_PLANS', fromConfig(ListKeys.SupportPlans)),
    operations: ['R', 'W', 'D'],
    category: 'handoff',
    lifecycle: 'required', // 制度上必須のため required
    essentialFields: ['DraftId', 'UserCode', 'FormDataJson'],
    provisioningFields: [
      { internalName: 'DraftId', type: 'Text', displayName: 'Draft ID', required: true, indexed: true },
      { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true, indexed: true },
      { internalName: 'DraftName', type: 'Text', displayName: 'Draft Name' },
      { internalName: 'FormDataJson', type: 'Note', displayName: 'Form Data (JSON)', required: true, richText: false },
      { internalName: 'Status', type: 'Text', displayName: 'Status' },
      { internalName: 'SchemaVersion', type: 'Number', displayName: 'Schema Version', default: 2 },
    ],
  },
  {
    key: 'iceberg_pdca',
    displayName: '氷山モデルPDCA',
    resolve: () => envOr('VITE_SP_LIST_ICEBERG_PDCA', fromConfig(ListKeys.IcebergPdca)),
    operations: ['R', 'W', 'D'],
    category: 'handoff',
    lifecycle: 'optional',
    essentialFields: ['Title', 'UserID0', 'Phase0'],
    provisioningFields: [
      { internalName: 'Title', type: 'Text', displayName: 'Title', required: true },
      { internalName: 'UserID0', type: 'Text', displayName: 'User ID', required: true, indexed: true },
      { internalName: 'PlanningSheetId', type: 'Text', displayName: 'Planning Sheet ID' },
      { internalName: 'Summary0', type: 'Note', displayName: 'Summary', richText: false },
      { internalName: 'Phase0', type: 'Text', displayName: 'Phase' },
    ],
  },
  {
    key: 'iceberg_analysis',
    displayName: '氷山モデル分析',
    resolve: () => envOr('VITE_SP_LIST_ICEBERG_ANALYSIS', fromConfig(ListKeys.IcebergAnalysis)),
    operations: ['R', 'W'],
    category: 'handoff',
    lifecycle: 'optional',
    essentialFields: ['Title', 'EntryHash', 'UserId', 'PayloadJson'],
    provisioningFields: [
      { internalName: 'Title', type: 'Text', displayName: 'Title', required: true },
      { internalName: 'EntryHash', type: 'Text', displayName: 'Entry Hash', required: true, indexed: true },
      { internalName: 'SessionId', type: 'Text', displayName: 'Session ID' },
      { internalName: 'UserId', type: 'Text', displayName: 'User ID' },
      { internalName: 'PayloadJson', type: 'Note', displayName: 'Payload JSON', required: true, richText: false },
      { internalName: 'SchemaVersion', type: 'Number', displayName: 'Schema Version' },
    ],
  },
  {
    key: 'isp_master',
    displayName: '個別支援計画（ISP）',
    resolve: () => envOr('VITE_SP_LIST_ISP_MASTER', fromConfig(ListKeys.IspMaster)),
    operations: ['R', 'W'],
    category: 'handoff',
    lifecycle: 'required', // 三層モデルの核となるため required
    essentialFields: ['UserCode', 'PlanStartDate', 'Status'],
    provisioningFields: [
      { internalName: 'UserCode', type: 'Text', displayName: 'User Code', required: true, indexed: true },
      { internalName: 'PlanStartDate', type: 'DateTime', displayName: 'Plan Start Date', required: true, dateTimeFormat: 'DateOnly' },
      { internalName: 'PlanEndDate', type: 'DateTime', displayName: 'Plan End Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'Status', type: 'Text', displayName: 'Status', required: true },
      { internalName: 'VersionNo', type: 'Number', displayName: 'Version No', default: 1 },
      { internalName: 'IsCurrent', type: 'Boolean', displayName: 'Is Current', default: true },
      { internalName: 'FormDataJson', type: 'Note', displayName: 'Form Data (JSON)', richText: false },
      { internalName: 'UserSnapshotJson', type: 'Note', displayName: 'User Snapshot (JSON)', richText: false },
    ],
  },
  {
    key: 'planning_sheet_master',
    displayName: '支援計画シート',
    resolve: () => envOr('VITE_SP_LIST_PLANNING_SHEET', fromConfig(ListKeys.PlanningSheetMaster)),
    operations: ['R', 'W'],
    category: 'handoff',
    lifecycle: 'optional',
  },

  // ── 7. コンプライアンス・診断系 ────────────────────────
  {
    key: 'compliance_check_rules',
    displayName: '監査チェックルール',
    resolve: () => envOr('VITE_SP_LIST_COMPLIANCE', fromConfig(ListKeys.ComplianceCheckRules)),
    operations: ['R'],
    category: 'compliance',
    lifecycle: 'optional',
    provisioningFields: [
      { internalName: 'RuleID', type: 'Text', displayName: 'Rule ID', required: true, indexed: true },
      { internalName: 'Checkpoint', type: 'Text', displayName: 'Checkpoint', required: true },
      { internalName: 'Criteria', type: 'Note', displayName: 'Criteria', richText: false },
      { internalName: 'EvidenceRequired', type: 'Note', displayName: 'Evidence Required', richText: false },
      { internalName: 'SortOrder', type: 'Number', displayName: 'Sort Order' },
      { internalName: 'IsActive', type: 'Boolean', displayName: 'Active', default: true },
    ],
  },
  {
    key: 'diagnostics_reports',
    displayName: '環境診断レポート',
    resolve: () => envOr('VITE_SP_LIST_DIAGNOSTICS_REPORTS', fromConfig(ListKeys.DiagnosticsReports)),
    operations: ['R', 'W'],
    category: 'compliance',
    lifecycle: 'optional',
  },
  {
    key: 'drift_events_log',
    displayName: 'ドリフトイベント記録',
    resolve: () => envOr('VITE_SP_LIST_DRIFT_LOG', 'DriftEventsLog_v2'),
    operations: ['R', 'W'],
    category: 'compliance',
    lifecycle: 'optional',
    // Severity は SharePointDriftEventRepository が任意扱い（fail-open）で、
    // かつ本リストは lifecycle: 'optional' な観測用途のため essential から除外する。
    // 診断契約を実装契約に合わせ、宣言だけが厳しい状態を解消する。
    essentialFields: ['ListName', 'FieldName', 'DetectedAt'],
    provisioningFields: [
      { internalName: 'ListName', type: 'Text', displayName: 'List Name', required: true, indexed: true },
      { internalName: 'FieldName', type: 'Text', displayName: 'Field Name', required: true, indexed: true },
      { internalName: 'DetectedAt', type: 'DateTime', displayName: 'Detected At', required: true },
      { internalName: 'Severity', type: 'Text', displayName: 'Severity' },
      { internalName: 'ResolutionType', type: 'Text', displayName: 'Resolution Type' },
      { internalName: 'Resolved', type: 'Boolean', displayName: 'Resolved', default: false },
    ],
  },

  // ── 8. その他 ─────────────────────────────────────────
  {
    key: 'survey_tokusei',
    displayName: '特性アンケート',
    resolve: () => envOr('VITE_SP_LIST_SURVEY_TOKUSEI', fromConfig(ListKeys.SurveyTokusei)),
    operations: ['R'],
    category: 'other',
    lifecycle: 'optional',
  },
  {
    key: 'nurse_observations',
    displayName: '看護観察記録',
    resolve: () => envOr('VITE_SP_LIST_NURSE_OBSERVATION', fromConfig(ListKeys.NurseObservations)),
    operations: ['R', 'W'],
    category: 'other',
    lifecycle: 'optional',
  },
  {
    key: 'official_forms',
    displayName: '公式帳票ライブラリ',
    resolve: () => envOr('VITE_SP_LIST_OFFICIAL_FORMS', 'OfficialForms'),
    operations: ['W'],
    category: 'other',
    lifecycle: 'optional',
    baseTemplate: 101, // Document Library
    provisioningFields: [
      { internalName: 'Title', type: 'Text', displayName: 'Title' },
      { internalName: 'TemplateName', type: 'Text', displayName: 'Template Name' },
      { internalName: 'GeneratedAt', type: 'DateTime', displayName: 'Generated At' },
    ],
  },
  {
    key: 'billing_orders',
    displayName: '請求オーダー',
    resolve: () => envOr('VITE_SP_LIST_BILLING_ORDERS', 'BillingOrders'),
    operations: ['R'],
    category: 'other',
    lifecycle: 'optional',
    provisioningFields: [
      { internalName: 'Title', type: 'Text', displayName: 'Order Date' },
      { internalName: 'OrdererCode', type: 'Text', displayName: 'Orderer Code', required: true },
      { internalName: 'OrdererName', type: 'Text', displayName: 'Orderer Name' },
      { internalName: 'OrderCount', type: 'Number', displayName: 'Order Count' },
      { internalName: 'Item', type: 'Text', displayName: 'Item' },
    ],
  },
  {
    key: 'billing_summary',
    displayName: '月次請求サマリー',
    resolve: () => envOr('VITE_SP_LIST_BILLING_SUMMARY', fromConfig(ListKeys.MonthlyRecordSummary)),
    operations: ['R', 'W'],
    category: 'other',
    lifecycle: 'optional',
    essentialFields: ['UserId', 'YearMonth', 'KPI_TotalDays'],
    provisioningFields: [
      { internalName: 'UserId', type: 'Text', displayName: 'User ID', required: true, indexed: true },
      { internalName: 'YearMonth', type: 'Text', displayName: 'Year Month', required: true, indexed: true },
      { internalName: 'DisplayName', type: 'Text', displayName: 'Display Name' },
      { internalName: 'LastUpdated', type: 'DateTime', displayName: 'Last Updated' },
      { internalName: 'KPI_TotalDays', type: 'Number', displayName: 'Total Days' },
      { internalName: 'KPI_PlannedRows', type: 'Number', displayName: 'Planned Rows' },
      { internalName: 'KPI_CompletedRows', type: 'Number', displayName: 'Completed Rows' },
      { internalName: 'KPI_InProgressRows', type: 'Number', displayName: 'In Progress Rows' },
      { internalName: 'KPI_EmptyRows', type: 'Number', displayName: 'Empty Rows' },
      { internalName: 'KPI_SpecialNotes', type: 'Number', displayName: 'Special Notes' },
      { internalName: 'KPI_Incidents', type: 'Number', displayName: 'Incidents' },
      { internalName: 'CompletionRate', type: 'Number', displayName: 'Completion Rate' },
      { internalName: 'FirstEntryDate', type: 'DateTime', displayName: 'First Entry Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'LastEntryDate', type: 'DateTime', displayName: 'Last Entry Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'IdempotencyKey', type: 'Text', displayName: 'Idempotency Key' },
    ],
  },

  {
    key: 'pdf_output_log',
    displayName: '帳票出力ログ',
    resolve: () => envOr('VITE_SP_LIST_PDF_OUTPUT_LOG', fromConfig(ListKeys.PdfOutputLog)),
    operations: ['R', 'W'],
    category: 'other',
    lifecycle: 'optional',
  },
  {
    key: 'monitoring_meetings',
    displayName: 'モニタリング会議',
    resolve: () => envOr('VITE_SP_LIST_MONITORING_MEETINGS', 'MonitoringMeetings'),
    operations: ['R', 'W', 'D'],
    category: 'meeting',
    lifecycle: 'required',
    essentialFields: ['cr014_recordId', 'cr014_userId', 'cr014_meetingDate'],
    provisioningFields: [
      { internalName: 'cr014_recordId', type: 'Text', displayName: 'Record ID', required: true, indexed: true },
      { internalName: 'cr014_userId', type: 'Text', displayName: 'User ID', required: true, indexed: true },
      { internalName: 'cr014_ispId', type: 'Text', displayName: 'ISP ID', required: true },
      { internalName: 'cr014_planningSheetId', type: 'Text', displayName: 'Planning Sheet ID' },
      { internalName: 'cr014_meetingType', type: 'Text', displayName: 'Meeting Type' },
      { internalName: 'cr014_meetingDate', type: 'DateTime', displayName: 'Meeting Date', required: true, dateTimeFormat: 'DateOnly' },
      { internalName: 'cr014_venue', type: 'Text', displayName: 'Venue' },
      { internalName: 'cr014_attendeesJson', type: 'Note', displayName: 'Attendees (JSON)', richText: false },
      { internalName: 'cr014_goalEvaluationsJson', type: 'Note', displayName: 'Goal Evaluations (JSON)', richText: false },
      { internalName: 'cr014_overallAssessment', type: 'Note', displayName: 'Overall Assessment', richText: false },
      { internalName: 'cr014_userFeedback', type: 'Note', displayName: 'User Feedback', richText: false },
      { internalName: 'cr014_familyFeedback', type: 'Note', displayName: 'Family Feedback', richText: false },
      { internalName: 'cr014_planChangeDecision', type: 'Text', displayName: 'Plan Change Decision' },
      { internalName: 'cr014_changeReason', type: 'Note', displayName: 'Change Reason', richText: false },
      { internalName: 'cr014_decisionsJson', type: 'Note', displayName: 'Decisions (JSON)', richText: false },
      { internalName: 'cr014_nextMonitoringDate', type: 'DateTime', displayName: 'Next Monitoring Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'cr014_recordedBy', type: 'Text', displayName: 'Recorded By' },
      { internalName: 'cr014_recordedAt', type: 'DateTime', displayName: 'Recorded At' },
      { internalName: 'cr014_implSummary', type: 'Note', displayName: 'Implementation Summary', richText: false },
      { internalName: 'cr014_behaviorChange', type: 'Note', displayName: 'Behavior Change Summary', richText: false },
      { internalName: 'cr014_effSupport', type: 'Note', displayName: 'Effective Support Summary', richText: false },
      { internalName: 'cr014_issueSummary', type: 'Note', displayName: 'Issue Summary', richText: false },
      { internalName: 'cr014_discussionSummary', type: 'Note', displayName: 'Discussion Summary', richText: false },
      { internalName: 'cr014_reqPlanSheetUpd', type: 'Boolean', displayName: 'Requires Plan Sheet Update' },
      { internalName: 'cr014_reqIspUpd', type: 'Boolean', displayName: 'Requires ISP Update' },
      { internalName: 'cr014_hasBasicTrained', type: 'Boolean', displayName: 'Has Basic Trained Member' },
      { internalName: 'cr014_hasPractTrained', type: 'Boolean', displayName: 'Has Practical Trained Member' },
      { internalName: 'cr014_qualCheckStatus', type: 'Text', displayName: 'Qualification Check Status' },
      { internalName: 'cr014_nextActions', type: 'Note', displayName: 'Next Actions', richText: false },
      { internalName: 'cr014_status', type: 'Text', displayName: 'Audit Status' },
      { internalName: 'cr014_finalizedAt', type: 'DateTime', displayName: 'Finalized At' },
      { internalName: 'cr014_finalizedBy', type: 'Text', displayName: 'Finalized By' },
      { internalName: 'cr014_prevMeetingId', type: 'Text', displayName: 'Previous Meeting ID' },
    ],
  },
  {
    key: 'remediation_audit_log',
    displayName: '修復履歴ログ',
    resolve: () => envOr('VITE_SP_LIST_REMEDIATION_AUDIT', fromConfig(ListKeys.RemediationAuditLog)),
    operations: ['R', 'W'],
    category: 'compliance',
    lifecycle: 'optional',
    essentialFields: ['CorrelationId', 'PlanId', 'Phase'],
    provisioningFields: [
      { internalName: 'CorrelationId', type: 'Text', displayName: 'Correlation ID', required: true, indexed: true },
      { internalName: 'PlanId', type: 'Text', displayName: 'Plan ID', required: true, indexed: true },
      { internalName: 'Phase', type: 'Choice', displayName: 'Phase', choices: ['planned', 'executed', 'skipped'], required: true, indexed: true },
      { internalName: 'ListKey', type: 'Text', displayName: 'List Key', indexed: true },
      { internalName: 'FieldName', type: 'Text', displayName: 'Field Name', indexed: true },
      { internalName: 'Action', type: 'Text', displayName: 'Action', indexed: true },
      { internalName: 'Risk', type: 'Text', displayName: 'Risk' },
      { internalName: 'AutoExecutable', type: 'Boolean', displayName: 'Auto Executable' },
      { internalName: 'RequiresApproval', type: 'Boolean', displayName: 'Requires Approval' },
      { internalName: 'Reason', type: 'Note', displayName: 'Reason', richText: false },
      { internalName: 'Source', type: 'Text', displayName: 'Source', indexed: true },
      { internalName: 'ExecutionStatus', type: 'Text', displayName: 'Execution Status' },
      { internalName: 'ExecutionError', type: 'Note', displayName: 'Execution Error', richText: false },
      { internalName: 'Timestamp', type: 'DateTime', displayName: 'Timestamp', dateTimeFormat: 'DateTime', indexed: true },
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** キーからエントリを検索 */
export const findListEntry = (key: string): SpListEntry | undefined =>
  SP_LIST_REGISTRY.find((e) => e.key === key);

/** カテゴリでフィルタ */
export const getListsByCategory = (category: SpListCategory): SpListEntry[] =>
  SP_LIST_REGISTRY.filter((e) => e.category === category) as SpListEntry[];

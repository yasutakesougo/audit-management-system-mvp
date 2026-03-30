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
  /** ライフサイクル段階。不在時の挙動やログレベルを決定する */
  lifecycle: SpListLifecycle;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 環境変数からリスト名を読み取り、なければフォールバックを返す */
const envOr = (envKey: string, fallback: string): string =>
  readOptionalEnv(envKey) || fallback;

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
    lifecycle: 'optional',
    essentialFields: [
      'UserID', 'FullName', 'Furigana', 'FullNameKana', 
      'ContractDate', 'ServiceStartDate', 'ServiceEndDate',
      'IsActive', 'SevereFlag', 'IsHighIntensitySupportTarget', 'IsSupportProcedureTarget',
      'TransportToDays', 'TransportFromDays', 'TransportCourse', 'TransportSchedule', 'AttendanceDays',
      'RecipientCertNumber', 'RecipientCertExpiry', 'UsageStatus', 'GrantMunicipality',
      'GrantPeriodStart', 'GrantPeriodEnd', 'DisabilitySupportLevel', 'GrantedDaysPerMonth',
      'UserCopayLimit', 'LastAssessmentDate', 'BehaviorScore', 'ChildBehaviorScore',
      'ServiceTypesJson', 'EligibilityCheckedAt'
    ],
    provisioningFields: [
      { internalName: 'UserID', type: 'Text', displayName: 'User ID', required: true },
      { internalName: 'FullName', type: 'Text', displayName: 'Full Name', required: true },
      { internalName: 'Furigana', type: 'Text', displayName: 'Furigana' },
      { internalName: 'FullNameKana', type: 'Text', displayName: 'Full Name Kana' },
      { internalName: 'ContractDate', type: 'DateTime', displayName: 'Contract Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'ServiceStartDate', type: 'DateTime', displayName: 'Service Start Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'ServiceEndDate', type: 'DateTime', displayName: 'Service End Date', dateTimeFormat: 'DateOnly' },
      { internalName: 'IsActive', type: 'Boolean', displayName: 'Is Active', default: true },
      { internalName: 'UsageStatus', type: 'Text', displayName: 'Usage Status' },
      // Note: Other fields (Transport, Benefit) are moved to separate lists to avoid column limit.
    ],
  },
  {
    key: 'user_transport_settings',
    displayName: '利用者送迎設定',
    resolve: () => envOr('VITE_SP_LIST_USER_TRANSPORT', fromConfig(ListKeys.UserTransportSettings)),
    operations: ['R', 'W'],
    category: 'master',
    lifecycle: 'required',
    provisioningFields: [
      { internalName: 'UserID', type: 'Text', displayName: 'User ID', required: true },
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
    provisioningFields: [
      { internalName: 'UserID', type: 'Text', displayName: 'User ID', required: true },
      { internalName: 'RecipientCertNumber', type: 'Text', displayName: 'Recipient Cert Number' },
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
    displayName: '日次支援記録 (支援手順書兼記録)',
    resolve: () => envOr('VITE_SP_LIST_PROCEDURE_RECORD', fromConfig(ListKeys.ProcedureRecordDaily)),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'required',
    essentialFields: ['Title', 'RecordDate', 'ReporterName'],
    provisioningFields: [
      { internalName: 'RecordDate', type: 'DateTime', displayName: 'Record Date', required: true, dateTimeFormat: 'DateOnly' },
      { internalName: 'ReporterName', type: 'Text', displayName: 'Reporter Name' },
      { internalName: 'ReporterRole', type: 'Text', displayName: 'Reporter Role' },
      { internalName: 'UserRowsJSON', type: 'Note', displayName: 'User Rows JSON', required: true },
      { internalName: 'ApprovalStatus', type: 'Text', displayName: 'Approval Status' },
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
    lifecycle: 'optional',
  },
  {
    key: 'activity_diary',
    displayName: '活動日誌',
    resolve: () => envOr('VITE_SP_LIST_ACTIVITY_DIARY', 'ActivityDiary'),
    operations: ['R', 'W'],
    category: 'daily',
    lifecycle: 'optional',
  },

  // ── 3. 出席管理系 ──────────────────────────────────────
  {
    key: 'daily_attendance',
    displayName: '日次出欠',
    resolve: () => envOr('VITE_SP_LIST_ATTENDANCE', fromConfig(ListKeys.DailyAttendance)),
    operations: ['R'],
    category: 'attendance',
    lifecycle: 'required',
  },
  {
    key: 'attendance_users',
    displayName: '出席管理ユーザー',
    resolve: () => envOr('VITE_SP_LIST_ATTENDANCE_USERS', fromConfig(ListKeys.AttendanceUsers)),
    operations: ['R'],
    category: 'attendance',
    lifecycle: 'required',
  },
  {
    key: 'attendance_daily',
    displayName: '日次出席詳細',
    resolve: () => envOr('VITE_SP_LIST_ATTENDANCE_DAILY', fromConfig(ListKeys.AttendanceDaily)),
    operations: ['R', 'W'],
    category: 'attendance',
    lifecycle: 'required',
  },
  {
    key: 'staff_attendance',
    displayName: '職員出勤管理',
    resolve: () => envOr('VITE_SP_LIST_STAFF_ATTENDANCE', fromConfig(ListKeys.StaffAttendance)),
    operations: ['R', 'W'],
    category: 'attendance',
    lifecycle: 'required',
  },
  {
    key: 'transport_log',
    displayName: '送迎ステータスログ',
    resolve: () => envOr('VITE_SP_LIST_TRANSPORT_LOG', fromConfig(ListKeys.TransportLog)),
    operations: ['R', 'W'],
    category: 'attendance',
    lifecycle: 'required',
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
  },
  {
    key: 'meeting_steps',
    displayName: '会議ステップ',
    resolve: () => envOr('VITE_SP_LIST_MEETING_STEPS', 'MeetingSteps'),
    operations: ['R', 'W', 'D'],
    category: 'meeting',
    lifecycle: 'optional',
  },
  {
    key: 'meeting_minutes',
    displayName: '議事録',
    resolve: () => envOr('VITE_SP_LIST_MEETING_MINUTES', fromConfig(ListKeys.MeetingMinutes)),
    operations: ['R', 'W', 'D'],
    category: 'meeting',
    lifecycle: 'required',
  },

  // ── 6. 引き継ぎ・支援計画系 ────────────────────────────
  {
    key: 'handoff',
    displayName: '引き継ぎ',
    resolve: () => envOr('VITE_SP_HANDOFF_LIST_TITLE', 'Handoff'),
    operations: ['R', 'W', 'D'],
    category: 'handoff',
    lifecycle: 'required',
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
    lifecycle: 'required',
  },
  {
    key: 'support_plans',
    displayName: '個別支援計画',
    resolve: () => envOr('VITE_SP_LIST_SUPPORT_PLANS', fromConfig(ListKeys.SupportPlans)),
    operations: ['R', 'W', 'D'],
    category: 'handoff',
    lifecycle: 'required',
  },
  {
    key: 'iceberg_pdca',
    displayName: '氷山モデルPDCA',
    resolve: () => envOr('VITE_SP_LIST_ICEBERG_PDCA', fromConfig(ListKeys.IcebergPdca)),
    operations: ['R', 'W', 'D'],
    category: 'handoff',
    lifecycle: 'optional',
  },
  {
    key: 'iceberg_analysis',
    displayName: '氷山モデル分析',
    resolve: () => envOr('VITE_SP_LIST_ICEBERG_ANALYSIS', fromConfig(ListKeys.IcebergAnalysis)),
    operations: ['R', 'W'],
    category: 'handoff',
    lifecycle: 'optional',
  },
  {
    key: 'isp_master',
    displayName: '個別支援計画（ISP）',
    resolve: () => envOr('VITE_SP_LIST_ISP_MASTER', fromConfig(ListKeys.IspMaster)),
    operations: ['R', 'W'],
    category: 'handoff',
    lifecycle: 'required',
  },
  {
    key: 'planning_sheet_master',
    displayName: '支援計画シート',
    resolve: () => envOr('VITE_SP_LIST_PLANNING_SHEET', fromConfig(ListKeys.PlanningSheetMaster)),
    operations: ['R', 'W'],
    category: 'handoff',
    lifecycle: 'required',
  },

  // ── 7. コンプライアンス・診断系 ────────────────────────
  {
    key: 'compliance_check_rules',
    displayName: '監査チェックルール',
    resolve: () => envOr('VITE_SP_LIST_COMPLIANCE', fromConfig(ListKeys.ComplianceCheckRules)),
    operations: ['R'],
    category: 'compliance',
    lifecycle: 'optional',
  },
  {
    key: 'diagnostics_reports',
    displayName: '環境診断レポート',
    resolve: () => envOr('VITE_SP_LIST_DIAGNOSTICS_REPORTS', fromConfig(ListKeys.DiagnosticsReports)),
    operations: ['R', 'W'],
    category: 'compliance',
    lifecycle: 'optional',
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
  },
  {
    key: 'billing_orders',
    displayName: '請求オーダー',
    resolve: () => {
      const envVal = readOptionalEnv('VITE_SP_LIST_BILLING_ORDERS');
      return envVal ? `guid:${envVal}` : 'guid:00000000-0000-0000-0000-000000000003';
    },
    operations: ['R'],
    category: 'other',
    lifecycle: 'optional',
  },
  {
    key: 'pdf_output_log',
    displayName: '帳票出力ログ',
    resolve: () => envOr('VITE_SP_LIST_PDF_OUTPUT_LOG', fromConfig(ListKeys.PdfOutputLog)),
    operations: ['R', 'W'],
    category: 'other',
    lifecycle: 'required',
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

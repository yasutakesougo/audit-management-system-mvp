/**
 * SharePoint リスト レジストリ — 全24リストの Single Source of Truth
 *
 * 各エントリは以下を保持:
 * - key: プログラム内で使用するユニーク識別子
 * - displayName: UI / ログ表示用の日本語名
 * - resolve(): 実際のリスト名（またはGUID）を返す関数
 * - operations: このリストで行われる操作種別
 * - category: 機能カテゴリ
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
  },
  {
    key: 'staff_master',
    displayName: '職員マスタ',
    resolve: () => envOr('VITE_SP_LIST_STAFF', fromConfig(ListKeys.StaffMaster)),
    operations: ['R'],
    category: 'master',
  },
  {
    key: 'org_master',
    displayName: '組織マスタ',
    resolve: () => envOr('VITE_SP_LIST_ORG_MASTER', fromConfig(ListKeys.OrgMaster)),
    operations: ['R'],
    category: 'master',
  },

  // ── 2. 日々の記録系 ─────────────────────────────────────
  {
    key: 'support_record_daily',
    displayName: '日次支援記録',
    resolve: () => envOr('VITE_SP_LIST_DAILY', 'SupportRecord_Daily'),
    operations: ['R', 'W'],
    category: 'daily',
  },
  {
    key: 'daily_activity_records',
    displayName: '日次活動記録',
    resolve: () => envOr('VITE_SP_LIST_DAILY_ACTIVITY_RECORDS', fromConfig(ListKeys.DailyActivityRecords)),
    operations: ['R', 'W'],
    category: 'daily',
  },
  {
    key: 'service_provision_records',
    displayName: 'サービス提供実績',
    resolve: () => envOr('VITE_SP_LIST_SERVICE_PROVISION', 'ServiceProvisionRecords'),
    operations: ['R', 'W'],
    category: 'daily',
  },
  {
    key: 'activity_diary',
    displayName: '活動日誌',
    resolve: () => envOr('VITE_SP_LIST_ACTIVITY_DIARY', 'ActivityDiary'),
    operations: ['R', 'W'],
    category: 'daily',
  },

  // ── 3. 出席管理系 ──────────────────────────────────────
  {
    key: 'daily_attendance',
    displayName: '日次出欠',
    resolve: () => envOr('VITE_SP_LIST_ATTENDANCE', 'Daily_Attendance'),
    operations: ['R'],
    category: 'attendance',
  },
  {
    key: 'attendance_users',
    displayName: '出席管理ユーザー',
    resolve: () => envOr('VITE_SP_LIST_ATTENDANCE_USERS', fromConfig(ListKeys.AttendanceUsers)),
    operations: ['R'],
    category: 'attendance',
  },
  {
    key: 'attendance_daily',
    displayName: '日次出席詳細',
    resolve: () => envOr('VITE_SP_LIST_ATTENDANCE_DAILY', fromConfig(ListKeys.AttendanceDaily)),
    operations: ['R', 'W'],
    category: 'attendance',
  },
  {
    key: 'staff_attendance',
    displayName: '職員出勤管理',
    resolve: () => envOr('VITE_SP_LIST_STAFF_ATTENDANCE', fromConfig(ListKeys.StaffAttendance)),
    operations: ['R', 'W'],
    category: 'attendance',
  },

  // ── 4. スケジュール系 ──────────────────────────────────
  {
    key: 'schedule_events',
    displayName: 'スケジュール',
    resolve: () => envOr('VITE_SP_LIST_SCHEDULES', 'ScheduleEvents'),
    operations: ['R', 'W', 'D'],
    category: 'schedule',
  },

  // ── 5. 会議系 ──────────────────────────────────────────
  {
    key: 'meeting_sessions',
    displayName: '会議セッション',
    resolve: () => envOr('VITE_SP_LIST_MEETING_SESSIONS', 'MeetingSessions'),
    operations: ['R', 'W', 'D'],
    category: 'meeting',
  },
  {
    key: 'meeting_steps',
    displayName: '会議ステップ',
    resolve: () => envOr('VITE_SP_LIST_MEETING_STEPS', 'MeetingSteps'),
    operations: ['R', 'W', 'D'],
    category: 'meeting',
  },
  {
    key: 'meeting_minutes',
    displayName: '議事録',
    resolve: () => envOr('VITE_SP_LIST_MEETING_MINUTES', fromConfig(ListKeys.MeetingMinutes)),
    operations: ['R', 'W', 'D'],
    category: 'meeting',
  },

  // ── 6. 引き継ぎ・支援計画系 ────────────────────────────
  {
    key: 'handoff',
    displayName: '引き継ぎ',
    resolve: () => envOr('VITE_SP_HANDOFF_LIST_TITLE', 'Handoff'),
    operations: ['R', 'W', 'D'],
    category: 'handoff',
  },
  {
    key: 'support_templates',
    displayName: '支援手順テンプレート',
    resolve: () => envOr('VITE_SP_LIST_SUPPORT_TEMPLATES', fromConfig(ListKeys.SupportTemplates)),
    operations: ['R'],
    category: 'handoff',
  },
  {
    key: 'plan_goals',
    displayName: '支援計画目標',
    resolve: () => envOr('VITE_SP_LIST_PLAN_GOAL', 'PlanGoals'),
    operations: ['R', 'W'],
    category: 'handoff',
  },
  {
    key: 'iceberg_pdca',
    displayName: '氷山モデルPDCA',
    resolve: () => envOr('VITE_SP_LIST_ICEBERG_PDCA', fromConfig(ListKeys.IcebergPdca)),
    operations: ['R', 'W', 'D'],
    category: 'handoff',
  },

  // ── 7. コンプライアンス・診断系 ────────────────────────
  {
    key: 'compliance_check_rules',
    displayName: '監査チェックルール',
    resolve: () => envOr('VITE_SP_LIST_COMPLIANCE', fromConfig(ListKeys.ComplianceCheckRules)),
    operations: ['R'],
    category: 'compliance',
  },
  {
    key: 'diagnostics_reports',
    displayName: '環境診断レポート',
    resolve: () => envOr('VITE_SP_LIST_DIAGNOSTICS_REPORTS', fromConfig(ListKeys.DiagnosticsReports)),
    operations: ['R', 'W'],
    category: 'compliance',
  },

  // ── 8. アンケート・看護・帳票系 ────────────────────────
  {
    key: 'survey_tokusei',
    displayName: '特性アンケート',
    resolve: () => envOr('VITE_SP_LIST_SURVEY_TOKUSEI', fromConfig(ListKeys.SurveyTokusei)),
    operations: ['R'],
    category: 'other',
  },
  {
    key: 'nurse_observations',
    displayName: '看護観察記録',
    resolve: () => envOr('VITE_SP_LIST_NURSE_OBSERVATION', 'NurseObservations'),
    operations: ['R', 'W'],
    category: 'other',
  },
  {
    key: 'official_forms',
    displayName: '公式帳票ライブラリ',
    resolve: () => envOr('VITE_SP_LIST_OFFICIAL_FORMS', 'OfficialForms'),
    operations: ['W'],
    category: 'other',
  },
] as const;

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** キーからエントリを検索 */
export const findListEntry = (key: string): SpListEntry | undefined =>
  SP_LIST_REGISTRY.find((e) => e.key === key);

/** カテゴリでフィルタ */
export const getListsByCategory = (category: SpListCategory): SpListEntry[] =>
  SP_LIST_REGISTRY.filter((e) => e.category === category);

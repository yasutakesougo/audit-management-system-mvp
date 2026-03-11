/**
 * OpeningVerificationPage — constants and static configuration
 */
import { ATTENDANCE_DAILY_SELECT_FIELDS, ATTENDANCE_USERS_SELECT_FIELDS, STAFF_ATTENDANCE_FIELDS, STAFF_ATTENDANCE_SELECT_FIELDS } from '@/sharepoint/fields/attendanceFields';
import { DAILY_ACTIVITY_SELECT_FIELDS, FIELD_MAP_DAILY_ACTIVITY } from '@/sharepoint/fields/dailyFields';
import { FIELD_MAP_HANDOFF, buildHandoffSelectFields } from '@/sharepoint/fields/handoffFields';
import { ORG_MASTER_SELECT_FIELDS } from '@/sharepoint/fields/orgMasterFields';
import { SCHEDULES_BASE_FIELDS } from '@/sharepoint/fields/scheduleFields';
import { SERVICE_PROVISION_SELECT_FIELDS } from '@/sharepoint/fields/serviceProvisionFields';
import { STAFF_MASTER_FIELD_MAP, STAFF_SELECT_FIELDS_CANONICAL } from '@/sharepoint/fields/staffFields';
import { USERS_MASTER_FIELD_MAP, USERS_SELECT_FIELDS_CORE } from '@/sharepoint/fields/userFields';
import type { ListCheckStatus } from '@/sharepoint/spListHealthCheck';
import type React from 'react';

// ---------------------------------------------------------------------------
// Day-0 必須リスト キー一覧
// ---------------------------------------------------------------------------
export const DAY0_REQUIRED_KEYS = [
  'users_master', 'staff_master', 'org_master',
  'support_record_daily', 'daily_activity_records', 'service_provision_records', 'activity_diary',
  'daily_attendance', 'attendance_users', 'attendance_daily', 'staff_attendance',
  'handoff',
] as const;

// ---------------------------------------------------------------------------
// フィールドマップ定義（リストキー → フィールドマップ）
// ---------------------------------------------------------------------------
export const FIELD_MAPS: Record<string, Record<string, string>> = {
  users_master: USERS_MASTER_FIELD_MAP as unknown as Record<string, string>,
  staff_master: STAFF_MASTER_FIELD_MAP as unknown as Record<string, string>,
  staff_attendance: STAFF_ATTENDANCE_FIELDS as unknown as Record<string, string>,
  daily_activity_records: FIELD_MAP_DAILY_ACTIVITY as unknown as Record<string, string>,
  handoff: FIELD_MAP_HANDOFF as unknown as Record<string, string>,
};

// ---------------------------------------------------------------------------
// Step2 補助: 型チェック定義
// ---------------------------------------------------------------------------

/** JS想定型 → 許容される SharePoint TypeAsString 一覧 */
export const TYPE_EXPECTATIONS: Record<string, string[]> = {
  number:  ['Number', 'Lookup', 'Counter', 'Currency'],
  string:  ['Text', 'Note', 'Choice', 'MultiChoice', 'Computed'],
  boolean: ['Boolean'],
  date:    ['DateTime'],
};

/**
 * SharePoint InternalName → アプリが想定する JS 型
 * ここに登録しておくと Step2 で自動型チェックされる。
 * 発見次第追加していく運用想定。
 */
export const FIELD_TYPE_HINTS: Record<string, string> = {
  // ── Numeric / Lookup IDs ──
  'UserId': 'number',
  'UserGroupId': 'number',
  'StaffId': 'number',
  'ServiceTypeId': 'number',
  'FacilityId': 'number',
  'OrgId': 'number',
  // ── Dates ──
  'RecordDate': 'date',
  'StartDate': 'date',
  'EndDate': 'date',
  'EventDate': 'date',
  'BirthDate': 'date',
  // ── Booleans ──
  'IsActive': 'boolean',
  'IsDeleted': 'boolean',
};

// ---------------------------------------------------------------------------
// Step3: SELECT検証ターゲット
// ---------------------------------------------------------------------------
export const SELECT_TARGETS: Array<{ listKey: string; label: string; selectFields: readonly string[] }> = [
  { listKey: 'users_master',              label: 'Users_Master',         selectFields: USERS_SELECT_FIELDS_CORE },
  { listKey: 'staff_master',              label: 'Staff_Master',         selectFields: STAFF_SELECT_FIELDS_CANONICAL },
  { listKey: 'staff_attendance',          label: 'Staff_Attendance',     selectFields: STAFF_ATTENDANCE_SELECT_FIELDS },
  { listKey: 'daily_activity_records',    label: 'DailyActivityRecords', selectFields: DAILY_ACTIVITY_SELECT_FIELDS },
  { listKey: 'handoff',                   label: 'Handoff',              selectFields: buildHandoffSelectFields() },
  { listKey: 'schedule_events',           label: 'Schedules',            selectFields: SCHEDULES_BASE_FIELDS },
  { listKey: 'attendance_users',          label: 'Attendance_Users',     selectFields: ATTENDANCE_USERS_SELECT_FIELDS },
  { listKey: 'attendance_daily',          label: 'Attendance_Daily',     selectFields: ATTENDANCE_DAILY_SELECT_FIELDS },
  { listKey: 'service_provision_records', label: 'ServiceProvision',     selectFields: SERVICE_PROVISION_SELECT_FIELDS },
  { listKey: 'org_master',               label: 'Org_Master',           selectFields: ORG_MASTER_SELECT_FIELDS },
];

// ---------------------------------------------------------------------------
// Shared style helpers (used in multiple result table components)
// ---------------------------------------------------------------------------
export const thStyle: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #ddd',
  background: '#f5f5f5',
  textAlign: 'left',
  fontSize: '13px',
  fontWeight: 600,
};

export const tdStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid #ddd',
  fontSize: '13px',
};

export const sectionStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e0e0e0',
  borderRadius: '8px',
  padding: '1.5rem',
  marginBottom: '1.5rem',
};

// ---------------------------------------------------------------------------
// Icon helpers — pure functions, no hooks
// ---------------------------------------------------------------------------
export type { ListCheckStatus };

export function statusIcon(s: ListCheckStatus): string {
  switch (s) {
    case 'ok':        return '✅';
    case 'not_found': return '❌';
    case 'forbidden': return '🔒';
    case 'error':     return '⚠️';
  }
}

export function crudIcon(s: string): string {
  switch (s) {
    case 'ok':      return '✅';
    case 'fail':    return '❌';
    case 'skip':    return '⏭';
    case 'pending': return '⏳';
    default:        return '—';
  }
}

// ---------------------------------------------------------------------------
// Step4 CRUD targets definition
// ---------------------------------------------------------------------------
export type CrudTarget = {
  entity: string;
  listKey: string;
  selectFields: string;
  createPayload?: Record<string, unknown>;
  updateField?: string;
  updateValue?: unknown;
};

export function buildCrudTargets(): CrudTarget[] {
  return [
    {
      entity: 'Users',
      listKey: 'users_master',
      selectFields: 'Id,Title,UserID,FullName',
      // No create/update for master data
    },
    {
      entity: 'Daily',
      listKey: 'daily_activity_records',
      selectFields: 'Id,UserCode,RecordDate,TimeSlot,Observation',
      createPayload: {
        UserCode: '__SMOKE_TEST__',
        RecordDate: new Date().toISOString().slice(0, 10),
        TimeSlot: '09:00-10:00',
        Observation: 'A班開通テスト - 自動作成レコード',
      },
      updateField: 'Observation',
      updateValue: 'A班開通テスト - 更新済み',
    },
    {
      entity: 'Attendance',
      listKey: 'attendance_daily',
      selectFields: 'Id,UserCode,RecordDate,Status',
    },
    {
      entity: 'Handoff',
      listKey: 'handoff',
      selectFields: 'Id,Title,Message,Status,Created',
      createPayload: {
        Title: `A班開通テスト_${Date.now()}`,
        Message: 'A班開通テスト - 自動作成引継ぎ',
        Status: '未対応',
        Category: 'テスト',
        Severity: '通常',
      },
      updateField: 'Status',
      updateValue: '対応済み',
    },
    {
      entity: 'Staff Attendance',
      listKey: 'staff_attendance',
      selectFields: 'Id,StaffId,RecordDate,Status',
    },
  ];
}

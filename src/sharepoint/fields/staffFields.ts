/**
 * SharePoint フィールド定義 — Staff_Master
 */
import type { SpStaffItem } from '@/types';
import { joinSelect } from './fieldUtils';

export type StaffRow = SpStaffItem;

export const STAFF_MASTER_FIELD_MAP = {
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
  // ── 資格判定属性 (Issue 4-3) ──
  hasPracticalTraining: 'HasPracticalTraining',
  hasBasicTraining: 'HasBasicTraining',
  hasBehaviorGuidanceTraining: 'HasBehaviorGuidanceTraining',
  hasCorePersonTraining: 'HasCorePersonTraining',
  certificationCheckedAt: 'CertificationCheckedAt',
  // ── 強度行動障害支援 (資格要件チェック用) ──
  hasBasicBehaviorSupportTraining: 'HasBasicBehaviorSupportTraining',
  hasPracticalBehaviorSupportTraining: 'HasPracticalBehaviorSupportTraining',
  behaviorSupportTrainingCompletedAt: 'BehaviorSupportTrainingCompletedAt',
  behaviorSupportTrainingNote: 'BehaviorSupportTrainingNote',
} as const;

export const STAFF_SELECT_FIELDS_CANONICAL = [
  STAFF_MASTER_FIELD_MAP.id,
  STAFF_MASTER_FIELD_MAP.title,
  STAFF_MASTER_FIELD_MAP.staffId,
  STAFF_MASTER_FIELD_MAP.fullName,
  STAFF_MASTER_FIELD_MAP.jobTitle,
  STAFF_MASTER_FIELD_MAP.employmentType,
  STAFF_MASTER_FIELD_MAP.rbacRole,
  STAFF_MASTER_FIELD_MAP.role,
  STAFF_MASTER_FIELD_MAP.isActive,
  STAFF_MASTER_FIELD_MAP.department,
  STAFF_MASTER_FIELD_MAP.hireDate,
  STAFF_MASTER_FIELD_MAP.resignDate,
  STAFF_MASTER_FIELD_MAP.certifications,
  STAFF_MASTER_FIELD_MAP.email,
  STAFF_MASTER_FIELD_MAP.phone,
  STAFF_MASTER_FIELD_MAP.furigana,
  STAFF_MASTER_FIELD_MAP.fullNameKana,
  STAFF_MASTER_FIELD_MAP.workDaysText,
  STAFF_MASTER_FIELD_MAP.workDays,
  STAFF_MASTER_FIELD_MAP.baseShiftStartTime,
  STAFF_MASTER_FIELD_MAP.baseShiftEndTime,
  STAFF_MASTER_FIELD_MAP.baseWorkingDays,
  // 資格判定属性
  STAFF_MASTER_FIELD_MAP.hasPracticalTraining,
  STAFF_MASTER_FIELD_MAP.hasBasicTraining,
  STAFF_MASTER_FIELD_MAP.hasBehaviorGuidanceTraining,
  STAFF_MASTER_FIELD_MAP.hasCorePersonTraining,
  STAFF_MASTER_FIELD_MAP.certificationCheckedAt,
  // 強度行動障害支援
  STAFF_MASTER_FIELD_MAP.hasBasicBehaviorSupportTraining,
  STAFF_MASTER_FIELD_MAP.hasPracticalBehaviorSupportTraining,
  STAFF_MASTER_FIELD_MAP.behaviorSupportTrainingCompletedAt,
  STAFF_MASTER_FIELD_MAP.behaviorSupportTrainingNote,
] as const;

/**
 * Staff_Master フィールド候補マップ
 * 動的解決 (SchemaResolver) で使用し、内部名揺れ (Space, Case, Legacy) を吸収する
 */
export const STAFF_MASTER_CANDIDATES: Record<string, string[]> = {
  staffId: ['StaffID', 'Staff_x0020_ID', 'UserCode', 'Title'],
  fullName: ['FullName', 'Full_x0020_Name', 'StaffName', 'Name', 'Title'],
  furigana: ['Furigana', 'FuriganaKana'],
  fullNameKana: ['FullNameKana', 'FullName_x0020_Kana'],
  jobTitle: ['JobTitle', 'Role', 'Rank'],
  role: ['Role', 'JobTitle', 'Position'],
  rbacRole: ['RBACRole', 'PermissionRole'],
  isActive: ['IsActive', 'Active', 'Status'],
  department: ['Department', 'Group', 'Branch'],
  hireDate: ['HireDate', 'JoinDate'],
  resignDate: ['ResignDate', 'LeaveDate'],
  email: ['Email', 'MailAddress'],
  phone: ['Phone', 'Tel', 'Contact'],
  workDays: ['WorkDays', 'BaseWorkDays'],
  baseWorkingDays: ['BaseWorkingDays', 'StandardWorkingDays'],
  baseShiftStartTime: ['BaseShiftStartTime', 'StartTime', 'Start_x0020_Time'],
  baseShiftEndTime: ['BaseShiftEndTime', 'EndTime', 'End_x0020_Time'],
  certifications: ['Certifications', 'Qualification', 'License'],
};

export const STAFF_MASTER_ESSENTIALS = [
  'staffId', 'fullName', 'rbacRole', 'isActive', 'role', 'department'
] as const;

export const STAFF_SELECT = joinSelect(STAFF_SELECT_FIELDS_CANONICAL as readonly string[]);

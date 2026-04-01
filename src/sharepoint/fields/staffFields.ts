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
] as const;

/**
 * Staff_Master フィールド候補マップ
 * 動的解決 (SchemaResolver) で使用し、内部名揺れ (Space, Case, Legacy) を吸収する
 */
export const STAFF_MASTER_CANDIDATES: Record<string, string[]> = {
  StaffID: ['StaffID', 'Staff_x0020_ID', 'UserCode', 'Title'],
  FullName: ['FullName', 'Full_x0020_Name', 'StaffName', 'Name', 'Title'],
  Furigana: ['Furigana', 'FuriganaKana'],
  FullNameKana: ['FullNameKana', 'FullName_x0020_Kana'],
  JobTitle: ['JobTitle', 'Role', 'Rank'],
  Role: ['Role', 'JobTitle', 'Position'],
  RBACRole: ['RBACRole', 'PermissionRole'],
  IsActive: ['IsActive', 'Active', 'Status'],
  Department: ['Department', 'Group', 'Branch'],
  HireDate: ['HireDate', 'JoinDate'],
  ResignDate: ['ResignDate', 'LeaveDate'],
  Email: ['Email', 'MailAddress'],
  Phone: ['Phone', 'Tel', 'Contact'],
  WorkDays: ['WorkDays', 'BaseWorkDays'],
  BaseShiftStartTime: ['BaseShiftStartTime', 'StartTime', 'Start_x0020_Time'],
  BaseShiftEndTime: ['BaseShiftEndTime', 'EndTime', 'End_x0020_Time'],
  Certifications: ['Certifications', 'Qualification', 'License'],
};

export const STAFF_SELECT = joinSelect(STAFF_SELECT_FIELDS_CANONICAL as readonly string[]);

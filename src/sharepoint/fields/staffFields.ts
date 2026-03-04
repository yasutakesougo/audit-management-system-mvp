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
] as const;

export const STAFF_SELECT = joinSelect(STAFF_SELECT_FIELDS_CANONICAL as readonly string[]);

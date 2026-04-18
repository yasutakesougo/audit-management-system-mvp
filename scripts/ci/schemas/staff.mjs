/**
 * Schema definition for Staff_Master.
 * Used by CI for drift detection.
 */

export const LIST_TITLE = 'Staff_Master';

export const ESSENTIAL_FIELDS = [
  'StaffID',
  'FullName',
  'IsActive',
];

export const OPTIONAL_FIELDS = [
  'Title',
  'Role',
  'Department',
  'HireDate',
  'Email',
];

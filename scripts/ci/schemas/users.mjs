/**
 * Schema definition for Users_Master.
 * Used by CI for drift detection.
 */

export const LIST_TITLE = 'Users_Master';

export const ESSENTIAL_FIELDS = [
  'UserID',
  'FullName',
  'IsActive',
];

export const OPTIONAL_FIELDS = [
  'Title',
  'Furigana',
  'FullNameKana',
  'OrgCode',
  'OrgName',
  'Role',
  'Email',
  'IsDisabled',
  'UsageStatus',
  'ContractDate',
  'ServiceStartDate',
  'ServiceEndDate',
  'GrantMunicipality',
  'GrantPeriodStart',
  'GrantPeriodEnd',
  'DisabilitySupportLevel',
  'GrantedDaysPerMonth',
  'UserCopayLimit',
  'RecipientCertNumber',
  'RecipientCertExpiry',
  'IsHighIntensitySupportTarget',
  'IsSupportProcedureTarget',
  'SevereFlag',
  'TransportToDays',
  'TransportFromDays',
  'TransportCourse',
  'AttendanceDays',
  'TransportAdditionType',
  'MealAddition',
  'CopayPaymentMethod',
];

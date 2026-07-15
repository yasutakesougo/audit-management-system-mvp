/**
 * Schema definition for Users_Master.
 * Used by CI for drift detection.
 */

export const LIST_TITLE = 'Users_Master';

export const ESSENTIAL_FIELDS = [
  'UserID',
  'FullName',
];

// Logical contract -> known SharePoint physical InternalName aliases.
// Keep the canonical names above unchanged; the resolver chooses the
// physical name only when the canonical InternalName is not present.
export const FIELD_ALIASES = {
  UserID: ['User_x0020_ID'],
  FullName: ['Full_x0020_Name'],
  IsActive: ['isActive0'],
};

export const OPTIONAL_FIELDS = [
  'IsActive',
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

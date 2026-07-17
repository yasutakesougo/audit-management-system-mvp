/**
 * Schema definition for UserBenefit_Profile_Ext.
 * Used by CI for drift detection.
 */

export const LIST_TITLE = 'UserBenefit_Profile_Ext';

export const ESSENTIAL_FIELDS = [
  'UserID',
];

// Logical contract -> known SharePoint physical InternalName aliases.
// Keep the canonical name above unchanged; the CI resolver selects the
// physical name only when the canonical InternalName is not present.
export const FIELD_ALIASES = {
  UserID: ['User_x0020_ID'],
};

export const OPTIONAL_FIELDS = [
  'RecipientCertNumber',
  'RecipientCertExpiry',
  'DisabilitySupportLevel',
  'GrantedDaysPerMonth',
  'UserCopayLimit',
];

/**
 * Schema definition for UserBenefit_Profile_Ext.
 * Used by CI for drift detection.
 */

export const LIST_TITLE = 'UserBenefit_Profile_Ext';

export const ESSENTIAL_FIELDS = [
  'UserID',
];

export const OPTIONAL_FIELDS = [
  'RecipientCertNumber',
  'RecipientCertExpiry',
  'DisabilitySupportLevel',
  'GrantedDaysPerMonth',
  'UserCopayLimit',
];

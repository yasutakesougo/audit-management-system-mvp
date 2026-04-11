import {
  FIELD_MAP,
  USER_BENEFIT_PROFILE_CANDIDATES,
  USER_BENEFIT_PROFILE_EXT_CANDIDATES,
  USER_TRANSPORT_SETTINGS_CANDIDATES,
  USERS_BENEFIT_EXT_FIELD_MAP,
} from '@/sharepoint/fields';

export type UserAccessoryKind = 'transport' | 'benefit' | 'benefit_ext';

export type UserAccessoryConfig = {
  kind: UserAccessoryKind;
  listTitle: string;
  candidates: Record<string, string[]>;
  fieldNames: string[];
};

export function buildUserAccessoryConfigs(listTitles: {
  transport: string;
  benefit: string;
  benefitExt: string;
}): Record<UserAccessoryKind, UserAccessoryConfig> {
  const fields = FIELD_MAP.Users_Master;

  return {
    transport: {
      kind: 'transport',
      listTitle: listTitles.transport,
      candidates:
        USER_TRANSPORT_SETTINGS_CANDIDATES as unknown as Record<string, string[]>,
      fieldNames: [
        fields.transportToDays,
        fields.transportFromDays,
        fields.transportCourse,
        fields.transportSchedule,
        fields.transportAdditionType,
      ],
    },
    benefit: {
      kind: 'benefit',
      listTitle: listTitles.benefit,
      candidates:
        USER_BENEFIT_PROFILE_CANDIDATES as unknown as Record<string, string[]>,
      fieldNames: [
        fields.recipientCertExpiry,
        fields.grantMunicipality,
        fields.grantPeriodStart,
        fields.grantPeriodEnd,
        fields.disabilitySupportLevel,
        fields.grantedDaysPerMonth,
        fields.userCopayLimit,
        fields.mealAddition,
        fields.copayPaymentMethod,
      ],
    },
    benefit_ext: {
      kind: 'benefit_ext',
      listTitle: listTitles.benefitExt,
      candidates:
        USER_BENEFIT_PROFILE_EXT_CANDIDATES as unknown as Record<string, string[]>,
      fieldNames: [USERS_BENEFIT_EXT_FIELD_MAP.recipientCertNumber],
    },
  };
}

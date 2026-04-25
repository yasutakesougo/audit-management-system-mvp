import { 
  washRow,
} from '@/lib/sp/helpers';
import {
  USERS_MASTER_CANDIDATES,
  type UserRow,
  type UserSelectMode,
} from '@/sharepoint/fields';
import { normalizeAttendanceDays } from '../../attendance';
import { toDomainUser } from '../../domain/userLifecycle';
import type { IUserMaster } from '../../types';

/**
 * UserJoiner
 * 
 * Users_Master レコードと分離先リストのレコードを結合し、
 * ドメインモデル（IUserMaster）に変換する責務を持つ。
 */
export class UserJoiner {
  constructor() {}

  public toDomain(row: UserRow, mode: UserSelectMode, mapping: Record<string, string | undefined>): IUserMaster {
    const candidates = USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>;
    const rawRecord = row as unknown as Record<string, unknown>;
    const record = washRow(rawRecord, candidates, mapping);

    const attendance = normalizeAttendanceDays(record.attendanceDays);
    const transportTo = normalizeAttendanceDays(record.transportToDays);
    const transportFrom = normalizeAttendanceDays(record.transportFromDays);

    const domain: IUserMaster = {
      Id: Number(record['id'] ?? record['Id'] ?? rawRecord['Id'] ?? rawRecord['id']),
      Title: (record['title'] as string) ?? (record['Title'] as string) ?? null,
      UserID: (record['userId'] as string) ?? (record['UserID'] as string) ?? '',
      FullName: (record['fullName'] as string) ?? (record['FullName'] as string) ?? '',
      Furigana: (record['furigana'] as string) ?? (record['Furigana'] as string) ?? null,
      FullNameKana: (record['fullNameKana'] as string) ?? (record['FullNameKana'] as string) ?? null,
      ContractDate: (record['contractDate'] as string) ?? (record['ContractDate'] as string) ?? null,
      ServiceStartDate: (record['serviceStartDate'] as string) ?? (record['ServiceStartDate'] as string) ?? null,
      ServiceEndDate: (record['serviceEndDate'] as string) ?? (record['ServiceEndDate'] as string) ?? null,
      IsHighIntensitySupportTarget: record['isHighIntensitySupportTarget'] !== undefined ? Boolean(record['isHighIntensitySupportTarget']) : null,
      IsSupportProcedureTarget: record['isSupportProcedureTarget'] !== undefined ? Boolean(record['isSupportProcedureTarget']) : null,
      severeFlag: record['severeFlag'] !== undefined ? Boolean(record['severeFlag']) : null,
      IsActive: record['isActive'] !== undefined ? Boolean(record['isActive']) : null,
      TransportToDays: transportTo,
      TransportFromDays: transportFrom,
      TransportCourse: (record['transportCourse'] as string) ?? (record['TransportCourse'] as string) ?? null,
      TransportSchedule: (record['transportSchedule'] as string) ?? (record['TransportSchedule'] as string) ?? null,
      AttendanceDays: attendance,
      RecipientCertNumber: (record['recipientCertNumber'] as string) ?? (record['RecipientCertNumber'] as string) ?? null,
      RecipientCertExpiry: (record['recipientCertExpiry'] as string) ?? (record['RecipientCertExpiry'] as string) ?? null,
      Modified: (record['modified'] as string) ?? (record['Modified'] as string) ?? null,
      Created: (record['created'] as string) ?? (record['Created'] as string) ?? null,
      UsageStatus: (record['usageStatus'] as string) ?? (record['UsageStatus'] as string) ?? null,
      GrantMunicipality: (record['grantMunicipality'] as string) ?? (record['GrantMunicipality'] as string) ?? null,
      GrantPeriodStart: (record['grantPeriodStart'] as string) ?? (record['GrantPeriodStart'] as string) ?? null,
      GrantPeriodEnd: (record['grantPeriodEnd'] as string) ?? (record['GrantPeriodEnd'] as string) ?? null,
      DisabilitySupportLevel: (record['disabilitySupportLevel'] as string) ?? (record['DisabilitySupportLevel'] as string) ?? null,
      GrantedDaysPerMonth: (record['grantedDaysPerMonth'] as string) ?? (record['GrantedDaysPerMonth'] as string) ?? null,
      UserCopayLimit: (record['userCopayLimit'] as string) ?? (record['UserCopayLimit'] as string) ?? null,
      TransportAdditionType: (record['transportAdditionType'] as string) ?? (record['TransportAdditionType'] as string) ?? null,
      MealAddition: (record['mealAddition'] as string) ?? (record['MealAddition'] as string) ?? null,
      CopayPaymentMethod: (record['copayPaymentMethod'] as string) ?? (record['CopayPaymentMethod'] as string) ?? null,
      LastAssessmentDate: (record['lastAssessmentDate'] as string) ?? (record['LastAssessmentDate'] as string) ?? null,
      BehaviorScore: (record['behaviorScore'] as number) ?? (record['BehaviorScore'] as number) ?? null,
      ChildBehaviorScore: (record['childBehaviorScore'] as number) ?? (record['ChildBehaviorScore'] as number) ?? null,
      ServiceTypesJson: (record['serviceTypesJson'] as string) ?? (record['ServiceTypesJson'] as string) ?? null,
      EligibilityCheckedAt: (record['eligibilityCheckedAt'] as string) ?? (record['EligibilityCheckedAt'] as string) ?? null,
      __selectMode: mode,
    };

    return toDomainUser(domain);
  }

  public mergeExtraData(
    user: IUserMaster,
    transport?: Record<string, unknown>,
    benefit?: Record<string, unknown>,
    benefitExt?: Record<string, unknown>
  ): IUserMaster {
    const next = { ...user };
    
    if (transport) {
      if (transport.transportToDays !== undefined) next.TransportToDays = normalizeAttendanceDays(transport.transportToDays);
      if (transport.transportFromDays !== undefined) next.TransportFromDays = normalizeAttendanceDays(transport.transportFromDays);
      if (transport.transportCourse !== undefined) next.TransportCourse = transport.transportCourse as string;
      if (transport.transportSchedule !== undefined) next.TransportSchedule = transport.transportSchedule as string;
      if (transport.transportAdditionType !== undefined) next.TransportAdditionType = transport.transportAdditionType as string;
    }

    if (benefit) {
      if (benefit.recipientCertExpiry !== undefined) next.RecipientCertExpiry = benefit.recipientCertExpiry as string;
      if (benefit.grantMunicipality !== undefined) next.GrantMunicipality = benefit.grantMunicipality as string;
      if (benefit.grantPeriodStart !== undefined) next.GrantPeriodStart = benefit.grantPeriodStart as string;
      if (benefit.grantPeriodEnd !== undefined) next.GrantPeriodEnd = benefit.grantPeriodEnd as string;
      if (benefit.disabilitySupportLevel !== undefined) next.DisabilitySupportLevel = benefit.disabilitySupportLevel as string;
      if (benefit.grantedDaysPerMonth !== undefined) next.GrantedDaysPerMonth = benefit.grantedDaysPerMonth as string;
      if (benefit.userCopayLimit !== undefined) next.UserCopayLimit = benefit.userCopayLimit as string;
      if (benefit.mealAddition !== undefined) next.MealAddition = benefit.mealAddition as string;
      if (benefit.copayPaymentMethod !== undefined) next.CopayPaymentMethod = benefit.copayPaymentMethod as string;
    }

    if (benefitExt) {
      if (benefitExt.recipientCertNumber !== undefined) next.RecipientCertNumber = benefitExt.recipientCertNumber as string;
    }

    return next as IUserMaster;
  }

  public sanitizeDomainRecord(
    user: IUserMaster,
    hasTransport: boolean,
    hasBenefit: boolean,
    hasBenefitExt: boolean
  ): IUserMaster {
    if (!hasTransport && !hasBenefit && !hasBenefitExt) return user;
    
    const sanitized = { ...user };

    if (hasTransport) {
      sanitized.TransportToDays = [];
      sanitized.TransportFromDays = [];
      sanitized.TransportCourse = null;
      sanitized.TransportSchedule = null;
      sanitized.TransportAdditionType = null;
    }

    if (hasBenefit) {
      sanitized.RecipientCertExpiry = null;
      sanitized.GrantMunicipality = null;
      sanitized.GrantPeriodStart = null;
      sanitized.GrantPeriodEnd = null;
      sanitized.DisabilitySupportLevel = null;
      sanitized.GrantedDaysPerMonth = null;
      sanitized.UserCopayLimit = null;
      sanitized.MealAddition = null;
      sanitized.CopayPaymentMethod = null;
    }

    if (hasBenefitExt) {
      sanitized.RecipientCertNumber = null;
    }
    
    return sanitized;
  }
}

import { 
  washRow,
} from '@/lib/sp/helpers';
import {
  USERS_MASTER_CANDIDATES,
  type UserRow,
  type UserSelectMode,
  USERS_TRANSPORT_FIELD_MAP,
  USERS_BENEFIT_FIELD_MAP,
  USERS_BENEFIT_EXT_FIELD_MAP,
} from '@/sharepoint/fields';
import { normalizeAttendanceDays } from '../../attendance';
import { toDomainUser } from '../../domain/userLifecycle';
import type { IUserMaster } from '../../types';
import type { UserFieldResolver } from './UserFieldResolver';

/**
 * UserJoiner
 * 
 * Users_Master レコードと分離先リストのレコードを結合し、
 * ドメインモデル（IUserMaster）に変換する責務を持つ。
 */
export class UserJoiner {
  constructor(private readonly resolver: UserFieldResolver) {}

  public toDomain(row: UserRow, mode: UserSelectMode, mapping: Record<string, string | undefined>): IUserMaster {
    const washed = washRow(row, USERS_MASTER_CANDIDATES as any, mapping);
    const domain = toDomainUser(washed as any);

    if (domain.AttendanceDays) {
      domain.AttendanceDays = normalizeAttendanceDays(domain.AttendanceDays);
    }

    return domain;
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

import {
  FIELD_MAP,
  type UserRow,
  type UserSelectMode,
} from '@/sharepoint/fields';
import { auditLog } from '@/lib/debugLogger';

import { normalizeAttendanceDays } from '../attendance';
import { toDomainUser } from '../domain/userLifecycle';
import { userMasterSchema } from '../schema';
import type { IUserMaster, IUserMasterCreateDto } from '../types';

export const getTodayIsoDate = (): string => new Date().toISOString().slice(0, 10);

export function matchesUserKeyword(
  row: IUserMaster,
  keyword: string,
): boolean {
  const candidates = [row.FullName, row.FullNameKana, row.Furigana, row.UserID]
    .filter(Boolean)
    .map((value) => (value as string).toLowerCase());
  return candidates.some((value) => value.includes(keyword));
}

export function toUserDomain(
  raw: UserRow,
  effectiveMode: UserSelectMode = 'core',
): IUserMaster {
  const fields = FIELD_MAP.Users_Master;
  const record = raw as Record<string, unknown>;
  const get = <T = unknown>(field: string): T | undefined =>
    record[field] as T | undefined;
  const attendance = normalizeAttendanceDays(get(fields.attendanceDays));
  const transportTo = normalizeAttendanceDays(get(fields.transportToDays));
  const transportFrom = normalizeAttendanceDays(get(fields.transportFromDays));

  const domain: IUserMaster = {
    Id: Number(get<number>(fields.id) ?? raw.Id),
    Title: get<string | null>(fields.title) ?? raw.Title ?? null,
    UserID: (get<string>(fields.userId) ?? raw.UserID) ?? '',
    FullName: (get<string>(fields.fullName) ?? raw.FullName) ?? '',
    Furigana: get<string | null>(fields.furigana) ?? raw.Furigana ?? null,
    FullNameKana:
      get<string | null>(fields.fullNameKana) ?? raw.FullNameKana ?? null,
    ContractDate:
      get<string | null>(fields.contractDate) ?? raw.ContractDate ?? null,
    ServiceStartDate:
      get<string | null>(fields.serviceStartDate) ??
      raw.ServiceStartDate ??
      null,
    ServiceEndDate:
      get<string | null>(fields.serviceEndDate) ?? raw.ServiceEndDate ?? null,
    IsHighIntensitySupportTarget:
      get<boolean | null>(fields.isHighIntensitySupportTarget) ?? null,
    IsSupportProcedureTarget:
      get<boolean | null>(fields.isSupportProcedureTarget) ?? null,
    severeFlag: get<boolean | null>(fields.severeFlag) ?? null,
    IsActive: get<boolean | null>(fields.isActive) ?? raw.IsActive ?? null,
    TransportToDays: transportTo,
    TransportFromDays: transportFrom,
    TransportCourse: get<string | null>(fields.transportCourse) ?? null,
    TransportSchedule: get<string | null>(fields.transportSchedule) ?? null,
    AttendanceDays: attendance,
    RecipientCertNumber:
      get<string | null>(fields.recipientCertNumber) ??
      raw.RecipientCertNumber ??
      null,
    RecipientCertExpiry:
      get<string | null>(fields.recipientCertExpiry) ??
      raw.RecipientCertExpiry ??
      null,
    Modified: get<string | null>(fields.modified) ?? raw.Modified ?? null,
    Created: get<string | null>(fields.created) ?? raw.Created ?? null,
    UsageStatus: get<string | null>(fields.usageStatus) ?? null,
    GrantMunicipality:
      get<string | null>(fields.grantMunicipality) ?? null,
    GrantPeriodStart:
      get<string | null>(fields.grantPeriodStart) ?? null,
    GrantPeriodEnd: get<string | null>(fields.grantPeriodEnd) ?? null,
    DisabilitySupportLevel:
      get<string | null>(fields.disabilitySupportLevel) ?? null,
    GrantedDaysPerMonth:
      get<string | null>(fields.grantedDaysPerMonth) ?? null,
    UserCopayLimit:
      get<string | null>(fields.userCopayLimit) ?? null,
    TransportAdditionType:
      get<string | null>(fields.transportAdditionType) ?? null,
    MealAddition: get<string | null>(fields.mealAddition) ?? null,
    CopayPaymentMethod:
      get<string | null>(fields.copayPaymentMethod) ?? null,
    __selectMode: effectiveMode,
  };

  const normalized = toDomainUser(domain);

  try {
    userMasterSchema.parse(normalized);
  } catch (error) {
    auditLog.warn('users', 'rest_api_repo.domain_validation_failed', {
      error: String(error),
      domainId: normalized.Id,
    });
  }

  return normalized;
}

export function toUserRequest(
  dto: Partial<IUserMasterCreateDto>,
): Record<string, unknown> {
  const fields = FIELD_MAP.Users_Master;
  const payload: Record<string, unknown> = {};

  const assign = (key: keyof typeof fields, value: unknown): void => {
    payload[fields[key]] = value;
  };

  if (dto.UserID !== undefined) assign('userId', dto.UserID);
  if (dto.FullName !== undefined) assign('fullName', dto.FullName);
  if (dto.Furigana !== undefined) assign('furigana', dto.Furigana);
  if (dto.FullNameKana !== undefined) assign('fullNameKana', dto.FullNameKana);
  if (dto.ContractDate !== undefined)
    assign('contractDate', dto.ContractDate ?? null);
  if (dto.ServiceStartDate !== undefined)
    assign('serviceStartDate', dto.ServiceStartDate ?? null);
  if (dto.ServiceEndDate !== undefined)
    assign('serviceEndDate', dto.ServiceEndDate ?? null);
  if (dto.IsHighIntensitySupportTarget !== undefined) {
    assign('isHighIntensitySupportTarget', dto.IsHighIntensitySupportTarget);
  }
  if (dto.IsSupportProcedureTarget !== undefined) {
    assign('isSupportProcedureTarget', dto.IsSupportProcedureTarget);
  }
  if (dto.severeFlag !== undefined) assign('severeFlag', dto.severeFlag);
  if (dto.IsActive !== undefined) assign('isActive', dto.IsActive);
  if (dto.AttendanceDays !== undefined)
    assign('attendanceDays', normalizeAttendanceDays(dto.AttendanceDays));
  if (dto.TransportToDays !== undefined)
    assign('transportToDays', normalizeAttendanceDays(dto.TransportToDays));
  if (dto.TransportFromDays !== undefined) {
    assign('transportFromDays', normalizeAttendanceDays(dto.TransportFromDays));
  }
  if (dto.TransportCourse !== undefined)
    assign('transportCourse', dto.TransportCourse);
  if (dto.TransportSchedule !== undefined)
    assign('transportSchedule', dto.TransportSchedule);
  if (dto.RecipientCertNumber !== undefined)
    assign('recipientCertNumber', dto.RecipientCertNumber);
  if (dto.RecipientCertExpiry !== undefined)
    assign('recipientCertExpiry', dto.RecipientCertExpiry);
  if (dto.UsageStatus !== undefined)
    assign('usageStatus', dto.UsageStatus);
  if (dto.GrantMunicipality !== undefined)
    assign('grantMunicipality', dto.GrantMunicipality);
  if (dto.GrantPeriodStart !== undefined)
    assign('grantPeriodStart', dto.GrantPeriodStart ?? null);
  if (dto.GrantPeriodEnd !== undefined)
    assign('grantPeriodEnd', dto.GrantPeriodEnd ?? null);
  if (dto.DisabilitySupportLevel !== undefined)
    assign('disabilitySupportLevel', dto.DisabilitySupportLevel);
  if (dto.GrantedDaysPerMonth !== undefined)
    assign('grantedDaysPerMonth', dto.GrantedDaysPerMonth);
  if (dto.UserCopayLimit !== undefined)
    assign('userCopayLimit', dto.UserCopayLimit);
  if (dto.TransportAdditionType !== undefined)
    assign('transportAdditionType', dto.TransportAdditionType);
  if (dto.MealAddition !== undefined)
    assign('mealAddition', dto.MealAddition);
  if (dto.CopayPaymentMethod !== undefined)
    assign('copayPaymentMethod', dto.CopayPaymentMethod);

  return payload;
}

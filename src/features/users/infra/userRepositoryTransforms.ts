import { normalizeAttendanceDays } from '../attendance';
import { toDomainUser } from '../domain/userLifecycle';
import type { IUserMaster, IUserMasterCreateDto } from '../types';
import {
  FIELD_MAP,
  USERS_MASTER_CANDIDATES,
  type UserRow,
  type UserSelectMode,
} from '@/sharepoint/fields';
import { washRow } from '@/lib/sp/helpers';

const assignMappedValue = (
  request: Record<string, unknown>,
  dto: Partial<IUserMasterCreateDto>,
  mapping: Record<string, string | undefined>,
  dtoKey: keyof IUserMasterCreateDto,
  mappingKey: string,
): void => {
  const value = dto[dtoKey];
  if (value === undefined) return;

  const physicalField = mapping[mappingKey];
  if (physicalField) {
    request[physicalField] = value;
  }
};

export const toUserRepositoryRequest = (
  dto: Partial<IUserMasterCreateDto>,
  mappingOverrides?: Record<string, string | undefined>,
): Record<string, unknown> => {
  const mapping = (mappingOverrides || FIELD_MAP.Users_Master) as Record<string, string | undefined>;
  const request: Record<string, unknown> = {};

  assignMappedValue(request, dto, mapping, 'UserID', 'userId');
  assignMappedValue(request, dto, mapping, 'FullName', 'fullName');
  assignMappedValue(request, dto, mapping, 'Furigana', 'furigana');
  assignMappedValue(request, dto, mapping, 'FullNameKana', 'fullNameKana');
  assignMappedValue(request, dto, mapping, 'ContractDate', 'contractDate');
  assignMappedValue(request, dto, mapping, 'ServiceStartDate', 'serviceStartDate');
  assignMappedValue(request, dto, mapping, 'ServiceEndDate', 'serviceEndDate');
  assignMappedValue(request, dto, mapping, 'IsHighIntensitySupportTarget', 'isHighIntensitySupportTarget');
  assignMappedValue(request, dto, mapping, 'IsSupportProcedureTarget', 'isSupportProcedureTarget');
  assignMappedValue(request, dto, mapping, 'severeFlag', 'severeFlag');
  assignMappedValue(request, dto, mapping, 'IsActive', 'isActive');

  if (dto.TransportToDays !== undefined) {
    const field = mapping.transportToDays;
    if (field) request[field] = dto.TransportToDays ?? [];
  }
  if (dto.TransportFromDays !== undefined) {
    const field = mapping.transportFromDays;
    if (field) request[field] = dto.TransportFromDays ?? [];
  }

  assignMappedValue(request, dto, mapping, 'TransportCourse', 'transportCourse');
  assignMappedValue(request, dto, mapping, 'TransportSchedule', 'transportSchedule');

  if (dto.AttendanceDays !== undefined) {
    const field = mapping.attendanceDays;
    if (field) request[field] = dto.AttendanceDays ?? [];
  }

  assignMappedValue(request, dto, mapping, 'RecipientCertNumber', 'recipientCertNumber');
  assignMappedValue(request, dto, mapping, 'RecipientCertExpiry', 'recipientCertExpiry');
  assignMappedValue(request, dto, mapping, 'UsageStatus', 'usageStatus');
  assignMappedValue(request, dto, mapping, 'GrantMunicipality', 'grantMunicipality');
  assignMappedValue(request, dto, mapping, 'GrantPeriodStart', 'grantPeriodStart');
  assignMappedValue(request, dto, mapping, 'GrantPeriodEnd', 'grantPeriodEnd');
  assignMappedValue(request, dto, mapping, 'DisabilitySupportLevel', 'disabilitySupportLevel');
  assignMappedValue(request, dto, mapping, 'GrantedDaysPerMonth', 'grantedDaysPerMonth');
  assignMappedValue(request, dto, mapping, 'UserCopayLimit', 'userCopayLimit');
  assignMappedValue(request, dto, mapping, 'TransportAdditionType', 'transportAdditionType');
  assignMappedValue(request, dto, mapping, 'MealAddition', 'mealAddition');
  assignMappedValue(request, dto, mapping, 'CopayPaymentMethod', 'copayPaymentMethod');
  assignMappedValue(request, dto, mapping, 'LastAssessmentDate', 'lastAssessmentDate');
  assignMappedValue(request, dto, mapping, 'BehaviorScore', 'behaviorScore');
  assignMappedValue(request, dto, mapping, 'ChildBehaviorScore', 'childBehaviorScore');
  assignMappedValue(request, dto, mapping, 'ServiceTypesJson', 'serviceTypesJson');
  assignMappedValue(request, dto, mapping, 'EligibilityCheckedAt', 'eligibilityCheckedAt');

  return request;
};

export const matchesUserRepositoryKeyword = (row: IUserMaster, keyword: string): boolean => {
  const candidates = [row.FullName, row.FullNameKana, row.Furigana, row.UserID]
    .filter(Boolean)
    .map((value) => (value as string).toLowerCase());
  return candidates.some((value) => value.includes(keyword));
};

export const toUserRepositoryDomain = (
  raw: UserRow,
  effectiveMode: UserSelectMode,
  resolvedFields: Record<string, string | undefined> | null,
): IUserMaster => {
  const fields = resolvedFields || FIELD_MAP.Users_Master;
  const candidates = USERS_MASTER_CANDIDATES as unknown as Record<string, string[]>;
  const rawRecord = raw as unknown as Record<string, unknown>;
  const record = washRow(raw as unknown as Record<string, unknown>, candidates, fields as Record<string, string | undefined>);

  const attendance = normalizeAttendanceDays(record.attendanceDays);
  const transportTo = normalizeAttendanceDays(record.transportToDays);
  const transportFrom = normalizeAttendanceDays(record.transportFromDays);

  const domain: IUserMaster = {
    Id: Number(record.id ?? record.Id ?? rawRecord.Id ?? rawRecord.id),
    Title:
      (record.title as string) ??
      (record.Title as string) ??
      (rawRecord.Title as string | undefined) ??
      (rawRecord.title as string | undefined) ??
      null,
    UserID:
      (record.userId as string) ??
      (record.UserID as string) ??
      (rawRecord.UserID as string | undefined) ??
      (rawRecord.userId as string | undefined) ??
      '',
    FullName:
      (record.fullName as string) ??
      (record.FullName as string) ??
      (rawRecord.FullName as string | undefined) ??
      (rawRecord.fullName as string | undefined) ??
      '',
    Furigana:
      (record.furigana as string) ??
      (record.Furigana as string) ??
      (rawRecord.Furigana as string | undefined) ??
      (rawRecord.furigana as string | undefined) ??
      null,
    FullNameKana:
      (record.fullNameKana as string) ??
      (record.FullNameKana as string) ??
      (rawRecord.FullNameKana as string | undefined) ??
      (rawRecord.fullNameKana as string | undefined) ??
      null,
    ContractDate:
      (record.contractDate as string) ??
      (record.ContractDate as string) ??
      (rawRecord.ContractDate as string | undefined) ??
      (rawRecord.contractDate as string | undefined) ??
      null,
    ServiceStartDate:
      (record.serviceStartDate as string) ??
      (record.ServiceStartDate as string) ??
      (rawRecord.ServiceStartDate as string | undefined) ??
      (rawRecord.serviceStartDate as string | undefined) ??
      null,
    ServiceEndDate:
      (record.serviceEndDate as string) ??
      (record.ServiceEndDate as string) ??
      (rawRecord.ServiceEndDate as string | undefined) ??
      (rawRecord.serviceEndDate as string | undefined) ??
      null,
    IsHighIntensitySupportTarget: Boolean(
      record.isHighIntensitySupportTarget ??
        record.IsHighIntensitySupportTarget ??
        rawRecord.IsHighIntensitySupportTarget ??
        rawRecord.isHighIntensitySupportTarget ??
        null,
    ),
    IsSupportProcedureTarget: Boolean(
      record.isSupportProcedureTarget ??
        record.IsSupportProcedureTarget ??
        rawRecord.IsSupportProcedureTarget ??
        rawRecord.isSupportProcedureTarget ??
        null,
    ),
    severeFlag: Boolean(
      record.severeFlag ?? record.SevereFlag ?? rawRecord.SevereFlag ?? rawRecord.severeFlag ?? null,
    ),
    IsActive:
      record.isActive !== undefined
        ? Boolean(record.isActive)
        : ((rawRecord.IsActive as boolean | null | undefined) ?? null),
    TransportToDays: transportTo,
    TransportFromDays: transportFrom,
    TransportCourse: (record.transportCourse as string) ?? (record.TransportCourse as string) ?? null,
    TransportSchedule: (record.transportSchedule as string) ?? (record.TransportSchedule as string) ?? null,
    AttendanceDays: attendance,
    RecipientCertNumber:
      (record.recipientCertNumber as string) ??
      (record.RecipientCertNumber as string) ??
      (rawRecord.RecipientCertNumber as string | undefined) ??
      (rawRecord.recipientCertNumber as string | undefined) ??
      null,
    RecipientCertExpiry:
      (record.recipientCertExpiry as string) ??
      (record.RecipientCertExpiry as string) ??
      (rawRecord.RecipientCertExpiry as string | undefined) ??
      (rawRecord.recipientCertExpiry as string | undefined) ??
      null,
    Modified:
      (record.modified as string) ??
      (record.Modified as string) ??
      (rawRecord.Modified as string | undefined) ??
      (rawRecord.modified as string | undefined) ??
      null,
    Created:
      (record.created as string) ??
      (record.Created as string) ??
      (rawRecord.Created as string | undefined) ??
      (rawRecord.created as string | undefined) ??
      null,
    UsageStatus: (record.usageStatus as string) ?? (record.UsageStatus as string) ?? null,
    GrantMunicipality: (record.grantMunicipality as string) ?? (record.GrantMunicipality as string) ?? null,
    GrantPeriodStart: (record.grantPeriodStart as string) ?? (record.GrantPeriodStart as string) ?? null,
    GrantPeriodEnd: (record.grantPeriodEnd as string) ?? (record.GrantPeriodEnd as string) ?? null,
    DisabilitySupportLevel:
      (record.disabilitySupportLevel as string) ?? (record.DisabilitySupportLevel as string) ?? null,
    GrantedDaysPerMonth:
      (record.grantedDaysPerMonth as string) ?? (record.GrantedDaysPerMonth as string) ?? null,
    UserCopayLimit: (record.userCopayLimit as string) ?? (record.UserCopayLimit as string) ?? null,
    TransportAdditionType:
      (record.transportAdditionType as string) ?? (record.TransportAdditionType as string) ?? null,
    MealAddition: (record.mealAddition as string) ?? null,
    CopayPaymentMethod: (record.copayPaymentMethod as string) ?? null,
    LastAssessmentDate: (record.lastAssessmentDate as string) ?? null,
    BehaviorScore: (record.behaviorScore as number) ?? null,
    ChildBehaviorScore: (record.childBehaviorScore as number) ?? null,
    ServiceTypesJson: (record.serviceTypesJson as string) ?? null,
    EligibilityCheckedAt: (record.eligibilityCheckedAt as string) ?? null,
    __selectMode: effectiveMode,
  };

  return toDomainUser(domain);
};

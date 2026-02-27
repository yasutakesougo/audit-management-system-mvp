import { z } from 'zod';
import { normalizeAttendanceDays } from './attendance';

/**
 * SharePoint Users_Master item schema (Raw data from API)
 * Integrated with latest main branch fields (OrgCode, Role, Email, etc.)
 */
export const SpUserMasterItemSchema = z.object({
  Id: z.number(),
  Title: z.string().nullish(),
  UserID: z.string().nullish().default(''),
  FullName: z.string().nullish().default(''),
  Furigana: z.string().nullish(),
  FullNameKana: z.string().nullish(),
  ContractDate: z.string().nullish(),
  ServiceStartDate: z.string().nullish(),
  ServiceEndDate: z.string().nullish(),
  // Extended fields from Audit System
  UsageStatus: z.string().nullish(),
  GrantMunicipality: z.string().nullish(),
  GrantPeriodStart: z.string().nullish(),
  GrantPeriodEnd: z.string().nullish(),
  DisabilitySupportLevel: z.string().nullish(),
  GrantedDaysPerMonth: z.string().nullish(),
  UserCopayLimit: z.string().nullish(),
  RecipientCertNumber: z.string().nullish(),
  RecipientCertExpiry: z.string().nullish(),
  // Checkboxes / Flags
  IsHighIntensitySupportTarget: z.boolean().nullish().default(false),
  IsSupportProcedureTarget: z.boolean().nullish().default(false),
  severeFlag: z.boolean().nullish().default(false),
  IsActive: z.boolean().nullish().default(true),
  // Arrays (normalized from string or unknown)
  TransportToDays: z.unknown().transform(normalizeAttendanceDays),
  TransportFromDays: z.unknown().transform(normalizeAttendanceDays),
  AttendanceDays: z.unknown().transform(normalizeAttendanceDays),
  // Billing specific
  TransportAdditionType: z.string().nullish(),
  MealAddition: z.string().nullish(),
  CopayPaymentMethod: z.string().nullish(),
  // Metadata
  Created: z.string().nullish(),
  Modified: z.string().nullish(),

  // --- Integration from Main Branch ---
  OrgCode: z.string().nullish(),
  OrgName: z.string().nullish(),
  Role: z.string().nullish(),
  Email: z.string().nullish(),
  IsDisabled: z.boolean().nullish().default(false),
});

/**
 * Domain User Master schema transformer
 * Transforms SharePoint raw record into the IUserMaster domain model.
 */
export const UserMasterDomainSchema = SpUserMasterItemSchema.transform((sp) => ({
  Id: sp.Id,
  Title: sp.Title ?? null,
  UserID: sp.UserID ?? '',
  FullName: sp.FullName ?? '',
  Furigana: sp.Furigana ?? null,
  FullNameKana: sp.FullNameKana ?? null,
  ContractDate: sp.ContractDate ?? null,
  ServiceStartDate: sp.ServiceStartDate ?? null,
  ServiceEndDate: sp.ServiceEndDate ?? null,
  UsageStatus: sp.UsageStatus ?? null,
  GrantMunicipality: sp.GrantMunicipality ?? null,
  GrantPeriodStart: sp.GrantPeriodStart ?? null,
  GrantPeriodEnd: sp.GrantPeriodEnd ?? null,
  DisabilitySupportLevel: sp.DisabilitySupportLevel ?? null,
  GrantedDaysPerMonth: sp.GrantedDaysPerMonth ?? null,
  UserCopayLimit: sp.UserCopayLimit ?? null,
  RecipientCertNumber: sp.RecipientCertNumber ?? null,
  RecipientCertExpiry: sp.RecipientCertExpiry ?? null,
  IsHighIntensitySupportTarget: !!sp.IsHighIntensitySupportTarget,
  IsSupportProcedureTarget: sp.IsSupportProcedureTarget ?? null,
  severeFlag: !!sp.severeFlag,
  IsActive: sp.IsActive !== false,
  TransportToDays: sp.TransportToDays,
  TransportFromDays: sp.TransportFromDays,
  AttendanceDays: sp.AttendanceDays,
  TransportAdditionType: sp.TransportAdditionType ?? null,
  MealAddition: sp.MealAddition ?? null,
  CopayPaymentMethod: sp.CopayPaymentMethod ?? null,
  Created: sp.Created ?? null,
  Modified: sp.Modified ?? null,

  // --- Integration from Main Branch ---
  OrgCode: sp.OrgCode ?? null,
  OrgName: sp.OrgName ?? null,
  Role: sp.Role ?? null,
  Email: sp.Email ?? null,
  IsDisabled: !!sp.IsDisabled,
}));

export type SpUserMasterRaw = z.infer<typeof SpUserMasterItemSchema>;
export type UserMasterDomain = z.infer<typeof UserMasterDomainSchema>;

/**
 * Compatibility Aliases for latest main branch naming
 */
export const userMasterSchema = SpUserMasterItemSchema;
export const userMasterCreateSchema = SpUserMasterItemSchema.omit({ Id: true, Created: true, Modified: true });

export type UserMasterSchema = SpUserMasterRaw;
export type UserMasterCreateSchema = z.infer<typeof userMasterCreateSchema>;

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
  SevereFlag: z.boolean().nullish().default(false),
  IsActive: z.boolean().nullish().default(true),
  // Arrays (normalized from string or unknown)
  TransportToDays: z.unknown().transform(normalizeAttendanceDays),
  TransportFromDays: z.unknown().transform(normalizeAttendanceDays),
  TransportCourse: z.string().nullish(),
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
  severeFlag: !!sp.SevereFlag,
  IsActive: sp.IsActive !== false,
  TransportToDays: sp.TransportToDays,
  TransportFromDays: sp.TransportFromDays,
  TransportCourse: sp.TransportCourse ?? null,
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

// ---------------------------------------------------------------------------
// Domain output schemas — UserSelectMode 階層 (core ⊂ detail ⊂ full)
//
// `resolveUserSelectFields` の $select 階層と 1:1 に対応。
// PR-B で types.ts の IUserMaster を z.infer<> 導出に置き換える際の SSOT。
// ---------------------------------------------------------------------------

/** CORE: 一覧・ピッカーで必須（ID/表示名/状態/検索キー/日付/フラグ） */
export const UserCoreSchema = z.object({
  Id: z.number(),
  Title: z.string().nullable().optional(),
  UserID: z.string(),
  FullName: z.string(),
  Furigana: z.string().nullable().optional(),
  FullNameKana: z.string().nullable().optional(),
  ContractDate: z.string().nullable().optional(),
  ServiceStartDate: z.string().nullable().optional(),
  ServiceEndDate: z.string().nullable().optional(),
  IsHighIntensitySupportTarget: z.boolean().nullable().optional(),
  IsSupportProcedureTarget: z.boolean().nullable().optional(),
  severeFlag: z.boolean().nullable().optional(),
  IsActive: z.boolean().nullable().optional(),
  TransportToDays: z.array(z.string()).nullable().optional(),
  TransportFromDays: z.array(z.string()).nullable().optional(),
  TransportCourse: z.string().nullable().optional(),
  TransportSchedule: z.string().nullable().optional(),
  AttendanceDays: z.array(z.string()).nullable().optional(),
  RecipientCertNumber: z.string().nullable().optional(),
  RecipientCertExpiry: z.string().nullable().optional(),
  Modified: z.string().nullable().optional(),
  Created: z.string().nullable().optional(),
  // selectMode marker (set by Repository)
  __selectMode: z.enum(['minimal', 'core', 'detail', 'full']).optional(),
});

/** DETAIL: 詳細画面用（CORE + 支給決定情報） */
export const UserDetailSchema = UserCoreSchema.extend({
  UsageStatus: z.string().nullable().optional(),
  GrantMunicipality: z.string().nullable().optional(),
  GrantPeriodStart: z.string().nullable().optional(),
  GrantPeriodEnd: z.string().nullable().optional(),
  DisabilitySupportLevel: z.string().nullable().optional(),
  GrantedDaysPerMonth: z.string().nullable().optional(),
  UserCopayLimit: z.string().nullable().optional(),
});

/** FULL: 請求・監査用（DETAIL + 加算情報 + main branch 拡張） */
export const UserFullSchema = UserDetailSchema.extend({
  TransportAdditionType: z.string().nullable().optional(),
  MealAddition: z.string().nullable().optional(),
  CopayPaymentMethod: z.string().nullable().optional(),
  // main branch integration fields
  OrgCode: z.string().nullable().optional(),
  OrgName: z.string().nullable().optional(),
  Role: z.string().nullable().optional(),
  Email: z.string().nullable().optional(),
  IsDisabled: z.boolean().nullable().optional(),
});

/** Domain output types derived from Zod schemas */
export type UserCore = z.infer<typeof UserCoreSchema>;
export type UserDetail = z.infer<typeof UserDetailSchema>;
export type UserFull = z.infer<typeof UserFullSchema>;

// ---------------------------------------------------------------------------
// Compatibility Aliases (既存 export を維持 — PR-B まで利用側は触らない)
// ---------------------------------------------------------------------------

/**
 * Compatibility Aliases for latest main branch naming
 */
export const userMasterSchema = SpUserMasterItemSchema;
export const userMasterCreateSchema = SpUserMasterItemSchema.omit({ Id: true, Created: true, Modified: true });

export type UserMasterSchema = SpUserMasterRaw;
export type UserMasterCreateSchema = z.infer<typeof userMasterCreateSchema>;

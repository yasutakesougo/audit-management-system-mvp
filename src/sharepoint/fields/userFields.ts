/**
 * SharePoint フィールド定義 — Users_Master
 *
 * IUserMaster / IUserMasterCreateDto 型、
 * FIELD_MAP.Users_Master、SELECT modes (CORE/DETAIL/FULL)
 */
import type { SpUserItem } from '@/types';
import { joinSelect } from './fieldUtils';

export type UserRow = SpUserItem;

// ── セレクトモード型 & リゾルバ ──
export type UserSelectMode = 'core' | 'detail' | 'full';

export interface IUserMaster {
  Id: number;
  Title?: string | null;
  UserID: string;
  FullName: string;
  Furigana?: string | null;
  FullNameKana?: string | null;
  ContractDate?: string | null;
  ServiceStartDate?: string | null;
  ServiceEndDate?: string | null;
  IsHighIntensitySupportTarget?: boolean | null;
  IsSupportProcedureTarget?: boolean | null;  // 支援手順記録対象フラグ
  severeFlag?: boolean | null;
  IsActive?: boolean | null;
  TransportToDays?: string[] | null;
  TransportFromDays?: string[] | null;
  TransportSchedule?: string | null;  // JSON: Record<曜日, { to: TransportMethod, from: TransportMethod }>
  AttendanceDays?: string[] | null;
  RecipientCertNumber?: string | null;
  RecipientCertExpiry?: string | null;
  Modified?: string | null;
  Created?: string | null;

  // 事業所との契約情報 / 利用ステータス
  UsageStatus?: string | null;

  // 支給決定情報
  GrantMunicipality?: string | null;
  GrantPeriodStart?: string | null;
  GrantPeriodEnd?: string | null;
  DisabilitySupportLevel?: string | null;
  GrantedDaysPerMonth?: string | null;
  UserCopayLimit?: string | null;

  // 請求・加算関連情報
  TransportAdditionType?: string | null;
  MealAddition?: string | null;
  CopayPaymentMethod?: string | null;

  // 取得レベルマーカー（Repository から付与、UI 側で表示判定に使用可）
  __selectMode?: UserSelectMode;
}

export interface IUserMasterCreateDto {
  UserID?: string | null;  // システム採番のためフロントからは基本送信しない
  FullName: string;
  Furigana?: string | null;
  FullNameKana?: string | null;
  ContractDate?: string | null;
  ServiceStartDate?: string | null;
  ServiceEndDate?: string | null;
  IsHighIntensitySupportTarget?: boolean | null;
  IsSupportProcedureTarget?: boolean | null;  // 支援手順記録対象フラグ
  severeFlag?: boolean | null;
  IsActive?: boolean | null;
  TransportToDays?: string[] | null;
  TransportFromDays?: string[] | null;
  TransportSchedule?: string | null;
  AttendanceDays?: string[] | null;
  RecipientCertNumber?: string | null;
  RecipientCertExpiry?: string | null;

  // 事業所との契約情報 / 利用ステータス
  UsageStatus?: string | null;

  // 支給決定情報
  GrantMunicipality?: string | null;
  GrantPeriodStart?: string | null;
  GrantPeriodEnd?: string | null;
  DisabilitySupportLevel?: string | null;
  GrantedDaysPerMonth?: string | null;
  UserCopayLimit?: string | null;

  // 請求・加算関連情報
  TransportAdditionType?: string | null;
  MealAddition?: string | null;
  CopayPaymentMethod?: string | null;
}

export const USERS_MASTER_FIELD_MAP = {
  id: 'Id',
  title: 'Title',
  userId: 'UserID',
  fullName: 'FullName',
  furigana: 'Furigana',
  fullNameKana: 'FullNameKana',
  contractDate: 'ContractDate',
  serviceStartDate: 'ServiceStartDate',
  serviceEndDate: 'ServiceEndDate',
  isHighIntensitySupportTarget: 'IsHighIntensitySupportTarget',
  isSupportProcedureTarget: 'IsSupportProcedureTarget',
  severeFlag: 'severeFlag',
  isActive: 'IsActive',
  transportToDays: 'TransportToDays',
  transportFromDays: 'TransportFromDays',
  attendanceDays: 'AttendanceDays',
  recipientCertNumber: 'RecipientCertNumber',
  recipientCertExpiry: 'RecipientCertExpiry',
  modified: 'Modified',
  created: 'Created',
  // ── 支給決定・請求加算（DETAIL/FULL モード用） ──
  usageStatus: 'UsageStatus',
  grantMunicipality: 'GrantMunicipality',
  grantPeriodStart: 'GrantPeriodStart',
  grantPeriodEnd: 'GrantPeriodEnd',
  disabilitySupportLevel: 'DisabilitySupportLevel',
  grantedDaysPerMonth: 'GrantedDaysPerMonth',
  userCopayLimit: 'UserCopayLimit',
  transportAdditionType: 'TransportAdditionType',
  mealAddition: 'MealAddition',
  copayPaymentMethod: 'CopayPaymentMethod',
} as const;

// ── CORE: 一覧表示用（軽量 / 20列） ──
export const USERS_SELECT_FIELDS_CORE = [
  USERS_MASTER_FIELD_MAP.id,
  USERS_MASTER_FIELD_MAP.title,
  USERS_MASTER_FIELD_MAP.userId,
  USERS_MASTER_FIELD_MAP.fullName,
  USERS_MASTER_FIELD_MAP.furigana,
  USERS_MASTER_FIELD_MAP.fullNameKana,
  USERS_MASTER_FIELD_MAP.contractDate,
  USERS_MASTER_FIELD_MAP.serviceStartDate,
  USERS_MASTER_FIELD_MAP.serviceEndDate,
  USERS_MASTER_FIELD_MAP.isHighIntensitySupportTarget,
  USERS_MASTER_FIELD_MAP.isSupportProcedureTarget,
  USERS_MASTER_FIELD_MAP.severeFlag,
  USERS_MASTER_FIELD_MAP.isActive,
  USERS_MASTER_FIELD_MAP.transportToDays,
  USERS_MASTER_FIELD_MAP.transportFromDays,
  USERS_MASTER_FIELD_MAP.attendanceDays,
  USERS_MASTER_FIELD_MAP.recipientCertNumber,
  USERS_MASTER_FIELD_MAP.recipientCertExpiry,
  USERS_MASTER_FIELD_MAP.modified,
  USERS_MASTER_FIELD_MAP.created,
] as const;

// ── DETAIL: 詳細画面用（CORE + 支給決定情報） ──
export const USERS_SELECT_FIELDS_DETAIL = [
  ...USERS_SELECT_FIELDS_CORE,
  USERS_MASTER_FIELD_MAP.usageStatus,
  USERS_MASTER_FIELD_MAP.grantMunicipality,
  USERS_MASTER_FIELD_MAP.grantPeriodStart,
  USERS_MASTER_FIELD_MAP.grantPeriodEnd,
  USERS_MASTER_FIELD_MAP.disabilitySupportLevel,
  USERS_MASTER_FIELD_MAP.grantedDaysPerMonth,
  USERS_MASTER_FIELD_MAP.userCopayLimit,
] as const;

// ── FULL: 請求・監査用（DETAIL + 加算情報） ──
export const USERS_SELECT_FIELDS_FULL = [
  ...USERS_SELECT_FIELDS_DETAIL,
  USERS_MASTER_FIELD_MAP.transportAdditionType,
  USERS_MASTER_FIELD_MAP.mealAddition,
  USERS_MASTER_FIELD_MAP.copayPaymentMethod,
] as const;

export function resolveUserSelectFields(mode: UserSelectMode = 'core'): readonly string[] {
  switch (mode) {
    case 'full':   return USERS_SELECT_FIELDS_FULL;
    case 'detail': return USERS_SELECT_FIELDS_DETAIL;
    default:       return USERS_SELECT_FIELDS_CORE;
  }
}

/** @deprecated Use USERS_SELECT_FIELDS_CORE instead */
export const USERS_SELECT_FIELDS_SAFE = USERS_SELECT_FIELDS_CORE;

export const USERS_SELECT_SAFE = joinSelect(USERS_SELECT_FIELDS_CORE as readonly string[]);

// Backwards compatibility exports (legacy names still in use)
export const USERS_SELECT_FIELDS = USERS_SELECT_FIELDS_CORE;

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
export type UserLifecycleStatus = 'active' | 'suspended' | 'terminated' | 'unknown';

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
  TransportCourse?: string | null;
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
  // ライフサイクル判定（Repository 正規化で付与）
  lifecycleStatus?: UserLifecycleStatus;

  // アセスメント会議実施日（モニタリング会議カウントダウンの起点）
  LastAssessmentDate?: string | null;

  // ── 制度判定属性 (Issue 4-3) ──
  BehaviorScore?: number | null;
  ChildBehaviorScore?: number | null;
  ServiceTypesJson?: string | null;
  EligibilityCheckedAt?: string | null;
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
  TransportCourse?: string | null;
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

  // アセスメント会議実施日
  LastAssessmentDate?: string | null;

  // ── 制度判定属性 (Issue 4-3) ──
  BehaviorScore?: number | null;
  ChildBehaviorScore?: number | null;
  ServiceTypesJson?: string | null;
  EligibilityCheckedAt?: string | null;
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
  severeFlag: 'SevereFlag',
  isActive: 'IsActive',
  transportToDays: 'TransportToDays',
  transportFromDays: 'TransportFromDays',
  transportCourse: 'TransportCourse',
  transportSchedule: 'TransportSchedule',
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
  lastAssessmentDate: 'LastAssessmentDate',
  // ── 制度判定属性 (Issue 4-3) ──
  behaviorScore: 'BehaviorScore',
  childBehaviorScore: 'ChildBehaviorScore',
  serviceTypesJson: 'ServiceTypesJson',
  eligibilityCheckedAt: 'EligibilityCheckedAt',
} as const;

// ── MINIMAL: 緊急フォールバック用（400エラー回避 / 4列） ──
export const USERS_SELECT_FIELDS_MINIMAL = [
  USERS_MASTER_FIELD_MAP.id,
  USERS_MASTER_FIELD_MAP.title,
  USERS_MASTER_FIELD_MAP.userId,
  USERS_MASTER_FIELD_MAP.fullName,
] as const;

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
  USERS_MASTER_FIELD_MAP.usageStatus,
  USERS_MASTER_FIELD_MAP.attendanceDays,
  USERS_MASTER_FIELD_MAP.modified,
  USERS_MASTER_FIELD_MAP.created,
  USERS_MASTER_FIELD_MAP.lastAssessmentDate,
] as const;

// ── DETAIL: 詳細画面用（CORE + 支給決定情報） ──
export const USERS_SELECT_FIELDS_DETAIL = [
  ...USERS_SELECT_FIELDS_CORE,
] as const;

// ── FULL: 請求・監査用（DETAIL + 加算情報） ──
export const USERS_SELECT_FIELDS_FULL = [
  ...USERS_SELECT_FIELDS_DETAIL,
  // 制度判定属性 (Core に残す)
  USERS_MASTER_FIELD_MAP.behaviorScore,
  USERS_MASTER_FIELD_MAP.childBehaviorScore,
  USERS_MASTER_FIELD_MAP.serviceTypesJson,
  USERS_MASTER_FIELD_MAP.eligibilityCheckedAt,
] as const;

export type UserSelectMode = 'minimal' | 'core' | 'detail' | 'full';

export function resolveUserSelectFields(mode: UserSelectMode = 'core'): readonly string[] {
  switch (mode) {
    case 'full':    return USERS_SELECT_FIELDS_FULL;
    case 'detail':  return USERS_SELECT_FIELDS_DETAIL;
    case 'minimal': return USERS_SELECT_FIELDS_MINIMAL;
    default:        return USERS_SELECT_FIELDS_CORE;
  }
}

/** @deprecated Use USERS_SELECT_FIELDS_CORE instead */
export const USERS_SELECT_FIELDS_SAFE = USERS_SELECT_FIELDS_CORE;

export const USERS_SELECT_SAFE = joinSelect(USERS_SELECT_FIELDS_CORE as readonly string[]);

// Backwards compatibility exports (legacy names still in use)
export const USERS_SELECT_FIELDS = USERS_SELECT_FIELDS_CORE;

// 拡張型定義 - 契約・支給決定・加算情報を含む完全版
// Extended types for IUserMaster with contract, grant decision, and billing information

import type { SpUserItem } from '@/types';

// 基本の型定義を拡張
export interface IUserMasterExtended {
  /** SharePoint の内部 ID */
  Id: number;
  Title?: string | null;

  // ===== 基本情報 =====
  UserID: string;                 // 利用者ID（例: U-001）
  FullName: string;              // 氏名
  Furigana: string | null;       // ふりがな（ひらがな）
  FullNameKana: string | null;   // カタカナ氏名

  // ===== 契約・サービス情報 =====
  ContractDate: string | null;        // 契約日 (YYYY-MM-DD)
  ServiceStartDate: string | null;    // サービス開始日
  ServiceEndDate: string | null;      // サービス終了日

  // 事業所との契約情報 / 利用ステータス
  UsageStatus: string | null; // 例: "利用中" | "契約済・利用開始待ち" | "利用休止中" | "契約終了"

  // ===== 支給決定情報（受給者証） =====
  GrantMunicipality: string | null;   // 支給決定市町村
  GrantPeriodStart: string | null;    // 支給決定期間（開始）
  GrantPeriodEnd: string | null;      // 支給決定期間（終了）
  DisabilitySupportLevel: string | null; // 区分1〜6, none, など
  GrantedDaysPerMonth: string | null;    // 契約支給量（日数／月） "20" など
  UserCopayLimit: string | null;         // 利用者負担上限月額（円） "9300" など

  RecipientCertNumber: string | null; // 受給者証番号
  RecipientCertExpiry: string | null; // 受給者証有効期限

  // ===== 支援区分・ステータス =====
  IsHighIntensitySupportTarget: boolean; // 強度行動障害支援対象者フラグ
  IsSupportProcedureTarget?: boolean | null;  // 支援手順記録対象フラグ
  severeFlag: boolean;                   // 既存の「重度区分」フラグ（今回も残す）

  IsActive: boolean; // システム内部用「利用中」フラグ

  // ===== 送迎・通所情報 =====
  TransportToDays: string[] | null;     // 送迎（往路）曜日 ["月","水"] など
  TransportFromDays: string[] | null;   // 送迎（復路）
  AttendanceDays: string[] | null;      // 通所予定日

  // ===== 請求・加算関連情報 =====
  TransportAdditionType: string | null;   // "both" | "oneway-to" | "oneway-from" | "none" など
  MealAddition: string | null;            // "use" | "not-use" など
  CopayPaymentMethod: string | null;      // "bank" | "cash-office" | "cash-transport" など

  // ===== SharePoint システムフィールド =====
  Modified?: string | null;
  Created?: string | null;
}

export interface IUserMasterCreateDtoExtended {
  // SharePoint 登録時に不要なら Id は省略
  // Id?: number;

  // ===== 基本情報 =====
  UserID: string;
  FullName: string;
  Furigana: string | null;
  FullNameKana: string | null;

  // ===== 契約・サービス情報 =====
  ContractDate: string | null;
  ServiceStartDate: string | null;
  ServiceEndDate: string | null;

  UsageStatus: string | null;

  // ===== 支給決定情報 =====
  GrantMunicipality: string | null;
  GrantPeriodStart: string | null;
  GrantPeriodEnd: string | null;
  DisabilitySupportLevel: string | null;
  GrantedDaysPerMonth: string | null;
  UserCopayLimit: string | null;

  RecipientCertNumber: string | null;
  RecipientCertExpiry: string | null;

  // ===== 支援区分・ステータス =====
  IsHighIntensitySupportTarget: boolean;
  IsSupportProcedureTarget?: boolean | null;
  severeFlag: boolean;
  IsActive: boolean;

  // ===== 送迎・通所情報 =====
  TransportToDays: string[] | null;
  TransportFromDays: string[] | null;
  AttendanceDays: string[] | null;

  // ===== 請求・加算関連情報 =====
  TransportAdditionType: string | null;
  MealAddition: string | null;
  CopayPaymentMethod: string | null;
}

// 型安全性のための定数定義とunion型
export const USAGE_STATUS_VALUES = {
  ACTIVE: '利用中',
  PENDING: '契約済・利用開始待ち',
  SUSPENDED: '利用休止中',
  TERMINATED: '契約終了',
} as const;

export const DISABILITY_SUPPORT_LEVEL_VALUES = {
  NONE: 'none',
  LEVEL_1: '1',
  LEVEL_2: '2',
  LEVEL_3: '3',
  LEVEL_4: '4',
  LEVEL_5: '5',
  LEVEL_6: '6',
} as const;

export const TRANSPORT_ADDITION_TYPE_VALUES = {
  BOTH: 'both',
  TO_ONLY: 'oneway-to',
  FROM_ONLY: 'oneway-from',
  NONE: 'none',
} as const;

export const MEAL_ADDITION_VALUES = {
  USE: 'use',
  NOT_USE: 'not-use',
} as const;

export const COPAY_PAYMENT_METHOD_VALUES = {
  BANK: 'bank',
  CASH_OFFICE: 'cash-office',
  CASH_TRANSPORT: 'cash-transport',
} as const;

// Union型の定義
export type UsageStatusType = typeof USAGE_STATUS_VALUES[keyof typeof USAGE_STATUS_VALUES];
export type DisabilitySupportLevelType = typeof DISABILITY_SUPPORT_LEVEL_VALUES[keyof typeof DISABILITY_SUPPORT_LEVEL_VALUES];
export type TransportAdditionType = typeof TRANSPORT_ADDITION_TYPE_VALUES[keyof typeof TRANSPORT_ADDITION_TYPE_VALUES];
export type MealAdditionType = typeof MEAL_ADDITION_VALUES[keyof typeof MEAL_ADDITION_VALUES];
export type CopayPaymentMethodType = typeof COPAY_PAYMENT_METHOD_VALUES[keyof typeof COPAY_PAYMENT_METHOD_VALUES];

// SelectField用のオプション配列
export const USAGE_STATUS_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: USAGE_STATUS_VALUES.ACTIVE, label: '利用中' },
  { value: USAGE_STATUS_VALUES.PENDING, label: '契約済・利用開始待ち' },
  { value: USAGE_STATUS_VALUES.SUSPENDED, label: '利用休止中' },
  { value: USAGE_STATUS_VALUES.TERMINATED, label: '契約終了' },
] as const;

export const DISABILITY_SUPPORT_LEVEL_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: DISABILITY_SUPPORT_LEVEL_VALUES.NONE, label: '非該当' },
  { value: DISABILITY_SUPPORT_LEVEL_VALUES.LEVEL_1, label: '区分1' },
  { value: DISABILITY_SUPPORT_LEVEL_VALUES.LEVEL_2, label: '区分2' },
  { value: DISABILITY_SUPPORT_LEVEL_VALUES.LEVEL_3, label: '区分3' },
  { value: DISABILITY_SUPPORT_LEVEL_VALUES.LEVEL_4, label: '区分4' },
  { value: DISABILITY_SUPPORT_LEVEL_VALUES.LEVEL_5, label: '区分5' },
  { value: DISABILITY_SUPPORT_LEVEL_VALUES.LEVEL_6, label: '区分6' },
] as const;

export const TRANSPORT_ADDITION_TYPE_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: TRANSPORT_ADDITION_TYPE_VALUES.BOTH, label: '往復利用' },
  { value: TRANSPORT_ADDITION_TYPE_VALUES.TO_ONLY, label: '片道（往）のみ' },
  { value: TRANSPORT_ADDITION_TYPE_VALUES.FROM_ONLY, label: '片道（復）のみ' },
  { value: TRANSPORT_ADDITION_TYPE_VALUES.NONE, label: '利用なし' },
] as const;

export const MEAL_ADDITION_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: MEAL_ADDITION_VALUES.USE, label: '利用する' },
  { value: MEAL_ADDITION_VALUES.NOT_USE, label: '利用しない' },
] as const;

export const COPAY_PAYMENT_METHOD_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: COPAY_PAYMENT_METHOD_VALUES.BANK, label: '口座振替' },
  { value: COPAY_PAYMENT_METHOD_VALUES.CASH_OFFICE, label: '現金（事業所）' },
  { value: COPAY_PAYMENT_METHOD_VALUES.CASH_TRANSPORT, label: '現金（送迎時）' },
] as const;

// 旧型との互換性を保つためのタイプエイリアス（段階的移行用）
export type IUserMaster = IUserMasterExtended;
export type IUserMasterCreateDto = IUserMasterCreateDtoExtended;

// エクスポートする基本型定義も合わせて提供
export type UserRow = SpUserItem;
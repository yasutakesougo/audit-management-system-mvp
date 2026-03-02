/**
 * typesExtended.ts — 値定数 + 型 re-export
 *
 * PR-C: インターフェース実体定義を削除。
 * 型の SSOT は schema.ts、値定数はここに残す。
 *
 * IUserMaster / IUserMasterCreateDto は types.ts 経由で取得すること。
 */

// ---------------------------------------------------------------------------
// 型の re-export（SSOT = schema.ts → types.ts 経由）
// ---------------------------------------------------------------------------
export type { IUserMaster, IUserMasterCreateDto, UserCore, UserDetail, UserFull } from './types';

// ---------------------------------------------------------------------------
// 値定数（union 型の元データ）
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Union 型（値定数から導出）
// ---------------------------------------------------------------------------

export type UsageStatusType = typeof USAGE_STATUS_VALUES[keyof typeof USAGE_STATUS_VALUES];
export type DisabilitySupportLevelType = typeof DISABILITY_SUPPORT_LEVEL_VALUES[keyof typeof DISABILITY_SUPPORT_LEVEL_VALUES];
export type TransportAdditionType = typeof TRANSPORT_ADDITION_TYPE_VALUES[keyof typeof TRANSPORT_ADDITION_TYPE_VALUES];
export type MealAdditionType = typeof MEAL_ADDITION_VALUES[keyof typeof MEAL_ADDITION_VALUES];
export type CopayPaymentMethodType = typeof COPAY_PAYMENT_METHOD_VALUES[keyof typeof COPAY_PAYMENT_METHOD_VALUES];

// ---------------------------------------------------------------------------
// Select フィールド用オプション配列
// ---------------------------------------------------------------------------

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

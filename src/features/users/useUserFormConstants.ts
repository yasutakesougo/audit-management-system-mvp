/**
 * useUserFormConstants
 *
 * useUserForm フックで使用する定数・オプション配列をまとめたファイル。
 * 副作用なし、ランタイム値のみ。
 */
import { TRANSPORT_METHOD_LABEL, TRANSPORT_METHODS } from '../attendance/transportMethod';
import { TRANSPORT_COURSE_OPTIONS as COURSE_OPTIONS } from '../today/transport/transportCourse';
import type { FormValues } from './useUserFormTypes';

// ---------------------------------------------------------------------------
// 曜日リスト
// ---------------------------------------------------------------------------

export const WEEKDAYS = [
  { value: '月', label: '月' },
  { value: '火', label: '火' },
  { value: '水', label: '水' },
  { value: '木', label: '木' },
  { value: '金', label: '金' },
] as const;

// ---------------------------------------------------------------------------
// 選択肢配列
// ---------------------------------------------------------------------------

export const USAGE_STATUS_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: '利用中', label: '利用中' },
  { value: '契約済・利用開始待ち', label: '契約済・利用開始待ち' },
  { value: '利用休止中', label: '利用休止中' },
  { value: '契約終了', label: '契約終了' },
] as const;

export const DISABILITY_SUPPORT_LEVEL_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: 'none', label: '非該当' },
  { value: '1', label: '区分1' },
  { value: '2', label: '区分2' },
  { value: '3', label: '区分3' },
  { value: '4', label: '区分4' },
  { value: '5', label: '区分5' },
  { value: '6', label: '区分6' },
] as const;

export const TRANSPORT_ADDITION_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: 'both', label: '往復利用' },
  { value: 'oneway-to', label: '片道（往）のみ' },
  { value: 'oneway-from', label: '片道（復）のみ' },
  { value: 'none', label: '利用なし' },
] as const;

export const MEAL_ADDITION_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: 'use', label: '利用する' },
  { value: 'not-use', label: '利用しない' },
] as const;

export const COPAY_METHOD_OPTIONS = [
  { value: '', label: '（未選択）' },
  { value: 'bank', label: '口座振替' },
  { value: 'cash-office', label: '現金（事業所）' },
  { value: 'cash-transport', label: '現金（送迎時）' },
] as const;

export const TRANSPORT_METHOD_OPTIONS = [
  { value: '', label: '—' },
  ...TRANSPORT_METHODS.map((m) => ({ value: m, label: TRANSPORT_METHOD_LABEL[m] })),
] as const;

export const TRANSPORT_COURSE_OPTIONS = [
  { value: '', label: '未設定' },
  ...COURSE_OPTIONS,
] as const;

// ---------------------------------------------------------------------------
// フォームクリア値（デフォルト状態）
// ---------------------------------------------------------------------------

export const CLEARED_VALUES: FormValues = {
  FullName: '',
  Furigana: '',
  FullNameKana: '',
  ContractDate: '',
  ServiceStartDate: '',
  ServiceEndDate: '',
  IsHighIntensitySupportTarget: false,
  IsSupportProcedureTarget: false,
  IsActive: true,
  TransportCourse: '',
  TransportSchedule: {},
  RecipientCertNumber: '',
  RecipientCertExpiry: '',
  UsageStatus: '',
  GrantMunicipality: '',
  GrantPeriodStart: '',
  GrantPeriodEnd: '',
  DisabilitySupportLevel: '',
  GrantedDaysPerMonth: '',
  UserCopayLimit: '',
  TransportAdditionType: '',
  MealAddition: '',
  CopayPaymentMethod: '',
};

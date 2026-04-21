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

// ── 1. Users_Master (Core) ──
/** 氏名・ID・有効フラグ等、アプリ動作に必須または基本となるフィールド */
export const USERS_MASTER_CORE_FIELD_MAP = {
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
  severeFlag: 'SevereFlag', // Deprecated/Legacy fallback
  isActive: 'IsActive',
  usageStatus: 'UsageStatus',
  attendanceDays: 'AttendanceDays',
  modified: 'Modified',
  created: 'Created',
} as const;

/** アセスメント日や制度判定スコア等、特定の機能（監査・請求等）でのみ使用する拡張フィールド */
export const USERS_MASTER_COMPLIANCE_FIELD_MAP = {
  lastAssessmentDate: 'LastAssessmentDate',
  behaviorScore: 'BehaviorScore',
  childBehaviorScore: 'ChildBehaviorScore',
  serviceTypesJson: 'ServiceTypesJson',
  eligibilityCheckedAt: 'EligibilityCheckedAt',
} as const;

// ── Common Candidates (SSOT) ──
const CANDIDATE_USER_ID = ['UserID', 'User ID', 'UserCode', 'userId', 'cr013_userId', 'PersonID', 'Title'];
const CANDIDATE_FULL_NAME = ['FullName', 'Name', 'DisplayName', 'FullName0', 'cr013_fullName'];
const CANDIDATE_FURIGANA = ['Furigana', 'Kana', 'FullNameFurigana', 'cr013_furigana'];
const CANDIDATE_FULL_NAME_KANA = ['FullNameKana', 'FullName_Kana', 'cr013_fullNameKana'];
const CANDIDATE_CONTRACT_DATE = ['ContractDate', 'Contract_Date', 'cr013_contractDate'];
const CANDIDATE_SERVICE_START_DATE = ['ServiceStartDate', 'StartDate', 'cr013_serviceStartDate'];
const CANDIDATE_SERVICE_END_DATE = ['ServiceEndDate', 'EndDate', 'cr013_serviceEndDate'];
const CANDIDATE_IS_HIGH_INTENSITY = ['IsHighIntensitySupportTarget', 'IntensityTarget', 'IsHighIntensitySupportTarget0', 'cr013_isHighIntensity'];
const CANDIDATE_IS_SUPPORT_PROCEDURE = ['IsSupportProcedureTarget', 'ProcedureTarget', 'cr013_isSupportProcedure'];
const CANDIDATE_IS_ACTIVE = ['IsActive', 'Active', 'IsEnabled', 'cr013_isActive'];
const CANDIDATE_USAGE_STATUS = ['UsageStatus', 'Status', 'UsageStatus0', 'cr013_usageStatus'];
const CANDIDATE_ATTENDANCE_DAYS = ['AttendanceDays', 'WorkDays', 'cr013_attendanceDays'];

// Transport candidates
const CANDIDATE_TRANSPORT_TO_DAYS = ['TransportToDays', 'cr013_transportToDays'];
const CANDIDATE_TRANSPORT_FROM_DAYS = ['TransportFromDays', 'cr013_transportFromDays'];
const CANDIDATE_TRANSPORT_COURSE = ['TransportCourse', 'cr013_transportCourse'];
const CANDIDATE_TRANSPORT_SCHEDULE = ['TransportSchedule', 'cr013_transportSchedule'];
const CANDIDATE_TRANSPORT_ADDITION_TYPE = ['TransportAdditionType', 'cr013_transportAdditionType'];

// Benefit candidates
const CANDIDATE_RECIPIENT_CERT_NUMBER = [
  'RecipientCertNumber', 'Recipient Cert Number', 'CertNumber', 'RecipientCert',
  'RecipientCertNo', 'BenefitCertNumber', 'RecipientCertificateNumber',
  'RecipientCertNumber0', 'cr013_recipientCertNumber',
];
const CANDIDATE_RECIPIENT_CERT_EXPIRY = ['RecipientCertExpiry', 'CertExpiry', 'RecipientCertExpiry0', 'cr013_recipientCertExpiry'];
const CANDIDATE_GRANT_MUNICIPALITY = ['GrantMunicipality', 'Municipality', 'GrantMunicipality0', 'cr013_grantMunicipality'];
const CANDIDATE_GRANT_PERIOD_START = ['GrantPeriodStart', 'PeriodStart', 'GrantPeriodStart0', 'cr013_grantPeriodStart'];
const CANDIDATE_GRANT_PERIOD_END = ['GrantPeriodEnd', 'PeriodEnd', 'GrantPeriodEnd0', 'cr013_grantPeriodEnd'];
const CANDIDATE_DISABILITY_SUPPORT_LEVEL = ['DisabilitySupportLevel', 'SupportLevel', 'DisabilitySupportLevel0', 'cr013_disabilitySupportLevel'];
const CANDIDATE_GRANTED_DAYS_PER_MONTH = ['GrantedDaysPerMonth', 'DaysPerMonth', 'GrantedDaysPerMonth0', 'cr013_grantedDaysPerMonth'];
const CANDIDATE_USER_COPAY_LIMIT = ['UserCopayLimit', 'CopayLimit', 'UserCopayLimit0', 'cr013_userCopayLimit'];
const CANDIDATE_MEAL_ADDITION = ['MealAddition', 'Meal', 'MealAddition0', 'cr013_mealAddition'];
const CANDIDATE_COPAY_PAYMENT_METHOD = ['CopayPaymentMethod', 'PaymentMethod', 'CopayPaymentMethod0', 'cr013_copayPaymentMethod'];

/**
 * Users_Master リストのフィールド解除候補マップ (Drift Resistance)
 * 1番目の候補（基準名）以外は drift (WARN) と見なされる。
 */
export const USERS_MASTER_CANDIDATES = {
  userId: CANDIDATE_USER_ID,
  fullName: CANDIDATE_FULL_NAME,
  furigana: CANDIDATE_FURIGANA,
  fullNameKana: CANDIDATE_FULL_NAME_KANA,
  contractDate: CANDIDATE_CONTRACT_DATE,
  serviceStartDate: CANDIDATE_SERVICE_START_DATE,
  serviceEndDate: CANDIDATE_SERVICE_END_DATE,
  isHighIntensitySupportTarget: CANDIDATE_IS_HIGH_INTENSITY,
  isSupportProcedureTarget: CANDIDATE_IS_SUPPORT_PROCEDURE,
  isActive: CANDIDATE_IS_ACTIVE,
  usageStatus: CANDIDATE_USAGE_STATUS,
  attendanceDays: CANDIDATE_ATTENDANCE_DAYS,
  // Accessory: Transport
  transportToDays: CANDIDATE_TRANSPORT_TO_DAYS,
  transportFromDays: CANDIDATE_TRANSPORT_FROM_DAYS,
  transportCourse: CANDIDATE_TRANSPORT_COURSE,
  transportSchedule: CANDIDATE_TRANSPORT_SCHEDULE,
  transportAdditionType: CANDIDATE_TRANSPORT_ADDITION_TYPE,
  // Accessory: Benefit
  recipientCertNumber: CANDIDATE_RECIPIENT_CERT_NUMBER,
  recipientCertExpiry: CANDIDATE_RECIPIENT_CERT_EXPIRY,
  grantMunicipality: CANDIDATE_GRANT_MUNICIPALITY,
  grantPeriodStart: CANDIDATE_GRANT_PERIOD_START,
  grantPeriodEnd: CANDIDATE_GRANT_PERIOD_END,
  disabilitySupportLevel: CANDIDATE_DISABILITY_SUPPORT_LEVEL,
  grantedDaysPerMonth: CANDIDATE_GRANTED_DAYS_PER_MONTH,
  userCopayLimit: CANDIDATE_USER_COPAY_LIMIT,
  mealAddition: CANDIDATE_MEAL_ADDITION,
  copayPaymentMethod: CANDIDATE_COPAY_PAYMENT_METHOD,
  // Compliance
  lastAssessmentDate: [
    'Last_x0020_Assessment_x0020_Date', 'LastAssessmentDate', 'AssessmentDate', 'cr013_lastAssessmentDate'
  ],
  behaviorScore: [
    'Behavior_x0020_Score', 'BehaviorScore', 'ScoreBehavior', 'cr013_behaviorScore'
  ],
  childBehaviorScore: [
    'Child_x0020_Behavior_x0020_Score', 'ChildBehaviorScore', 'ScoreChildBehavior', 'cr013_childBehaviorScore'
  ],
  serviceTypesJson: [
    'Service_x0020_Types_x0020_JSON', 'ServiceTypesJson', 'ServiceTypes', 'cr013_serviceTypesJson'
  ],
  eligibilityCheckedAt: [
    'Eligibility_x0020_Checked_x0020_', 'EligibilityCheckedAt', 'EligibilityChecked', 'cr013_eligibilityCheckedAt'
  ],
} as const;

export const USERS_MASTER_ESSENTIALS: (keyof typeof USERS_MASTER_CANDIDATES)[] = [
  'userId',
  'fullName',
  'isActive',
  'usageStatus',
];


// ── 2. Accessory Lists (Transport/Benefit) ──
// NOTE: These fields are now managed in separate SharePoint lists to avoid row size limits.
// Joined by UserID into the domain model.
export const USERS_TRANSPORT_FIELD_MAP = {
  transportToDays: 'TransportToDays',
  transportFromDays: 'TransportFromDays',
  transportCourse: 'TransportCourse',
  transportSchedule: 'TransportSchedule',
  transportAdditionType: 'TransportAdditionType',
} as const;

export const USERS_BENEFIT_FIELD_MAP = {
  // recipientCertNumber moved to USERS_BENEFIT_EXT_FIELD_MAP due to 8KB limit
  recipientCertExpiry: 'RecipientCertExpiry',
  grantMunicipality: 'GrantMunicipality',
  grantPeriodStart: 'GrantPeriodStart',
  grantPeriodEnd: 'GrantPeriodEnd',
  disabilitySupportLevel: 'DisabilitySupportLevel',
  grantedDaysPerMonth: 'GrantedDaysPerMonth',
  userCopayLimit: 'UserCopayLimit',
  mealAddition: 'MealAddition',
  copayPaymentMethod: 'CopayPaymentMethod',
} as const;

export const USERS_BENEFIT_EXT_FIELD_MAP = {
  recipientCertNumber: 'RecipientCertNumber',
} as const;

/** 統合 FIELD_MAP (後方互換用) */
export const USERS_MASTER_FIELD_MAP = {
  ...USERS_MASTER_CORE_FIELD_MAP,
  ...USERS_MASTER_COMPLIANCE_FIELD_MAP,
  ...USERS_TRANSPORT_FIELD_MAP,
  ...USERS_BENEFIT_FIELD_MAP,
  ...USERS_BENEFIT_EXT_FIELD_MAP,
} as const;

// ── MINIMAL: 緊急フォールバック用（400エラー回避 / 4列） ──
export const USERS_SELECT_FIELDS_MINIMAL = [
  USERS_MASTER_FIELD_MAP.id,
  USERS_MASTER_FIELD_MAP.title,
  USERS_MASTER_FIELD_MAP.userId,
  USERS_MASTER_FIELD_MAP.fullName,
] as const;

// ── CORE: 一覧表示用（軽量 / 基本識別・在籍確認・送迎判定に必須な列） ──
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
  USERS_MASTER_FIELD_MAP.transportCourse,
  USERS_MASTER_FIELD_MAP.modified,
  USERS_MASTER_FIELD_MAP.created,
  USERS_MASTER_FIELD_MAP.lastAssessmentDate,
] as const;

// ── DETAIL: 詳細画面用（CORE + 支給決定情報） ──
export const USERS_SELECT_FIELDS_DETAIL = [
  ...USERS_SELECT_FIELDS_CORE,
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

// ── User Benefit Profile (user_benefit_profile) — Drift Resistance ──────────

/**
 * user_benefit_profile リストのフィールド解決候補マップ (Drift Resistance)
 * 1番目の候補（基準名）以外は drift (WARN) と見なされる。
 *
 * essentialFields (registry): ['UserID', 'RecipientCertNumber']
 */
export const USER_BENEFIT_PROFILE_CANDIDATES = {
  userId: CANDIDATE_USER_ID,
  recipientCertNumber: CANDIDATE_RECIPIENT_CERT_NUMBER,
  recipientCertExpiry: CANDIDATE_RECIPIENT_CERT_EXPIRY,
  grantMunicipality: CANDIDATE_GRANT_MUNICIPALITY,
  grantPeriodStart: CANDIDATE_GRANT_PERIOD_START,
  grantPeriodEnd: CANDIDATE_GRANT_PERIOD_END,
  disabilitySupportLevel: CANDIDATE_DISABILITY_SUPPORT_LEVEL,
  grantedDaysPerMonth: CANDIDATE_GRANTED_DAYS_PER_MONTH,
  userCopayLimit: CANDIDATE_USER_COPAY_LIMIT,
  mealAddition: CANDIDATE_MEAL_ADDITION,
  copayPaymentMethod: CANDIDATE_COPAY_PAYMENT_METHOD,
} as const;

/**
 * user_benefit_profile の必須フィールドキー。
 * これらが欠落した場合は FAIL（リスト読み書き不能）。
 * UserID: 利用者を特定できない。RecipientCertNumber: 受給者証番号なしでは制度請求不可。
 */
export const USER_BENEFIT_PROFILE_ESSENTIALS: (keyof typeof USER_BENEFIT_PROFILE_CANDIDATES)[] = [
  'userId',
];

// ── User Transport Settings (user_transport_settings) — Drift Resistance ──────────

/**
 * user_transport_settings リストのフィールド解決候補マップ (Drift Resistance)
 */
export const USER_TRANSPORT_SETTINGS_CANDIDATES = {
  userId: CANDIDATE_USER_ID,
  transportToDays: CANDIDATE_TRANSPORT_TO_DAYS,
  transportFromDays: CANDIDATE_TRANSPORT_FROM_DAYS,
  transportCourse: CANDIDATE_TRANSPORT_COURSE,
  transportSchedule: CANDIDATE_TRANSPORT_SCHEDULE,
  transportAdditionType: CANDIDATE_TRANSPORT_ADDITION_TYPE,
} as const;

export const USER_TRANSPORT_SETTINGS_ESSENTIALS: (keyof typeof USER_TRANSPORT_SETTINGS_CANDIDATES)[] = [
  'userId',
];

// ── User Benefit Profile EXT (user_benefit_profile_ext) ──
export const USER_BENEFIT_PROFILE_EXT_CANDIDATES = {
  userId: CANDIDATE_USER_ID,
  recipientCertNumber: CANDIDATE_RECIPIENT_CERT_NUMBER,
} as const;

export const USER_BENEFIT_PROFILE_EXT_ESSENTIALS: (keyof typeof USER_BENEFIT_PROFILE_EXT_CANDIDATES)[] = [
  'userId',
  'recipientCertNumber',
];

/** @deprecated Use USERS_SELECT_FIELDS_CORE instead */
export const USERS_SELECT_FIELDS_SAFE = USERS_SELECT_FIELDS_CORE;

export const USERS_SELECT_SAFE = joinSelect(USERS_SELECT_FIELDS_CORE as readonly string[]);

// Backwards compatibility exports (legacy names still in use)
export const USERS_SELECT_FIELDS = USERS_SELECT_FIELDS_CORE;

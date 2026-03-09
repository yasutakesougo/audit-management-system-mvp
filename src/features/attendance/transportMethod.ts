/**
 * Transport Method Types & Utilities
 *
 * 送迎手段の種類定義と、boolean↔enum の互換変換ユーティリティ。
 * 既存の transportTo/From: boolean との後方互換を維持しつつ、
 * 段階的にenum移行を進めるための共通モジュール。
 *
 * 福祉施設の送迎パターン対応:
 * - 事業所送迎(○), 家族送迎(K+手段), ショートステイ(SS), 一時ケア, 他施設
 */

// ---------------------------------------------------------------------------
// Type & Constants
// ---------------------------------------------------------------------------

export type TransportMethod =
  | 'self'
  | 'office_shuttle'
  | 'guide_helper'
  | 'family'           // legacy: 家族（一般）→ family_car として扱う
  | 'family_car'       // 家族送迎（車）KK
  | 'family_train'     // 家族送迎（電車）KD
  | 'family_bus'       // 家族送迎（バス）KB
  | 'family_walk'      // 家族送迎（徒歩）KT
  | 'short_stay'       // ショートステイ SS
  | 'temporary_care'   // 一時ケア
  | 'other_facility'   // 他施設の送迎（施設名をnoteに記載）
  | 'other';

export const TRANSPORT_METHOD_LABEL: Record<TransportMethod, string> = {
  self: '自力通所（徒歩）',
  office_shuttle: '送迎（事業所）',
  guide_helper: 'ガイドヘルパー',
  family: '家族送迎（車）',
  family_car: '家族送迎（車）',
  family_train: '家族送迎（電車）',
  family_bus: '家族送迎（バス）',
  family_walk: '家族送迎（徒歩）',
  short_stay: 'ショートステイ',
  temporary_care: '一時ケア',
  other_facility: '他施設の送迎',
  other: 'その他',
};

export const TRANSPORT_METHODS: readonly TransportMethod[] = [
  'self',
  'office_shuttle',
  'guide_helper',
  'family',
  'family_car',
  'family_train',
  'family_bus',
  'family_walk',
  'short_stay',
  'temporary_care',
  'other_facility',
  'other',
] as const;

/**
 * UI用のグループ化された送迎手段選択肢
 * AttendanceDetailDrawer の Select で ListSubheader と共に使用
 */
export const TRANSPORT_METHOD_GROUPS = [
  {
    label: '事業所',
    methods: ['office_shuttle', 'guide_helper'] as TransportMethod[],
  },
  {
    label: '家族送迎',
    methods: ['family_car', 'family_train', 'family_bus', 'family_walk'] as TransportMethod[],
  },
  {
    label: '自力・その他',
    methods: ['self', 'short_stay', 'temporary_care', 'other_facility', 'other'] as TransportMethod[],
  },
] as const;

// ---------------------------------------------------------------------------
// Family Helpers
// ---------------------------------------------------------------------------

const FAMILY_METHODS: readonly TransportMethod[] = [
  'family', 'family_car', 'family_train', 'family_bus', 'family_walk',
];

/**
 * 家族送迎系の判定（family / family_* いずれか）
 */
export function isFamily(method: TransportMethod): boolean {
  return FAMILY_METHODS.includes(method);
}

/**
 * noteフィールドの入力が必要な手段か
 */
export function requiresNote(method: TransportMethod): boolean {
  return method === 'other_facility' || method === 'other';
}

// ---------------------------------------------------------------------------
// Journal Symbol Generation
// ---------------------------------------------------------------------------

/**
 * 日誌表示用の送迎記号を生成する（全角統一）
 *
 * ルール:
 * - 事業所送迎 → ○
 * - 家族(車) → ＫＫ, 家族(電車) → ＫＤ, 家族(バス) → ＫＢ, 家族(徒歩) → ＫＴ
 * - ショートステイ → ＳＳ（明けも含む）
 * - 一時ケア → 一時ケア
 * - 他施設 → noteの施設名をそのまま出力
 * - 自力 → Ｔ（徒歩）
 * - ガイドヘルパー → ○
 */
export function generateTransportSymbol(method?: TransportMethod, note?: string): string {
  if (!method) return '';

  switch (method) {
    case 'office_shuttle':
    case 'guide_helper':
      return '○';
    case 'family':
    case 'family_car':
      return 'ＫＫ';
    case 'family_train':
      return 'ＫＤ';
    case 'family_bus':
      return 'ＫＢ';
    case 'family_walk':
      return 'ＫＴ';
    case 'short_stay':
      return 'ＳＳ';
    case 'temporary_care':
      return '一時ケア';
    case 'other_facility':
      return note?.trim() || '他施設';
    case 'self':
      return 'Ｔ';
    case 'other':
      return note?.trim() || 'その他';
    default:
      return '';
  }
}

// ---------------------------------------------------------------------------
// Conversion Utilities（互換の核）
// ---------------------------------------------------------------------------

/**
 * 既存 boolean → TransportMethod 推定
 * true = 事業所送迎, false = 自力通所
 */
export function inferMethodFromBool(v: boolean): TransportMethod {
  return v ? 'office_shuttle' : 'self';
}

/**
 * TransportMethod → 既存 boolean 派生
 * office_shuttle のみ true（送迎加算対象）
 */
export function methodImpliesShuttle(method: TransportMethod): boolean {
  return method === 'office_shuttle';
}

// ---------------------------------------------------------------------------
// Resolution（method優先 → boolean fallback → user default fallback）
// ---------------------------------------------------------------------------

type HasDefaults = {
  isTransportTarget: boolean;
  defaultTransportToMethod?: TransportMethod;
  defaultTransportFromMethod?: TransportMethod;
};

type HasVisit = {
  transportTo: boolean;
  transportFrom: boolean;
  transportToMethod?: TransportMethod;
  transportFromMethod?: TransportMethod;
};

/**
 * 行き送迎手段を解決する
 * 優先順: visit.method → visit.boolean推定 → user.default → user.isTransportTarget推定
 */
export function resolveToMethod(user: HasDefaults, visit?: HasVisit): TransportMethod {
  if (visit?.transportToMethod) return visit.transportToMethod;
  if (visit) return inferMethodFromBool(visit.transportTo);
  return user.defaultTransportToMethod ?? (user.isTransportTarget ? 'office_shuttle' : 'self');
}

/**
 * 帰り送迎手段を解決する
 * 優先順: visit.method → visit.boolean推定 → user.default → user.isTransportTarget推定
 */
export function resolveFromMethod(user: HasDefaults, visit?: HasVisit): TransportMethod {
  if (visit?.transportFromMethod) return visit.transportFromMethod;
  if (visit) return inferMethodFromBool(visit.transportFrom);
  return user.defaultTransportFromMethod ?? (user.isTransportTarget ? 'office_shuttle' : 'self');
}

/**
 * 任意の文字列が有効な TransportMethod かどうかを判定
 */
export function isTransportMethod(value: unknown): value is TransportMethod {
  return typeof value === 'string' && TRANSPORT_METHODS.includes(value as TransportMethod);
}

/**
 * unknown → TransportMethod | undefined（SP読み込み時に使用）
 */
export function parseTransportMethod(value: unknown): TransportMethod | undefined {
  return isTransportMethod(value) ? value : undefined;
}

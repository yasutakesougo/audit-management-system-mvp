/**
 * Transport Method Types & Utilities
 *
 * 送迎手段の種類定義と、boolean↔enum の互換変換ユーティリティ。
 * 既存の transportTo/From: boolean との後方互換を維持しつつ、
 * 段階的にenum移行を進めるための共通モジュール。
 */

// ---------------------------------------------------------------------------
// Type & Constants
// ---------------------------------------------------------------------------

export type TransportMethod = 'self' | 'office_shuttle' | 'guide_helper' | 'family' | 'other';

export const TRANSPORT_METHOD_LABEL: Record<TransportMethod, string> = {
  self: '自力通所',
  office_shuttle: '送迎（事業所）',
  guide_helper: 'ガイドヘルパー',
  family: '家族',
  other: 'その他',
};

export const TRANSPORT_METHODS: readonly TransportMethod[] = [
  'self',
  'office_shuttle',
  'guide_helper',
  'family',
  'other',
] as const;

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

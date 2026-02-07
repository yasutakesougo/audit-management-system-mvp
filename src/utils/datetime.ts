/**
 * 日時フォーマット用の入力型
 * - string: ISO8601形式 ("2025-01-15T09:30:00Z")
 * - number: Unix timestamp (ミリ秒)
 * - Date: Date オブジェクト
 * - null/undefined: 無効な日時を表す
 */
type FormatRangeInput = string | number | Date | null | undefined;

/**
 * 日時フォーマットのオプション
 */
export type FormatRangeOptions = {
  /** タイムゾーン (デフォルト: 'Asia/Tokyo') */
  tz?: string;
  /** 丸める分数 (例: 15分刻みなら 15) */
  roundTo?: number;
  /** 丸め方向: nearest=四捨五入, floor=切り捨て, ceil=切り上げ */
  roundMode?: 'nearest' | 'floor' | 'ceil';
  /** 両方の日時が無効な場合の表示文字列 */
  fallback?: string;
};

const DEFAULT_TIMEZONE = 'Asia/Tokyo';

const isOptions = (value: unknown): value is FormatRangeOptions =>
  !!value &&
  typeof value === 'object' &&
  !(value instanceof Date) &&
  !Array.isArray(value) &&
  ('tz' in (value as Record<string, unknown>) ||
    'roundTo' in (value as Record<string, unknown>) ||
    'roundMode' in (value as Record<string, unknown>) ||
    'fallback' in (value as Record<string, unknown>));

const coerceDate = (value: FormatRangeInput): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const applyRounding = (
  date: Date,
  minutes?: number,
  mode: 'nearest' | 'floor' | 'ceil' = 'nearest'
): Date => {
  if (!minutes || minutes <= 0) {
    return date;
  }

  const stepMs = minutes * 60 * 1000;
  const ratio = date.getTime() / stepMs;

  const rounded =
    mode === 'floor' ? Math.floor(ratio) * stepMs :
    mode === 'ceil' ? Math.ceil(ratio) * stepMs :
    Math.round(ratio) * stepMs; // nearest (default)

  return new Date(rounded);
};

const formatWithZone = (date: Date, timeZone: string): string => {
  const effectiveTz = timeZone?.trim() || DEFAULT_TIMEZONE;

  // Prevent infinite recursion when caller passes an empty/invalid tz repeatedly
  if (effectiveTz === '') {
    return formatWithZone(date, DEFAULT_TIMEZONE);
  }

  try {
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: effectiveTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
      if (part.type !== 'literal') {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

    const year = parts.year ?? '----';
    const month = parts.month ?? '--';
    const day = parts.day ?? '--';
    const hour = parts.hour ?? '--';
    const minute = parts.minute ?? '--';
    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch {
    // Fallback to default and avoid unbounded recursion
    if (effectiveTz === DEFAULT_TIMEZONE) {
      return date.toISOString();
    }
    return formatWithZone(date, DEFAULT_TIMEZONE);
  }
};

/**
 * 日時範囲をフォーマットする（単一日時 + オプション）
 * @param startInput 開始日時
 * @param options フォーマットオプション
 * @returns フォーマットされた日時文字列
 */
export function formatRangeLocal(
  startInput: FormatRangeInput,
  options?: FormatRangeOptions,
): string;

/**
 * 日時範囲をフォーマットする（開始・終了日時 + オプション）
 * @param startInput 開始日時
 * @param endInput 終了日時
 * @param options フォーマットオプション
 * @returns フォーマットされた日時範囲文字列
 */
export function formatRangeLocal(
  startInput: FormatRangeInput,
  endInput: FormatRangeInput,
  options?: FormatRangeOptions,
): string;

/**
 * 日時範囲をフォーマットする（実装）
 */
export function formatRangeLocal(
  startInput: FormatRangeInput,
  endInput?: FormatRangeInput | FormatRangeOptions,
  maybeOptions?: FormatRangeOptions
): string {
  let options: FormatRangeOptions | undefined = maybeOptions;
  let resolvedEndInput: FormatRangeInput | undefined;

  if (!maybeOptions && isOptions(endInput)) {
    options = endInput;
  } else if (endInput !== undefined) {
    resolvedEndInput = endInput as FormatRangeInput;
  }

  const tz = options?.tz ?? DEFAULT_TIMEZONE;
  const roundTo = options?.roundTo;
  const roundMode = options?.roundMode ?? 'nearest';
  const fallback = options?.fallback ?? '';

  const startDateRaw = coerceDate(startInput);
  const endDateRaw = resolvedEndInput !== undefined ? coerceDate(resolvedEndInput) : null;

  if (!startDateRaw && !endDateRaw) {
    return fallback;
  }

  const startDate = startDateRaw ? applyRounding(startDateRaw, roundTo, roundMode) : null;
  const endDate = endDateRaw ? applyRounding(endDateRaw, roundTo, roundMode) : null;

  const startText = startDate ? formatWithZone(startDate, tz) : '--';
  const endText = endDate ? formatWithZone(endDate, tz) : '--';

  const suffix = tz ? ` (${tz})` : '';

  // 開始時刻が無効で終了時刻のみ有効な場合は、終了時刻だけを表示
  if (!startDate && endDate) {
    return `${endText}${suffix}`;
  }

  // 終了時刻が無効な場合は、開始時刻のみを表示
  if (!endDate) {
    return `${startText}${suffix}`;
  }

  // 両方有効な場合は範囲表示
  return `${startText} – ${endText}${suffix}`;
}

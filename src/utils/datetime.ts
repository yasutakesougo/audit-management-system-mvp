type FormatRangeInput = string | number | Date | null | undefined;

export type FormatRangeOptions = {
  tz?: string;
  roundTo?: number;
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

const applyRounding = (date: Date, minutes?: number): Date => {
  if (!minutes || minutes <= 0) {
    return date;
  }
  const stepMs = minutes * 60 * 1000;
  const rounded = Math.round(date.getTime() / stepMs) * stepMs;
  return new Date(rounded);
};

const formatWithZone = (date: Date, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone,
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
};

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
  const fallback = options?.fallback ?? '';

  const startDateRaw = coerceDate(startInput);
  const endDateRaw = coerceDate(resolvedEndInput ?? startInput);

  if (!startDateRaw && !endDateRaw) {
    return fallback;
  }

  const startDate = startDateRaw ? applyRounding(startDateRaw, roundTo) : null;
  const endDate = endDateRaw ? applyRounding(endDateRaw, roundTo) : null;

  const startText = startDate ? formatWithZone(startDate, tz) : '--';
  const endText = endDate ? formatWithZone(endDate, tz) : '--';

  const suffix = tz ? ` (${tz})` : '';
  if (!endDate) {
    return `${startText}${suffix}`;
  }
  return `${startText} – ${endText}${suffix}`;
}

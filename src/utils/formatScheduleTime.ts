import { formatInTimeZone } from '@/lib/tz';

const FALLBACK = '--:--';
const RANGE_SEPARATOR = '–';
const NEXT_DAY_LABEL = '翌';
const FROM_LABEL = 'から';
const INVALID_RANGE = `${FALLBACK}${RANGE_SEPARATOR}${FALLBACK}`;

export const SCHEDULE_TIME_FALLBACK = FALLBACK;

export type ScheduleRange = {
  text: string;
  aria: string;
  start: Date | null;
  end: Date | null;
  crossesMidnight: boolean;
  spansDays: number;
  tz: string;
  valid: boolean;
};

/**
 * ISO文字列を指定タイムゾーンの時刻表示にフォーマットする
 * 失敗した場合は `SCHEDULE_TIME_FALLBACK` (`"--:--"`) を返す
 *
 * @param iso ISO8601形式の日時文字列 ("2025-01-15T09:30:00Z")
 * @param timeZone タイムゾーン識別子 ("Asia/Tokyo", "UTC" など)
 * @param format 出力形式 (デフォルト: "HH:mm")
 * @returns フォーマットされた時刻文字列 または "--:--"
 *
 * @example
 * ```typescript
 * formatScheduleTime("2025-01-15T09:30:00Z", "Asia/Tokyo") // "18:30"
 * formatScheduleTime("2025-01-15T09:30:00Z", "Asia/Tokyo", "HH:mm:ss") // "18:30:00"
 * formatScheduleTime(null, "Asia/Tokyo") // "--:--"
 * formatScheduleTime("invalid", "Asia/Tokyo") // "--:--"
 * ```
 */
export function formatScheduleTime(
  iso: string | null | undefined,
  timeZone: string,
  format: string = 'HH:mm'
): string {
  if (!iso || !timeZone) {
    return FALLBACK;
  }

  try {
    const formatted = formatInTimeZone(iso, timeZone, format);
    return formatted ? formatted : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

/**
 * スケジュールの開始〜終了を表示・読み上げ用の形にまとめる
 * 日跨ぎ（翌日以降）は「翌 09:00」や「3/5 09:00」として表現する
 *
 * @param startISO 開始日時のISO文字列
 * @param endISO 終了日時のISO文字列
 * @param timeZone タイムゾーン識別子
 * @returns スケジュール範囲の詳細情報（表示用・ARIA用・メタデータ含む）
 *
 * @example
 * ```typescript
 * // 同日内
 * formatScheduleRange("2025-01-15T09:30:00Z", "2025-01-15T10:30:00Z", "Asia/Tokyo")
 * // { text: "18:30–19:30", aria: "18:30 から 19:30 (Asia/Tokyo)", crossesMidnight: false, ... }
 *
 * // 翌日跨ぎ
 * formatScheduleRange("2025-01-15T14:00:00Z", "2025-01-16T00:30:00Z", "Asia/Tokyo")
 * // { text: "23:00–翌 09:30", aria: "23:00 から 翌 09:30 (Asia/Tokyo)", crossesMidnight: true, ... }
 *
 * // 複数日跨ぎ
 * formatScheduleRange("2025-01-15T14:00:00Z", "2025-01-17T01:00:00Z", "Asia/Tokyo")
 * // { text: "23:00–1/17 10:00", aria: "23:00 から 1/17 10:00 (Asia/Tokyo)", spansDays: 2, ... }
 * ```
 */
export function formatScheduleRange(
  startISO: string | null | undefined,
  endISO: string | null | undefined,
  timeZone: string
): ScheduleRange {
  const tz = timeZone;
  const startDate = parseIso(startISO);
  const endDate = parseIso(endISO);
  const startText = formatScheduleTime(startISO, tz);
  const endText = formatScheduleTime(endISO, tz);
  const spansDays = calculateDayDiff(startISO, endISO, tz) ?? 0;
  const crossesMidnight = spansDays > 0;
  const decorated = decorateRange({
    startText,
    endText,
    endISO,
    timeZone: tz,
    spansDays,
  });

  const valid = startText !== FALLBACK && endText !== FALLBACK;
  const aria = buildAriaRange({
    startText,
    endLabel: decorated.endLabel,
    text: decorated.text,
    tz,
  });

  return {
    text: decorated.text,
    aria,
    start: startDate,
    end: endDate,
    crossesMidnight,
    spansDays,
    tz,
    valid,
  };
}

type DecorateParams = {
  startText: string;
  endText: string;
  endISO: string | null | undefined;
  timeZone: string;
  spansDays: number;
};

type DecoratedRange = {
  text: string;
  endLabel: string;
};

/**
 * 基本的な範囲表示を生成するヘルパー関数
 */
const basicText = (start: string, end: string): DecoratedRange => ({
  text: `${start}${RANGE_SEPARATOR}${end}`,
  endLabel: end,
});

function decorateRange(params: DecorateParams): DecoratedRange {
  const { startText, endText, endISO, timeZone, spansDays } = params;

  if (startText === FALLBACK && endText === FALLBACK) {
    return { text: INVALID_RANGE, endLabel: FALLBACK };
  }

  if (startText === FALLBACK || endText === FALLBACK) {
    return basicText(startText, endText);
  }

  if (spansDays <= 0) {
    return basicText(startText, endText);
  }

  if (spansDays === 1) {
    const endLabel = `${NEXT_DAY_LABEL} ${endText}`;
    return {
      text: `${startText}${RANGE_SEPARATOR}${NEXT_DAY_LABEL} ${endText}`,
      endLabel,
    };
  }

  const endWithDate = formatScheduleTime(endISO, timeZone, 'M/d HH:mm');
  if (endWithDate === FALLBACK) {
    return basicText(startText, endText);
  }

  return {
    text: `${startText}${RANGE_SEPARATOR}${endWithDate}`,
    endLabel: endWithDate,
  };
}

type AriaParams = {
  startText: string;
  endLabel: string;
  text: string;
  tz: string;
};

function buildAriaRange({ startText, endLabel, text, tz }: AriaParams): string {
  const suffix = tz ? ` (${tz})` : '';

  // 両方とも無効な場合はそのまま表示
  if (startText === FALLBACK && endLabel === FALLBACK) {
    return `${text}${suffix}`;
  }

  // 片方のみ有効な場合は適切な読み上げを提供
  if (startText === FALLBACK) {
    return `終了時刻 ${endLabel}${suffix}`;
  }

  if (endLabel === FALLBACK) {
    return `開始時刻 ${startText}${suffix}`;
  }

  // 両方とも有効な場合は完全な範囲表示
  return `${startText} ${FROM_LABEL} ${endLabel}${suffix}`;
}

function calculateDayDiff(
  startISO: string | null | undefined,
  endISO: string | null | undefined,
  timeZone: string
): number | null {
  if (!startISO || !endISO) {
    return null;
  }

  try {
    const startDay = formatInTimeZone(startISO, timeZone, 'yyyy-MM-dd');
    const endDay = formatInTimeZone(endISO, timeZone, 'yyyy-MM-dd');

    if (!startDay || !endDay) {
      return null;
    }

    const startUtc = parseDateParts(startDay);
    const endUtc = parseDateParts(endDay);

    if (startUtc === null || endUtc === null) {
      return null;
    }

    const diffMs = endUtc - startUtc;
    return Math.round(diffMs / 86400000);
  } catch {
    return null;
  }
}

function parseDateParts(value: string): number | null {
  const [year, month, day] = value.split('-').map(Number);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return null;
  }
  return Date.UTC(year, month - 1, day);
}

function parseIso(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

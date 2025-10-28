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
    valid,
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

function decorateRange(params: DecorateParams): DecoratedRange {
  const { startText, endText, endISO, timeZone, spansDays } = params;

  if (startText === FALLBACK && endText === FALLBACK) {
    return { text: INVALID_RANGE, endLabel: FALLBACK };
  }

  if (startText === FALLBACK || endText === FALLBACK) {
    return {
      text: `${startText}${RANGE_SEPARATOR}${endText}`,
      endLabel: endText,
    };
  }

  if (spansDays <= 0) {
    return {
      text: `${startText}${RANGE_SEPARATOR}${endText}`,
      endLabel: endText,
    };
  }

  if (spansDays === 1) {
    const endLabel = `${NEXT_DAY_LABEL} ${endText}`;
    return {
      text: `${startText}${RANGE_SEPARATOR}${NEXT_DAY_LABEL}${endText}`,
      endLabel,
    };
  }

  const endWithDate = formatScheduleTime(endISO, timeZone, 'M/d HH:mm');
  if (endWithDate === FALLBACK) {
    return {
      text: `${startText}${RANGE_SEPARATOR}${endText}`,
      endLabel: endText,
    };
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
  valid: boolean;
};

function buildAriaRange({ startText, endLabel, text, tz, valid }: AriaParams): string {
  const suffix = tz ? ` (${tz})` : '';
  if (!valid) {
    return `${text}${suffix}`;
  }

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

import type { DateRange } from '../hooks/useTelemetryDashboard';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type SuggestionLifecycleWindow = {
  from: Date;
  to: Date;
  days: number;
  maxDocs: number;
};

function startOfDay(base: Date): Date {
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    0,
    0,
    0,
    0,
  );
}

export function buildSuggestionLifecycleWindow(
  range: DateRange,
  now: Date,
): SuggestionLifecycleWindow {
  if (range === 'today') {
    return {
      from: startOfDay(now),
      to: now,
      days: 1,
      maxDocs: 200,
    };
  }

  const days = range === '30d' ? 30 : 7;
  return {
    from: new Date(now.getTime() - days * MS_PER_DAY),
    to: now,
    days,
    maxDocs: range === '30d' ? 2000 : 500,
  };
}

/**
 * 現在windowと同幅の前期間windowを返す。
 * クエリ境界重複を避けるため、previous.to は current.from - 1ms とする。
 */
export function buildPreviousSuggestionLifecycleWindow(
  current: SuggestionLifecycleWindow,
): SuggestionLifecycleWindow {
  const spanMs = Math.max(current.to.getTime() - current.from.getTime(), 1);
  const previousTo = new Date(current.from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - spanMs);

  return {
    from: previousFrom,
    to: previousTo,
    days: current.days,
    maxDocs: current.maxDocs,
  };
}

export function formatSuggestionRate(rate: number): string {
  const normalized = Number.isFinite(rate) ? rate : 0;
  const percent = Math.max(0, normalized * 100);
  return `${percent.toFixed(1)}%`;
}

export type DailySubmissionEvent = {
  userId: string;
  recordDate: string;
  submittedAt: string;
  draftCreatedAt?: string;
};

export type DailySubmissionMetricSummary = {
  recordDate: string;
  completionRate: number;
  submittedCount: number;
  targetCount: number;
  averageLeadTimeMinutes: number;
};

export type TrendDirection = 'up' | 'down' | 'flat';

export type PeriodMetrics = {
  completionRate: number;
  submittedCount: number;
  targetCount: number;
  averageLeadTimeMinutes: number;
  dayCount: number;
};

export type TrendMetrics = {
  current: PeriodMetrics;
  previous: PeriodMetrics;
  completionTrend: TrendDirection;
  leadTimeTrend: TrendDirection;
};

export type TrendTolerance = Readonly<{
  completionRate: number;
  leadTimeMinutes: number;
}>;

export const DEFAULT_TREND_TOLERANCE: TrendTolerance = {
  completionRate: 0.02,
  leadTimeMinutes: 5,
};

const DAILY_PDCA_METRICS_STORAGE_KEY = 'pdca:daily-submission-events:v1';

const toDayKey = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (base: Date, days: number): Date => {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
};

const startOfIsoWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

const endOfMonth = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

const getPeriodDayKeys = (startDate: Date, endDate: Date): string[] => {
  const keys: string[] = [];
  let cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    keys.push(toDayKey(cursor.toISOString()));
    cursor = addDays(cursor, 1);
  }

  return keys;
};

const calculateLeadTimeMinutes = (event: DailySubmissionEvent): number => {
  if (!event.draftCreatedAt) {
    return 0;
  }

  const draftAt = new Date(event.draftCreatedAt).getTime();
  const submittedAt = new Date(event.submittedAt).getTime();
  if (Number.isNaN(draftAt) || Number.isNaN(submittedAt)) {
    return 0;
  }

  return Math.max(0, Math.round((submittedAt - draftAt) / 60000));
};

const aggregatePeriodMetrics = (params: {
  events: DailySubmissionEvent[];
  targetUserIds: string[];
  dayKeys: string[];
}): PeriodMetrics => {
  const { events, targetUserIds, dayKeys } = params;
  const targetUserSet = new Set(targetUserIds.filter(Boolean));
  const targetCount = targetUserSet.size;

  const eventsByDay = new Map<string, DailySubmissionEvent[]>();
  dayKeys.forEach((key) => eventsByDay.set(key, []));

  events.forEach((event) => {
    const dayKey = toDayKey(event.recordDate);
    const existing = eventsByDay.get(dayKey);
    if (!existing) {
      return;
    }

    if (targetUserSet.size > 0 && !targetUserSet.has(event.userId)) {
      return;
    }

    existing.push(event);
  });

  const submittedUsers = new Set<string>();
  const completionRates: number[] = [];
  const leadTimes: number[] = [];

  dayKeys.forEach((dayKey) => {
    const dayEvents = eventsByDay.get(dayKey) ?? [];
    const dayUsers = new Set(dayEvents.map((event) => event.userId));
    dayUsers.forEach((userId) => submittedUsers.add(userId));

    const dayCompletionRate = targetCount > 0 ? dayUsers.size / targetCount : 0;
    completionRates.push(dayCompletionRate);

    dayEvents.forEach((event) => {
      leadTimes.push(calculateLeadTimeMinutes(event));
    });
  });

  const completionRate = completionRates.length > 0
    ? completionRates.reduce((sum, value) => sum + value, 0) / completionRates.length
    : 0;

  const averageLeadTimeMinutes = leadTimes.length > 0
    ? Math.round(leadTimes.reduce((sum, value) => sum + value, 0) / leadTimes.length)
    : 0;

  return {
    completionRate,
    submittedCount: submittedUsers.size,
    targetCount,
    averageLeadTimeMinutes,
    dayCount: dayKeys.length,
  };
};

const toEventKey = (userId: string, recordDate: string): string => `${userId}::${recordDate}`;

const readEventMap = (): Record<string, DailySubmissionEvent> => {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(DAILY_PDCA_METRICS_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, DailySubmissionEvent>;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
};

const writeEventMap = (nextMap: Record<string, DailySubmissionEvent>): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(DAILY_PDCA_METRICS_STORAGE_KEY, JSON.stringify(nextMap));
};

export const getStoredDailySubmissionEvents = (): DailySubmissionEvent[] => {
  return Object.values(readEventMap());
};

export const getTrendDirection = (
  previous: number,
  current: number,
  tolerance: number = DEFAULT_TREND_TOLERANCE.completionRate,
): TrendDirection => {
  if (current > previous + tolerance) {
    return 'up';
  }

  if (current < previous - tolerance) {
    return 'down';
  }

  return 'flat';
};

export const getTrend = (
  current: number,
  previous: number,
  threshold: number = DEFAULT_TREND_TOLERANCE.completionRate,
): TrendDirection => {
  return getTrendDirection(previous, current, threshold);
};

const getLeadTimeTrend = (
  previous: number,
  current: number,
  tolerance: number = DEFAULT_TREND_TOLERANCE.leadTimeMinutes,
): TrendDirection => {
  return getTrendDirection(current, previous, tolerance);
};

export const getWeeklyMetrics = (params: {
  events: DailySubmissionEvent[];
  targetUserIds: string[];
  referenceDate?: Date;
}): TrendMetrics => {
  const referenceDate = params.referenceDate ?? new Date();
  const currentStart = startOfIsoWeek(referenceDate);
  const currentEnd = addDays(currentStart, 6);
  const previousStart = addDays(currentStart, -7);
  const previousEnd = addDays(currentStart, -1);

  const currentDayKeys = getPeriodDayKeys(currentStart, currentEnd);
  const previousDayKeys = getPeriodDayKeys(previousStart, previousEnd);

  const current = aggregatePeriodMetrics({
    events: params.events,
    targetUserIds: params.targetUserIds,
    dayKeys: currentDayKeys,
  });

  const previous = aggregatePeriodMetrics({
    events: params.events,
    targetUserIds: params.targetUserIds,
    dayKeys: previousDayKeys,
  });

  return {
    current,
    previous,
    completionTrend: getTrendDirection(previous.completionRate, current.completionRate),
    leadTimeTrend: getLeadTimeTrend(previous.averageLeadTimeMinutes, current.averageLeadTimeMinutes),
  };
};

export const getMonthlyMetrics = (params: {
  events: DailySubmissionEvent[];
  targetUserIds: string[];
  referenceDate?: Date;
}): TrendMetrics => {
  const referenceDate = params.referenceDate ?? new Date();

  const currentMonthStart = startOfMonth(referenceDate);
  const currentMonthEnd = endOfMonth(referenceDate);

  const previousMonthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1);
  const previousMonthStart = startOfMonth(previousMonthDate);
  const previousMonthEnd = endOfMonth(previousMonthDate);

  const currentDayKeys = getPeriodDayKeys(currentMonthStart, currentMonthEnd);
  const previousDayKeys = getPeriodDayKeys(previousMonthStart, previousMonthEnd);

  const current = aggregatePeriodMetrics({
    events: params.events,
    targetUserIds: params.targetUserIds,
    dayKeys: currentDayKeys,
  });

  const previous = aggregatePeriodMetrics({
    events: params.events,
    targetUserIds: params.targetUserIds,
    dayKeys: previousDayKeys,
  });

  return {
    current,
    previous,
    completionTrend: getTrendDirection(previous.completionRate, current.completionRate),
    leadTimeTrend: getLeadTimeTrend(previous.averageLeadTimeMinutes, current.averageLeadTimeMinutes),
  };
};

export const emitDailySubmissionEvents = (events: DailySubmissionEvent[]): void => {
  if (events.length === 0) {
    return;
  }

  const eventMap = readEventMap();

  events.forEach((event) => {
    if (!event.userId) {
      return;
    }

    const normalizedRecordDate = toDayKey(event.recordDate);
    const key = toEventKey(event.userId, normalizedRecordDate);
    eventMap[key] = {
      ...event,
      recordDate: normalizedRecordDate,
    };
  });

  writeEventMap(eventMap);
};

export const getDailySubmissionMetrics = (params: {
  recordDate: string;
  targetUserIds: string[];
}): DailySubmissionMetricSummary => {
  const normalizedDate = toDayKey(params.recordDate);
  const targetUserSet = new Set(params.targetUserIds.filter(Boolean));
  const targetCount = targetUserSet.size;

  const sameDayEvents = getStoredDailySubmissionEvents().filter((event) => event.recordDate === normalizedDate);

  const submittedUserSet = new Set(
    sameDayEvents
      .map((event) => event.userId)
      .filter((userId) => targetUserSet.size === 0 || targetUserSet.has(userId)),
  );

  const submittedCount = submittedUserSet.size;
  const completionRate = targetCount > 0 ? submittedCount / targetCount : 0;

  const leadTimeMinutesList = sameDayEvents.map(calculateLeadTimeMinutes);

  const averageLeadTimeMinutes = leadTimeMinutesList.length > 0
    ? Math.round(leadTimeMinutesList.reduce((sum, minutes) => sum + minutes, 0) / leadTimeMinutesList.length)
    : 0;

  return {
    recordDate: normalizedDate,
    completionRate,
    submittedCount,
    targetCount,
    averageLeadTimeMinutes,
  };
};

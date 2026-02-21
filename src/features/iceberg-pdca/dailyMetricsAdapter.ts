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

const DAILY_PDCA_METRICS_STORAGE_KEY = 'pdca:daily-submission-events:v1';

const toDayKey = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 10);
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

  const sameDayEvents = Object.values(readEventMap()).filter((event) => event.recordDate === normalizedDate);

  const submittedUserSet = new Set(
    sameDayEvents
      .map((event) => event.userId)
      .filter((userId) => targetUserSet.size === 0 || targetUserSet.has(userId)),
  );

  const submittedCount = submittedUserSet.size;
  const completionRate = targetCount > 0 ? submittedCount / targetCount : 0;

  const leadTimeMinutesList = sameDayEvents
    .map((event) => {
      if (!event.draftCreatedAt) {
        return 0;
      }

      const draftAt = new Date(event.draftCreatedAt).getTime();
      const submittedAt = new Date(event.submittedAt).getTime();
      if (Number.isNaN(draftAt) || Number.isNaN(submittedAt)) {
        return 0;
      }

      return Math.max(0, Math.round((submittedAt - draftAt) / 60000));
    });

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

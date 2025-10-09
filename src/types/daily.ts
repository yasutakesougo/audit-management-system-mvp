import {
  DAILY_FIELD_BEHAVIOR_LOG,
  DAILY_FIELD_DATE,
  DAILY_FIELD_END_TIME,
  DAILY_FIELD_LOCATION,
  DAILY_FIELD_MEAL_LOG,
  DAILY_FIELD_NOTES,
  DAILY_FIELD_START_TIME,
  DAILY_FIELD_STATUS,
  DAILY_FIELD_STAFF_ID,
  DAILY_FIELD_USER_ID,
} from '@/sharepoint/fields';

type MaybeNumber = number | null;

type MaybeString = string | null;

const sanitizeText = (value: string): string => value.trim();

const emptyToNull = (value: string): MaybeString => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const DAILY_STATUS_OPTIONS = ['未作成', '作成中', '完了'] as const;
export type DailyStatus = (typeof DAILY_STATUS_OPTIONS)[number];

export type DailyUpsert = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  staffId: MaybeNumber;
  userId: MaybeNumber;
  notes: string;
  mealLog: string;
  behaviorLog: string;
  status: DailyStatus | null;
};

const normalizeLookupId = (value: MaybeNumber): MaybeNumber => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
};

export const toDailyItem = (input: DailyUpsert): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    Title: sanitizeText(input.title),
    [DAILY_FIELD_DATE]: emptyToNull(input.date),
    [DAILY_FIELD_START_TIME]: emptyToNull(input.startTime),
    [DAILY_FIELD_END_TIME]: emptyToNull(input.endTime),
    [DAILY_FIELD_LOCATION]: emptyToNull(input.location),
    [DAILY_FIELD_NOTES]: emptyToNull(input.notes),
    [DAILY_FIELD_MEAL_LOG]: emptyToNull(input.mealLog),
    [DAILY_FIELD_BEHAVIOR_LOG]: emptyToNull(input.behaviorLog),
  };

  const staffId = normalizeLookupId(input.staffId);
  const userId = normalizeLookupId(input.userId);

  payload[DAILY_FIELD_STAFF_ID] = staffId;
  payload[DAILY_FIELD_USER_ID] = userId;

  if (input.status) {
    payload[DAILY_FIELD_STATUS] = input.status;
  } else {
    payload[DAILY_FIELD_STATUS] = null;
  }

  return payload;
};

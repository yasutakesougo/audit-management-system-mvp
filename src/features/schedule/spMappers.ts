import { getLocalDateKey, getLocalDateMonthKey } from '@/features/schedule/dateutils.local';
import { toSpChoice, toStatusEnum } from '@/features/schedule/statusDictionary';
import type { ScheduleOrg, ScheduleStaff, Schedule as TimelineSchedule } from '@/features/schedule/types';

export type SPPayload = Record<string, unknown>;


const STAFF_SUBTYPE_FALLBACK: ScheduleStaff['subType'] = '会議';
const ORG_SUBTYPE_FALLBACK: ScheduleOrg['subType'] = '会議';

const joinValues = (values: readonly string[] | undefined): string | null => {
  if (!values?.length) {
    return null;
  }
  return values.join(',');
};

const normalizeDayKey = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }

  const localKey = getLocalDateKey(trimmed);
  if (localKey) {
    return localKey;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits.length === 8) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const parsedKey = getLocalDateKey(parsed.toISOString());
  return parsedKey || null;
};

const normalizeMonthKey = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }

  if (/^\d{4}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const digits = trimmed.replace(/[^0-9]/g, '');
  if (digits.length >= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const parsedKey = getLocalDateMonthKey(parsed.toISOString());
  return parsedKey || null;
};

export const toSPPayload = (schedule: TimelineSchedule): SPPayload => {
  const resolvedDayKey = normalizeDayKey(schedule.dayKey) ?? (schedule.start ? normalizeDayKey(schedule.start) : null);
  const resolvedMonthKey = normalizeMonthKey((schedule as { monthKey?: string }).monthKey) ?? (schedule.start ? normalizeMonthKey(schedule.start) : null);
  const common: SPPayload = {
    Title: schedule.title ?? '無題の予定',
    Category: schedule.category,
    Start: schedule.start,
    End: schedule.end,
    AllDay: Boolean(schedule.allDay),
    Status: toSpChoice(toStatusEnum(schedule.status)),
    Location: schedule.location ?? null,
    Notes: schedule.notes ?? null,
    RecurrenceRule: schedule.recurrenceRule ?? null,
    DayKey: resolvedDayKey,
    MonthKey: resolvedMonthKey,
  };

  if (schedule.category === 'User') {
    return {
      ...common,
      ServiceType: schedule.serviceType,
      PersonType: schedule.personType,
      PersonId: schedule.personId ?? null,
      PersonName: schedule.personName ?? null,
      ExternalPersonName: schedule.externalPersonName ?? null,
      ExternalPersonOrg: schedule.externalPersonOrg ?? null,
      ExternalPersonContact: schedule.externalPersonContact ?? null,
      StaffIds: joinValues(schedule.staffIds) ?? null,
      StaffNames: joinValues(schedule.staffNames) ?? null,
    } satisfies SPPayload;
  }

  if (schedule.category === 'Staff') {
    return {
      ...common,
      SubType: schedule.subType ?? STAFF_SUBTYPE_FALLBACK,
      StaffIds: joinValues(schedule.staffIds) ?? null,
      StaffNames: joinValues(schedule.staffNames) ?? null,
      DayPart: schedule.dayPart ?? null,
    } satisfies SPPayload;
  }

  return {
    ...common,
    SubType: schedule.subType ?? ORG_SUBTYPE_FALLBACK,
    Audience: joinValues(schedule.audience) ?? null,
    ResourceId: schedule.resourceId ?? null,
    ExternalOrgName: schedule.externalOrgName ?? null,
  } satisfies SPPayload;
};
